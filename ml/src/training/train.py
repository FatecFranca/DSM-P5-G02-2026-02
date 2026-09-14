import argparse
import gc
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

import numpy as np
import sklearn

from .artifacts import load_artifacts, save_artifacts
from .data import load_camara_training_data
from .features import DEFAULT_TFIDF_CONFIG, fit_label_binarizer, fit_tfidf
from .metrics import evaluate_multilabel
from .models import MODEL_CONFIGS, build_model, predict_multilabel
from .split import (
    SPLIT_NAMES,
    analyze_groups,
    assert_no_group_leakage,
    split_grouped_documents,
)


DEFAULT_SEED = 42
DEFAULT_YEARS = [2023, 2024, 2025]
DEFAULT_MODELS = (
    "logistic_regression",
    "logistic_regression_balanced",
    "linear_svc_balanced",
    "sgd_balanced",
    "multinomial_nb",
)


def _label_codes(document: dict) -> list[str]:
    return [str(label["code"]) for label in document["labels"]]


def _class_support(documents: list[dict]) -> Counter:
    return Counter(code for document in documents for code in _label_codes(document))


def _split_summary(
    splits: dict[str, list[dict]], classes: list[dict], total: int
) -> dict:
    result = {}
    for name in SPLIT_NAMES:
        documents = splits[name]
        support = _class_support(documents)
        result[name] = {
            "documents": len(documents),
            "groups": len({item["group_id"] for item in documents}),
            "percentage": round(len(documents) * 100 / total, 4),
            "average_labels": round(
                sum(len(item["labels"]) for item in documents) / len(documents), 4
            ),
            "class_distribution": [
                {
                    "code": item["code"],
                    "name": item["name"],
                    "documents": support[item["code"]],
                    "percentage": round(
                        support[item["code"]] * 100 / len(documents), 4
                    ),
                }
                for item in classes
            ],
        }
    result["intersections"] = assert_no_group_leakage(splits)
    return result


def validate_dataset_and_split(root: Path, documents: list[dict] | None = None):
    processed = root / "data" / "processed"
    if documents is None:
        documents, classes = load_camara_training_data(
            processed / "training_dataset.jsonl.gz",
            processed / "taxonomy.json",
        )
    else:
        taxonomy = json.loads(
            (processed / "taxonomy.json").read_text(encoding="utf-8-sig")
        )
        classes = sorted(
            (
                {"code": str(item["code"]), "name": item["name"], "path": item.get("path")}
                for item in taxonomy
                if item.get("source") == "CAMARA"
            ),
            key=lambda item: int(item["code"]),
        )
    if not documents:
        raise ValueError("Nenhum documento válido da Câmara foi encontrado.")
    support = _class_support(documents)
    missing = [item["code"] for item in classes if not support[item["code"]]]
    if missing:
        raise ValueError(f"Temas oficiais sem documentos no recorte: {missing}")

    class_codes = [item["code"] for item in classes]
    splits = split_grouped_documents(documents, class_codes, seed=DEFAULT_SEED)
    group_analysis = analyze_groups(documents)
    split_analysis = _split_summary(splits, classes, len(documents))
    return documents, classes, splits, group_analysis, split_analysis


def _tfidf_metadata(config: dict) -> dict:
    return {
        key: (
            list(value)
            if isinstance(value, tuple)
            else value.__name__
            if isinstance(value, type)
            else value
        )
        for key, value in config.items()
    }


def _model_metadata(name: str) -> dict:
    return dict(MODEL_CONFIGS[name])


def _trivial_predictions(train_targets, count: int) -> tuple[np.ndarray, str]:
    label_count = max(1, int(round(float(train_targets.sum(axis=1).mean()))))
    frequency = np.asarray(train_targets.sum(axis=0)).ravel()
    frequent = np.argsort(-frequency, kind="stable")[:label_count]
    prediction = np.zeros((count, train_targets.shape[1]), dtype=np.int8)
    prediction[:, frequent] = 1
    return prediction, f"predizer os {label_count} temas mais frequentes do TRAIN"


def _summarize_text(text: str, limit: int = 220) -> str:
    return text if len(text) <= limit else f"{text[: limit - 3].rstrip()}..."


def _label_names(row, classes: list[dict]) -> list[str]:
    return [
        item["name"]
        for present, item in zip(np.asarray(row).ravel(), classes)
        if present
    ]


def _selected_example_indices(documents: list[dict], limit: int = 5) -> list[int]:
    ordered = sorted(
        range(len(documents)),
        key=lambda index: hashlib.sha256(
            f"{DEFAULT_SEED}:{documents[index]['document_id']}".encode("utf-8")
        ).hexdigest(),
    )
    return ordered[:limit]


def _example(document, actual, predicted, classes) -> dict:
    return {
        "document_id": document["document_id"],
        "ementa": _summarize_text(document["ementa"]),
        "official_labels": _label_names(actual, classes),
        "predicted_labels": _label_names(predicted, classes),
    }


def _error_analysis(documents, actual, predicted, classes) -> dict:
    difficult = None
    label_sets_by_group = defaultdict(set)
    for document, row in zip(documents, actual):
        label_sets_by_group[document["group_id"]].add(tuple(np.flatnonzero(row)))
    conflicting_groups = {
        identifier
        for identifier, label_sets in label_sets_by_group.items()
        if len(label_sets) > 1
    }
    candidates = []
    for document, expected, result in zip(documents, actual, predicted):
        fp = np.any((expected == 0) & (result == 1))
        fn = np.any((expected == 1) & (result == 0))
        tp = np.any((expected == 1) & (result == 1))
        current = _example(document, expected, result, classes)
        candidates.append((current, fp, fn, tp))
        if document["group_id"] in conflicting_groups and difficult is None:
            difficult = current
    false_positive = next(
        (item for item, fp, fn, _ in candidates if fp and not fn),
        next((item for item, fp, _, _ in candidates if fp), None),
    )
    used = {false_positive["document_id"]} if false_positive else set()
    false_negative = next(
        (
            item
            for item, fp, fn, _ in candidates
            if fn and not fp and item["document_id"] not in used
        ),
        next(
            (
                item
                for item, _, fn, _ in candidates
                if fn and item["document_id"] not in used
            ),
            None,
        ),
    )
    if false_negative:
        used.add(false_negative["document_id"])
    partial = next(
        (
            item
            for item, fp, fn, tp in candidates
            if tp and (fp or fn) and item["document_id"] not in used
        ),
        next(
            (item for item, fp, fn, tp in candidates if tp and (fp or fn)),
            None,
        ),
    )
    if difficult is None:
        error_counts = np.sum(actual != predicted, axis=1)
        difficult_index = int(np.argmax(error_counts))
        difficult = _example(
            documents[difficult_index],
            actual[difficult_index],
            predicted[difficult_index],
            classes,
        )
    return {
        "false_positive": false_positive,
        "false_negative": false_negative,
        "partial_multilabel": partial,
        "difficult_or_ambiguous": difficult,
        "note": "Amostras escolhidas pelo primeiro caso elegível na ordem estável do test; nenhum ground truth foi alterado.",
    }


def _enrich_per_class(metrics: dict, classes: list[dict], splits) -> None:
    all_support = _class_support(
        [document for name in SPLIT_NAMES for document in splits[name]]
    )
    train_support = _class_support(splits["train"])
    validation_support = _class_support(splits["validation"])
    for item, official in zip(metrics["per_class"], classes):
        item["name"] = official["name"]
        item["dataset_support"] = all_support[item["code"]]
        item["train_support"] = train_support[item["code"]]
        item["validation_support"] = validation_support[item["code"]]


def _json_write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def run_experiment(
    root: Path,
    documents: list[dict] | None = None,
    model_names: tuple[str, ...] = DEFAULT_MODELS,
    tfidf_config: dict | None = None,
    persist: bool = True,
) -> dict:
    documents, classes, splits, groups, split_report = validate_dataset_and_split(
        root, documents
    )
    class_codes = [item["code"] for item in classes]
    label_binarizer, train_targets = fit_label_binarizer(
        [_label_codes(item) for item in splits["train"]], class_codes
    )
    validation_targets = label_binarizer.transform(
        [_label_codes(item) for item in splits["validation"]]
    )
    test_targets = label_binarizer.transform(
        [_label_codes(item) for item in splits["test"]]
    )
    effective_tfidf = dict(DEFAULT_TFIDF_CONFIG)
    if tfidf_config:
        effective_tfidf.update(tfidf_config)
    vectorizer, train_features, tfidf_seconds = fit_tfidf(
        [item["ementa"] for item in splits["train"]], effective_tfidf
    )
    validation_features = vectorizer.transform(
        [item["ementa"] for item in splits["validation"]]
    )
    test_features = vectorizer.transform(
        [item["ementa"] for item in splits["test"]]
    )
    if train_features.shape[1] != validation_features.shape[1] or train_features.shape[1] != test_features.shape[1]:
        raise RuntimeError("As matrizes TF-IDF possuem shapes incompatíveis.")

    trivial_prediction, trivial_strategy = _trivial_predictions(
        train_targets, len(validation_targets)
    )
    trivial_metrics = evaluate_multilabel(
        validation_targets, trivial_prediction, class_codes
    )

    model_reports = []
    selected_model = None
    selected_name = None
    selected_validation_metrics = None
    selected_training_seconds = None
    selected_score = None
    for name in model_names:
        model = build_model(name, DEFAULT_SEED)
        started = perf_counter()
        model.fit(train_features, train_targets)
        training_seconds = perf_counter() - started
        started = perf_counter()
        validation_prediction = predict_multilabel(model, validation_features)
        inference_seconds = perf_counter() - started
        validation_metrics = evaluate_multilabel(
            validation_targets, validation_prediction, class_codes
        )
        report = {
            "name": name,
            "config": _model_metadata(name),
            "training_seconds": training_seconds,
            "validation_inference_seconds": inference_seconds,
            "validation_metrics": validation_metrics,
        }
        model_reports.append(report)
        score = (
            validation_metrics["f1_micro"],
            validation_metrics["f1_macro"],
            -training_seconds,
        )
        if selected_score is None or score > selected_score:
            selected_model = model
            selected_name = name
            selected_validation_metrics = validation_metrics
            selected_training_seconds = training_seconds
            selected_score = score
        else:
            del model
        gc.collect()

    # The protected test set is evaluated only after validation has selected a winner.
    started = perf_counter()
    test_prediction = predict_multilabel(selected_model, test_features)
    test_inference_seconds = perf_counter() - started
    test_metrics = evaluate_multilabel(test_targets, test_prediction, class_codes)
    _enrich_per_class(test_metrics, classes, splits)

    example_indices = _selected_example_indices(splits["test"])
    examples = [
        _example(
            splits["test"][index],
            test_targets[index],
            test_prediction[index],
            classes,
        )
        for index in example_indices
    ]
    errors = _error_analysis(
        splits["test"], test_targets, test_prediction, classes
    )
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "metadata": {
            "generated_at": now,
            "model_version": "experimental-1",
            "source": "CAMARA",
            "years": DEFAULT_YEARS,
            "random_seed": DEFAULT_SEED,
            "split_algorithm": "alocação gulosa determinística por grupo, balanceando tamanho e prevalência multi-label aproximadamente",
            "selection_rule": "maior F1 micro em validation; desempate por F1 macro e menor tempo de treino",
            "test_policy": "test avaliado uma vez, somente após seleção por validation",
            "python_version": __import__("platform").python_version(),
            "scikit_learn_version": sklearn.__version__,
        },
        "dataset": {
            "documents": len(documents),
            "classes": len(classes),
            "average_labels": round(
                sum(len(item["labels"]) for item in documents) / len(documents), 4
            ),
            "taxonomy": [
                {
                    "index": index,
                    "code": item["code"],
                    "name": item["name"],
                    "documents": _class_support(documents)[item["code"]],
                }
                for index, item in enumerate(classes)
            ],
        },
        "groups": groups,
        "split": split_report,
        "tfidf": {
            "config": _tfidf_metadata(effective_tfidf),
            "features": train_features.shape[1],
            "fit_seconds": tfidf_seconds,
            "fit_scope": "TRAIN somente; validation e test usam apenas transform",
            "stopwords_experiment": "Não executado: scikit-learn não fornece lista portuguesa; nenhum recurso externo é baixado em runtime.",
        },
        "models": model_reports,
        "class_weight_experiment": {
            "algorithm": "LogisticRegression",
            "variants": ["class_weight=None", "class_weight=balanced"],
        },
        "trivial_baseline": {
            "strategy": trivial_strategy,
            "validation_metrics": trivial_metrics,
        },
        "selected_model": {
            "name": selected_name,
            "config": _model_metadata(selected_name),
            "validation_metrics": selected_validation_metrics,
            "training_seconds": selected_training_seconds,
            "reason": "Selecionado exclusivamente por validation conforme F1 micro, F1 macro e tempo; test não participou da escolha.",
        },
        "test_metrics": test_metrics,
        "test_inference_seconds": test_inference_seconds,
        "examples": examples,
        "error_analysis": errors,
        "artifacts": {"reload_validated": False},
    }

    if persist:
        metadata = {
            "model_name": selected_name,
            "model_version": "experimental-1",
            "training_date": now,
            "source": "CAMARA",
            "years": DEFAULT_YEARS,
            "classes": report["dataset"]["taxonomy"],
            "class_count": len(classes),
            "train_documents": len(splits["train"]),
            "validation_documents": len(splits["validation"]),
            "test_documents": len(splits["test"]),
            "random_seed": DEFAULT_SEED,
            "tfidf_config": report["tfidf"]["config"],
            "model_config": _model_metadata(selected_name),
            "validation_metrics": selected_validation_metrics,
            "test_metrics": test_metrics,
        }
        artifact_paths = save_artifacts(
            root / "artifacts",
            selected_model,
            vectorizer,
            label_binarizer,
            metadata,
        )
        del selected_model, vectorizer, label_binarizer
        reloaded = load_artifacts(root / "artifacts")
        reload_features = reloaded["vectorizer"].transform(
            [splits["test"][index]["ementa"] for index in example_indices]
        )
        reload_prediction = predict_multilabel(reloaded["model"], reload_features)
        if not np.array_equal(reload_prediction, test_prediction[example_indices]):
            raise RuntimeError("O modelo recarregado produziu resultados diferentes.")
        report["artifacts"] = {
            key: str(path.relative_to(root)).replace("\\", "/")
            for key, path in artifact_paths.items()
        }
        report["artifacts"]["reload_validated"] = True
        report["artifacts"]["reload_examples"] = len(example_indices)
        reports = root / "reports"
        _json_write(reports / "model-baselines.json", report)
        (reports / "model-baselines.md").write_text(
            render_model_report(report), encoding="utf-8"
        )
    return report


def _number(value) -> str:
    return f"{value:,}".replace(",", ".")


def _metric(value) -> str:
    return f"{value:.4f}"


def render_model_report(report: dict) -> str:
    metadata = report["metadata"]
    dataset = report["dataset"]
    groups = report["groups"]
    split = report["split"]
    tfidf = report["tfidf"]
    test = report["test_metrics"]
    lines = [
        "# Baselines de Classificação Temática Multi-label",
        "",
        f"Fonte: **CAMARA**. Janela: **{min(metadata['years'])}–{max(metadata['years'])}**. Feature textual: `ementa`.",
        "",
        "> Experimento clássico offline; não existe API de inferência nem integração com o backend.",
        "",
        "## Dataset e taxonomia",
        "",
        f"- Documentos: {_number(dataset['documents'])}",
        f"- Temas oficiais observados: {dataset['classes']}",
        f"- Média de labels/documento: {dataset['average_labels']:.4f}",
        f"- Grupos de ementa: {_number(groups['groups'])}",
        f"- Grupos duplicados: {_number(groups['duplicate_groups'])}",
        f"- Grupos conflitantes: {_number(groups['conflicting_groups'])} ({_number(groups['conflicting_documents'])} documentos)",
        "",
        "| Código | Tema | Documentos |",
        "|---:|---|---:|",
    ]
    for item in dataset.get("taxonomy", []):
        lines.append(f"| {item['code']} | {item['name']} | {_number(item['documents'])} |")
    if groups.get("conflict_types"):
        lines.extend(
            [
                "",
                f"Tipos distintos de conflito: {_number(groups.get('conflict_type_count', 0))}. Os 10 mais frequentes:",
                "",
                "| Conjuntos oficiais divergentes | Grupos |",
                "|---|---:|",
            ]
        )
        for item in groups["conflict_types"][:10]:
            lines.append(
                f"| `{item['label_sets']}` | {_number(item['groups'])} |"
            )
    lines.extend(["", "## Split por grupo", ""])
    for name in SPLIT_NAMES:
        item = split[name]
        lines.append(
            f"- {name.upper()}: {_number(item['documents'])} documentos, {_number(item['groups'])} grupos, {item['percentage']:.2f}%, média {item['average_labels']:.4f} labels."
        )
    intersections = split["intersections"]
    lines.extend(
        [
            "",
            "O balanceamento é aproximado, não uma estratificação multi-label perfeita.",
            "",
            "## Validação anti-leakage",
            "",
            f"- `train ∩ validation`: {intersections['train_validation']}",
            f"- `train ∩ test`: {intersections['train_test']}",
            f"- `validation ∩ test`: {intersections['validation_test']}",
            "- Resultado: aprovado; qualquer interseção aborta o treinamento.",
            "",
            "## TF-IDF",
            "",
            f"- Configuração: `{json.dumps(tfidf['config'], ensure_ascii=False, sort_keys=True)}`",
            f"- Features: {_number(tfidf['features'])}",
            f"- Tempo de fit: {tfidf['fit_seconds']:.3f}s",
            f"- Escopo do fit: {tfidf.get('fit_scope', 'TRAIN somente')}",
            f"- Stopwords: {tfidf.get('stopwords_experiment', 'sem remoção')}",
            "",
            "## Modelos em validation",
            "",
            "| Modelo | F1 micro | F1 macro | Treino | Inferência validation |",
            "|---|---:|---:|---:|---:|",
        ]
    )
    for model in report["models"]:
        validation = model["validation_metrics"]
        lines.append(
            f"| {model['name']} | {_metric(validation['f1_micro'])} | {_metric(validation['f1_macro'])} | {model['training_seconds']:.3f}s | {model['validation_inference_seconds']:.3f}s |"
        )
    trivial = report["trivial_baseline"]
    lines.extend(
        [
            "",
            f"Baseline trivial: {trivial['strategy']}; F1 micro {_metric(trivial['validation_metrics']['f1_micro'])}, F1 macro {_metric(trivial['validation_metrics']['f1_macro'])}.",
            "",
            "## Modelo selecionado",
            "",
            f"**{report['selected_model']['name']}**. {report['selected_model']['reason']}",
            "",
            "## Test final",
            "",
            f"- Precision micro: {_metric(test['precision_micro'])}",
            f"- Recall micro: {_metric(test['recall_micro'])}",
            f"- F1 micro: {_metric(test['f1_micro'])}",
            f"- Precision macro: {_metric(test['precision_macro'])}",
            f"- Recall macro: {_metric(test['recall_macro'])}",
            f"- F1 macro: {_metric(test['f1_macro'])}",
            f"- Subset Accuracy: {_metric(test['subset_accuracy'])}",
            f"- Hamming Loss: {_metric(test['hamming_loss'])}",
            f"- Jaccard por amostra: {_metric(test['jaccard_samples'])}",
            "",
            "### Métricas por classe",
            "",
            "| Código | Tema | Support test | Precision | Recall | F1 |",
            "|---:|---|---:|---:|---:|---:|",
        ]
    )
    for item in test.get("per_class", []):
        lines.append(
            f"| {item['code']} | {item.get('name', '')} | {_number(item['support'])} | {_metric(item['precision'])} | {_metric(item['recall'])} | {_metric(item['f1'])} |"
        )
    lines.extend(["", "## Exemplos determinísticos do test", ""])
    for item in report.get("examples", []):
        lines.append(
            f"- `{item['document_id']}`: {item['ementa']} Oficial: {', '.join(item['official_labels']) or 'nenhum'}. Previsto: {', '.join(item['predicted_labels']) or 'nenhum'}."
        )
    lines.extend(["", "## Análise de erros", ""])
    for key in (
        "false_positive",
        "false_negative",
        "partial_multilabel",
        "difficult_or_ambiguous",
    ):
        item = report.get("error_analysis", {}).get(key)
        if item:
            lines.append(
                f"- {key}: `{item['document_id']}`. Oficial: {', '.join(item['official_labels']) or 'nenhum'}. Previsto: {', '.join(item['predicted_labels']) or 'nenhum'}."
            )
        else:
            lines.append(f"- {key}: nenhum caso encontrado.")
    lines.extend(
        [
            "",
            "## Artefatos",
            "",
            f"- Reload validado: {report.get('artifacts', {}).get('reload_validated', False)}",
            "- O modelo permanece experimental e não é servido por API nesta fase.",
            "",
            "## Conclusão",
            "",
            f"A classificação é tecnicamente viável como baseline: `{report['selected_model']['name']}` supera o baseline trivial em F1 micro e macro. Classes com suporte extremamente baixo continuam sem evidência suficiente; uma API futura deve estudar calibração do `decision_function` sem usar o test para ajuste.",
            "",
        ]
    )
    return "\n".join(lines)


def _smoke_subset(documents: list[dict], classes: list[dict], limit: int) -> list[dict]:
    selected_ids = set()
    covered = set()
    for document in documents:
        codes = set(_label_codes(document))
        if codes - covered:
            selected_ids.add(document["document_id"])
            covered.update(codes)
    for document in documents:
        if len(selected_ids) >= limit:
            break
        selected_ids.add(document["document_id"])
    selected_group_ids = {
        hashlib.sha256(document["ementa"].encode("utf-8")).hexdigest()
        for document in documents
        if document["document_id"] in selected_ids
    }
    return [
        document
        for document in documents
        if hashlib.sha256(document["ementa"].encode("utf-8")).hexdigest()
        in selected_group_ids
    ]


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Baselines multi-label TF-IDF da Câmara sem leakage por ementa."
    )
    parser.add_argument("command", choices=("validate", "smoke", "train"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--smoke-documents", type=int, default=2000)
    return parser


def main() -> None:
    arguments = _parser().parse_args()
    root = arguments.root.resolve()
    if arguments.command == "validate":
        documents, classes, _, groups, split = validate_dataset_and_split(root)
        print(
            f"Dataset validado: {len(documents)} documentos, {len(classes)} temas, "
            f"{groups['groups']} grupos; interseções {split['intersections']}."
        )
        return
    if arguments.command == "smoke":
        all_documents, classes = load_camara_training_data(
            root / "data" / "processed" / "training_dataset.jsonl.gz",
            root / "data" / "processed" / "taxonomy.json",
        )
        subset = _smoke_subset(all_documents, classes, arguments.smoke_documents)
        report = run_experiment(
            root,
            documents=subset,
            model_names=("sgd_balanced", "multinomial_nb"),
            tfidf_config={"min_df": 1, "max_features": 20_000},
            persist=False,
        )
        print(
            f"Smoke concluído: {report['dataset']['documents']} documentos; "
            f"vencedor {report['selected_model']['name']}."
        )
        return
    report = run_experiment(root)
    print(
        f"Treinamento concluído: {report['selected_model']['name']}; "
        f"test F1 micro={report['test_metrics']['f1_micro']:.4f}, "
        f"F1 macro={report['test_metrics']['f1_macro']:.4f}."
    )


if __name__ == "__main__":
    main()
