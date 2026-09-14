from collections import Counter
from itertools import combinations
from statistics import mean, median


def _percentage(part: int, total: int) -> float:
    return round(part * 100 / total, 4) if total else 0.0


def _viability(documents: list[dict]) -> dict:
    total = len(documents)
    valid_text = sum(item["ementa_status"] == "valid" for item in documents)
    candidates = sum(
        item["ementa_status"] == "valid" and bool(item["labels"])
        and not item.get("duplicate_identity_conflict", False)
        for item in documents
    )
    coverage = _percentage(candidates, total)
    text_coverage = _percentage(valid_text, total)
    if candidates >= 10_000 and coverage >= 15 and text_coverage >= 90:
        level = "ALTA"
    elif candidates >= 2_000 and coverage >= 10 and text_coverage >= 80:
        level = "MÉDIA"
    else:
        level = "BAIXA"
    return {
        "level": level,
        "documents": total,
        "training_candidates": candidates,
        "label_coverage_percentage": coverage,
        "valid_text_percentage": text_coverage,
    }


def analyze_dataset(
    documents, diagnostics: dict, metadata: dict, official_taxonomy: list[dict] | None = None
) -> dict:
    documents = list(documents)
    total = len(documents)
    sources = Counter(item["source"] for item in documents)
    valid = sum(item["ementa_status"] == "valid" for item in documents)
    empty = sum(item["ementa_status"] == "empty" for item in documents)
    missing = sum(item["ementa_status"] == "missing" for item in documents)
    short = sum(
        item["ementa_status"] == "valid" and len(item["ementa"]) < 40
        for item in documents
    )

    labeled_documents = [item for item in documents if item["labels"]]
    labeled_by_source = Counter(item["source"] for item in labeled_documents)
    label_frequency: Counter[tuple[str, str, str]] = Counter()
    for document in labeled_documents:
        for label in document["labels"]:
            label_frequency[
                (document["source"], str(label["code"]), label["name"])
            ] += 1
    observed_by_identity = {
        (key[0], key[1]): {"source": key[0], "code": key[1], "name": key[2]}
        for key in label_frequency
    }
    taxonomy_by_identity = {
        (item["source"], str(item["code"])): {
            "source": item["source"],
            "code": str(item["code"]),
            "name": item["name"],
        }
        for item in (official_taxonomy or [])
    }
    taxonomy_by_identity.update(
        {
            identity: item
            for identity, item in observed_by_identity.items()
            if identity not in taxonomy_by_identity
        }
    )
    taxonomy = [
        {
            **item,
            "documents": label_frequency.get(
                (item["source"], item["code"], item["name"]), 0
            ),
            "percentage_of_source_labeled_documents": _percentage(
                label_frequency.get(
                    (item["source"], item["code"], item["name"]), 0
                ),
                labeled_by_source[item["source"]],
            ),
            "percentage_of_all_labeled_documents": _percentage(
                label_frequency.get(
                    (item["source"], item["code"], item["name"]), 0
                ),
                len(labeled_documents),
            ),
        }
        for item in sorted(
            taxonomy_by_identity.values(),
            key=lambda item: (
                -label_frequency.get(
                    (item["source"], item["code"], item["name"]), 0
                ),
                item["source"],
                item["code"],
            ),
        )
    ]
    frequencies = [item["documents"] for item in taxonomy]

    label_counts = Counter(len(item["labels"]) for item in labeled_documents)
    average_labels = (
        round(mean(len(item["labels"]) for item in labeled_documents), 4)
        if labeled_documents
        else 0.0
    )
    maximum_labels = max(label_counts, default=0)

    pair_frequency: Counter[tuple] = Counter()
    for document in labeled_documents:
        labels = sorted(
            (
                document["source"],
                str(label["code"]),
                label["name"],
            )
            for label in document["labels"]
        )
        pair_frequency.update(combinations(labels, 2))
    cooccurrence = [
        {
            "source": pair[0][0],
            "left": {"code": pair[0][1], "name": pair[0][2]},
            "right": {"code": pair[1][1], "name": pair[1][2]},
            "count": count,
        }
        for pair, count in pair_frequency.most_common(20)
    ]

    source_analysis = {}
    for source in ("CAMARA", "SENADO"):
        source_documents = [item for item in documents if item["source"] == source]
        source_labeled = [item for item in source_documents if item["labels"]]
        source_label_counts = Counter(len(item["labels"]) for item in source_labeled)
        source_pairs: Counter[tuple] = Counter()
        for document in source_labeled:
            labels = sorted(
                (str(label["code"]), label["name"]) for label in document["labels"]
            )
            source_pairs.update(combinations(labels, 2))
        source_analysis[source] = {
            "documents": len(source_documents),
            "valid_text": sum(
                item["ementa_status"] == "valid" for item in source_documents
            ),
            "empty_text": sum(
                item["ementa_status"] == "empty" for item in source_documents
            ),
            "missing_text": sum(
                item["ementa_status"] == "missing" for item in source_documents
            ),
            "short_text": sum(
                item["ementa_status"] == "valid" and len(item["ementa"]) < 40
                for item in source_documents
            ),
            "with_labels": len(source_labeled),
            "without_labels": len(source_documents) - len(source_labeled),
            "percentage_labeled": _percentage(
                len(source_labeled), len(source_documents)
            ),
            "multilabel": {
                "one_label": source_label_counts[1],
                "two_labels": source_label_counts[2],
                "three_labels": source_label_counts[3],
                "more_than_three_labels": sum(
                    count
                    for number, count in source_label_counts.items()
                    if number > 3
                ),
                "average": round(
                    mean(len(item["labels"]) for item in source_labeled), 4
                )
                if source_labeled
                else 0.0,
                "maximum": max(source_label_counts, default=0),
            },
            "cooccurrence": [
                {
                    "left": {"code": pair[0][0], "name": pair[0][1]},
                    "right": {"code": pair[1][0], "name": pair[1][1]},
                    "count": count,
                }
                for pair, count in source_pairs.most_common(10)
            ],
        }

    years: dict[str, dict[str, int]] = {}
    for document in documents:
        year = str(document["ano"])
        years.setdefault(year, {"CAMARA": 0, "SENADO": 0})[document["source"]] += 1

    by_source = {
        source: _viability([item for item in documents if item["source"] == source])
        for source in ("CAMARA", "SENADO")
    }
    training_candidates = sum(
        item["ementa_status"] == "valid"
        and bool(item["labels"])
        and isinstance(item["external_id"], int)
        and item["external_id"] > 0
        and item["source"] in {"CAMARA", "SENADO"}
        and not item.get("duplicate_identity_conflict", False)
        for item in documents
    )
    observed_taxonomy = [item for item in taxonomy if item["documents"] > 0]
    observed_frequencies = [item["documents"] for item in observed_taxonomy]
    for source in ("CAMARA", "SENADO"):
        source_classes = [item for item in taxonomy if item["source"] == source]
        source_analysis[source]["official_themes"] = len(source_classes)
        source_analysis[source]["observed_themes"] = sum(
            item["documents"] > 0 for item in source_classes
        )
        source_analysis[source]["rare_classes_under_50"] = sum(
            item["documents"] < 50 for item in source_classes
        )

    classes_by_name: dict[str, list[dict]] = {}
    for item in taxonomy:
        classes_by_name.setdefault(item["name"].casefold(), []).append(item)
    overlapping_names = [
        {
            "name": items[0]["name"],
            "classes": [
                {"source": item["source"], "code": item["code"]} for item in items
            ],
        }
        for items in classes_by_name.values()
        if len({item["source"] for item in items}) > 1
    ]
    taxonomy_recommendation = {
        "keep_without_grouping_candidates": [
            item for item in taxonomy if item["documents"] >= 50
        ],
        "rare_classes_to_review": [
            item for item in taxonomy if 0 < item["documents"] < 50
        ],
        "classes_without_examples": [
            item for item in taxonomy if item["documents"] == 0
        ],
        "same_names_across_sources_to_review": overlapping_names,
        "note": (
            "As listas são evidências para revisão futura; nenhum label foi "
            "agrupado, removido ou convertido nesta fase."
        ),
    }

    return {
        "metadata": metadata,
        "dataset": {
            "total_documents": total,
            "documents_by_source": dict(sorted(sources.items())),
            "documents_by_year": dict(sorted(years.items())),
        },
        "text_quality": {
            "valid": valid,
            "empty": empty,
            "missing": missing,
            "short": short,
            "valid_percentage": _percentage(valid, total),
        },
        "label_coverage": {
            "with_labels": len(labeled_documents),
            "without_labels": total - len(labeled_documents),
            "percentage_labeled": _percentage(len(labeled_documents), total),
            "percentage_unlabeled": _percentage(total - len(labeled_documents), total),
        },
        "taxonomy": {
            "number_of_themes": len(taxonomy),
            "number_of_official_themes": len(taxonomy),
            "number_of_observed_themes": sum(
                item["documents"] > 0 for item in taxonomy
            ),
            "classes": taxonomy,
            "largest_class": taxonomy[0] if taxonomy else None,
            "smallest_class": taxonomy[-1] if taxonomy else None,
            "smallest_observed_class": min(
                observed_taxonomy,
                key=lambda item: (item["documents"], item["source"], item["code"]),
            )
            if observed_taxonomy
            else None,
            "mean_documents_per_class": round(mean(frequencies), 4)
            if frequencies
            else 0.0,
            "median_documents_per_class": round(median(frequencies), 4)
            if frequencies
            else 0.0,
            "rare_classes_under_50": sum(value < 50 for value in frequencies),
            "extremely_rare_classes_under_10": sum(
                value < 10 for value in frequencies
            ),
            "mean_documents_per_observed_class": round(
                mean(observed_frequencies), 4
            )
            if observed_frequencies
            else 0.0,
            "median_documents_per_observed_class": round(
                median(observed_frequencies), 4
            )
            if observed_frequencies
            else 0.0,
        },
        "multilabel": {
            "one_label": label_counts[1],
            "two_labels": label_counts[2],
            "three_labels": label_counts[3],
            "more_than_three_labels": sum(
                count for number, count in label_counts.items() if number > 3
            ),
            "average": average_labels,
            "maximum": maximum_labels,
        },
        "cooccurrence": cooccurrence,
        "source_analysis": source_analysis,
        "taxonomy_recommendation": taxonomy_recommendation,
        "duplicates": diagnostics,
        "training_dataset": {"documents": training_candidates},
        "viability": {
            "CAMARA": by_source["CAMARA"],
            "SENADO": by_source["SENADO"],
            "general": _viability(documents),
        },
    }


def _number(value) -> str:
    return f"{value:,}".replace(",", ".")


def render_markdown(report: dict) -> str:
    years = report.get("metadata", {}).get("years", [])
    window = f"{min(years)}–{max(years)}" if years else "não informada"
    dataset = report["dataset"]
    text = report["text_quality"]
    coverage = report["label_coverage"]
    taxonomy = report["taxonomy"]
    multilabel = report["multilabel"]
    duplicates = report["duplicates"]

    lines = [
        "# Análise do Dataset Legislativo",
        "",
        f"Janela analisada: **{window}**.",
        "",
        "> Nenhum modelo foi treinado. Este artefato descreve somente coleta, qualidade e viabilidade dos dados.",
        "",
        "## Resumo",
        "",
        f"- Documentos: {_number(dataset['total_documents'])}",
        f"- Câmara: {_number(dataset['documents_by_source'].get('CAMARA', 0))}",
        f"- Senado: {_number(dataset['documents_by_source'].get('SENADO', 0))}",
        f"- Ementas válidas: {_number(text['valid'])} ({text['valid_percentage']:.2f}%)",
        f"- Documentos rotulados: {_number(coverage['with_labels'])} ({coverage['percentage_labeled']:.2f}%)",
        f"- Candidatos a treinamento: {_number(report['training_dataset']['documents'])}",
        "",
        "## Qualidade textual",
        "",
        f"- Vazias: {_number(text['empty'])}",
        f"- Ausentes: {_number(text['missing'])}",
        f"- Extremamente curtas (< 40 caracteres): {_number(text['short'])}",
        "",
        "## Análise por Casa",
        "",
        "| Fonte | Documentos | Ementa válida | Com label | Cobertura | Temas observados/oficiais | Média de labels |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for source in ("CAMARA", "SENADO"):
        item = report["source_analysis"][source]
        lines.append(
            f"| {source} | {_number(item['documents'])} | {_number(item['valid_text'])} | {_number(item['with_labels'])} | {item['percentage_labeled']:.2f}% | {item['observed_themes']}/{item['official_themes']} | {item['multilabel']['average']:.4f} |"
        )
    lines.extend(
        [
        "",
        "## Taxonomia oficial",
        "",
        f"Temas oficiais por identidade `source + code`: **{taxonomy['number_of_official_themes']}**; observados na janela: **{taxonomy['number_of_observed_themes']}**.",
        "",
        f"Maior classe: **{taxonomy['largest_class']['name'] if taxonomy['largest_class'] else 'nenhuma'}** ({_number(taxonomy['largest_class']['documents']) if taxonomy['largest_class'] else 0}). Menor classe observada: **{taxonomy['smallest_observed_class']['name'] if taxonomy['smallest_observed_class'] else 'nenhuma'}** ({_number(taxonomy['smallest_observed_class']['documents']) if taxonomy['smallest_observed_class'] else 0}).",
        f"Média por classe observada: {taxonomy['mean_documents_per_observed_class']:.2f}; mediana: {taxonomy['median_documents_per_observed_class']:.2f}; classes com menos de 50 exemplos: {taxonomy['rare_classes_under_50']}; com menos de 10: {taxonomy['extremely_rare_classes_under_10']}.",
        "",
        "| Fonte | Código | Tema | Documentos | % dos rotulados |",
        "|---|---:|---|---:|---:|",
        ]
    )
    for item in taxonomy["classes"]:
        lines.append(
            f"| {item['source']} | {item['code']} | {item['name']} | {_number(item['documents'])} | {item['percentage_of_source_labeled_documents']:.2f}% |"
        )
    lines.extend(
        [
            "",
            "## Multi-label",
            "",
            f"- 1 label: {_number(multilabel['one_label'])}",
            f"- 2 labels: {_number(multilabel['two_labels'])}",
            f"- 3 labels: {_number(multilabel['three_labels'])}",
            f"- Mais de 3 labels: {_number(multilabel['more_than_three_labels'])}",
            f"- Média: {multilabel['average']:.4f}",
            f"- Máximo: {multilabel['maximum']}",
            "",
            "## Coocorrência",
            "",
            "| Fonte | Tema A | Tema B | Documentos |",
            "|---|---|---|---:|",
        ]
    )
    for item in report["cooccurrence"]:
        lines.append(
            f"| {item['source']} | {item['left']['name']} | {item['right']['name']} | {_number(item['count'])} |"
        )
    lines.extend(
        [
            "",
            "## Duplicidades e conflitos",
            "",
            f"- Linhas com ID repetido: {_number(duplicates.get('duplicate_id_rows', 0))}",
            f"- Identidades com conteúdo conflitante: {_number(duplicates.get('conflicting_duplicate_identities', 0))}",
            f"- Grupos de ementas repetidas: {_number(duplicates.get('duplicate_ementa_groups', 0))}",
            f"- Grupos de ementas iguais com labels diferentes: {_number(duplicates.get('duplicate_ementa_conflicting_label_groups', 0))}",
            f"- Relações de label órfãs: {_number(duplicates.get('orphan_label_assignments', 0))}",
            "",
            "## Viabilidade",
            "",
            f"- Câmara: **{report['viability']['CAMARA']['level']}**",
            f"- Senado: **{report['viability']['SENADO']['level']}**",
            f"- Geral: **{report['viability']['general']['level']}**",
            "",
            "## Recomendação para taxonomia",
            "",
            f"- Manter inicialmente sem agrupamento: {_number(len(report['taxonomy_recommendation']['keep_without_grouping_candidates']))} classes com pelo menos 50 exemplos.",
            f"- Revisar por raridade: {_number(len(report['taxonomy_recommendation']['rare_classes_to_review']))} classes com 1 a 49 exemplos.",
            f"- Sem exemplos na janela: {_number(len(report['taxonomy_recommendation']['classes_without_examples']))} classes.",
            f"- Nomes iguais entre Casas a revisar sem mesclar automaticamente: {', '.join(item['name'] for item in report['taxonomy_recommendation']['same_names_across_sources_to_review']) or 'nenhum'}.",
            "",
            "## Riscos para fases futuras",
            "",
            "- A mesma ementa pode pertencer a IDs diferentes; o split futuro deve agrupar textos duplicados para evitar leakage.",
            "- As taxonomias da Câmara e do Senado não são equivalentes e não devem ser mescladas apenas por semelhança nominal.",
            "- Classes raras e forte desbalanceamento exigirão decisão explícita antes do treino.",
            "- Campos de tramitação e situação não foram usados como feature, evitando leakage temporal nesta preparação.",
            "",
        ]
    )
    return "\n".join(lines)
