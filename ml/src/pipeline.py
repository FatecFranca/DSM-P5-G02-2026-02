import argparse
import gc
import json
from datetime import datetime, timezone
from pathlib import Path

from .analysis.report import analyze_dataset, render_markdown
from .extraction.download import extract_official_data
from .extraction.official_sources import (
    flatten_senado_taxonomy,
    parse_camara_documents,
    parse_camara_labels,
    parse_camara_taxonomy,
    parse_senado_class_assignments,
    parse_senado_documents,
)
from .preprocessing.dataset import (
    build_dataset,
    is_training_candidate,
    read_jsonl_gz,
    write_jsonl_gz,
)


DEFAULT_YEARS = [2023, 2024, 2025]


def _read_json(path: Path, default):
    return json.loads(path.read_text("utf-8-sig")) if path.is_file() else default


def _required(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError(f"Arquivo obrigatório ausente: {path.name}")
    return path


def prepare_data(
    root: Path, years: list[int], sources: set[str] | None = None
) -> dict:
    raw = root / "data" / "raw"
    processed = root / "data" / "processed"
    sources = sources or {"CAMARA", "SENADO"}
    if (raw / ".extraction-incomplete").exists():
        raise RuntimeError("A extração anterior não foi concluída.")
    documents: list[dict] = []
    assignments: list[tuple[str, object, dict]] = []

    for year in years:
        camara_documents = (
            raw / "camara" / "proposicoes" / f"proposicoes-{year}.csv"
        )
        camara_labels = (
            raw / "camara" / "temas" / f"proposicoesTemas-{year}.csv"
        )
        senado_documents = (
            raw / "senado" / "processos" / f"processos-{year}.csv"
        )
        if "CAMARA" in sources:
            _required(camara_documents)
            _required(camara_labels)
            documents.extend(parse_camara_documents(camara_documents))
            assignments.extend(
                ("CAMARA", external_id, label)
                for external_id, label in parse_camara_labels(camara_labels)
            )
        if "SENADO" in sources:
            _required(senado_documents)
            documents.extend(parse_senado_documents(senado_documents))

    selected_senado_ids = {
        item["external_id"]
        for item in documents
        if item["source"] == "SENADO"
        and isinstance(item["external_id"], int)
        and item["external_id"] > 0
    }
    taxonomy_path = raw / "senado" / "classes" / "classes.json"
    senado_taxonomy = flatten_senado_taxonomy(
        _read_json(_required(taxonomy_path), []) if "SENADO" in sources else []
    )
    senado_assignments_outside_window = 0
    for label in senado_taxonomy:
        class_path = (
            raw
            / "senado"
            / "classes"
            / f"processos-classe-{label['code']}.csv"
        )
        _required(class_path)
        if class_path.stat().st_size == 0:
            continue
        for external_id, assignment_label in parse_senado_class_assignments(
            class_path, label
        ):
            if external_id in selected_senado_ids:
                assignments.append(("SENADO", external_id, assignment_label))
            else:
                senado_assignments_outside_window += 1

    if not documents:
        raise RuntimeError("Nenhum arquivo anual foi encontrado para preparação.")

    dataset, diagnostics = build_dataset(documents, assignments)
    diagnostics["senado_class_assignments_outside_window"] = (
        senado_assignments_outside_window
    )
    training = [item for item in dataset if is_training_candidate(item)]
    write_jsonl_gz(processed / "all_documents.jsonl.gz", dataset)
    write_jsonl_gz(processed / "training_dataset.jsonl.gz", training)
    taxonomy = []
    if "CAMARA" in sources:
        taxonomy.extend(
            {"source": "CAMARA", **item}
            for item in parse_camara_taxonomy(
                _required(raw / "camara" / "temas" / "taxonomy.json")
            )
        )
    taxonomy.extend({"source": "SENADO", **item} for item in senado_taxonomy)
    taxonomy.sort(key=lambda item: (item["source"], int(item["code"])))
    (processed / "taxonomy.json").write_text(
        json.dumps(taxonomy, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (processed / "diagnostics.json").write_text(
        json.dumps(diagnostics, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    summary = {
        "schema_version": 1,
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "years": years,
        "sources": sorted(sources),
        "window_definition": "partições anuais nominais oficiais",
        "text_feature": "ementa",
        "normalization": ["Unicode NFC", "trim", "colapso de espaços"],
        "short_ementa_threshold": 40,
        "all_documents": len(dataset),
        "training_documents": len(training),
        "diagnostics": diagnostics,
    }
    (processed / "preparation-metadata.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return summary


def analyze_data(root: Path, years: list[int]) -> dict:
    processed = root / "data" / "processed"
    reports = root / "reports"
    diagnostics = _read_json(processed / "diagnostics.json", {})
    preparation = _read_json(processed / "preparation-metadata.json", {})
    prepared_years = preparation.get("years")
    if prepared_years != years:
        raise ValueError(
            f"A janela solicitada {years} difere da janela preparada {prepared_years}."
        )
    extraction = _read_json(root / "data" / "raw" / "extraction-manifest.json", {})
    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "years": years,
        "window_definition": preparation.get(
            "window_definition", "partições anuais nominais oficiais"
        ),
        "sources": preparation.get("sources", extraction.get("sources", [])),
        "extracted_at": extraction.get("extracted_at"),
        "raw_files": len(extraction.get("files", [])),
        "short_ementa_threshold": 40,
    }
    report = analyze_dataset(
        read_jsonl_gz(processed / "all_documents.jsonl.gz"),
        diagnostics,
        metadata,
        _read_json(processed / "taxonomy.json", []),
    )
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "dataset-analysis.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (reports / "dataset-analysis.md").write_text(
        render_markdown(report), encoding="utf-8"
    )
    return report


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extração e análise de dados legislativos oficiais."
    )
    parser.add_argument(
        "command", choices=("extract", "prepare", "analyze", "all")
    )
    parser.add_argument("--years", nargs="+", type=int, default=DEFAULT_YEARS)
    parser.add_argument(
        "--sources",
        nargs="+",
        choices=("CAMARA", "SENADO"),
        default=["CAMARA", "SENADO"],
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    return parser


def main() -> None:
    arguments = _parser().parse_args()
    years = sorted(set(arguments.years))
    root = arguments.root.resolve()
    if arguments.command in {"extract", "all"}:
        manifest = extract_official_data(
            root, years, set(arguments.sources), force=arguments.force
        )
        print(f"Extração concluída: {len(manifest['files'])} arquivos.")
    if arguments.command in {"prepare", "all"}:
        preparation = prepare_data(root, years, set(arguments.sources))
        print(
            "Preparação concluída: "
            f"{preparation['all_documents']} documentos; "
            f"{preparation['training_documents']} candidatos."
        )
        gc.collect()
    if arguments.command in {"analyze", "all"}:
        report = analyze_data(root, years)
        print(
            "Análise concluída: "
            f"{report['taxonomy']['number_of_themes']} temas oficiais."
        )


if __name__ == "__main__":
    main()
