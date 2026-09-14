import gzip
import io
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Iterable, Iterator


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFC", value).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", normalized).strip()


def _valid_id(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _label_sort_key(label: dict) -> tuple[int, int | str]:
    code = str(label["code"])
    return (0, int(code)) if code.isdigit() else (1, code)


def build_dataset(
    documents: Iterable[dict], assignments: Iterable[tuple[str, object, dict]]
) -> tuple[list[dict], dict]:
    grouped_documents: dict[tuple, list[dict]] = defaultdict(list)
    invalid_ids = 0
    raw_document_rows = 0
    for index, raw in enumerate(documents):
        raw_document_rows += 1
        source = raw.get("source")
        external_id = raw.get("external_id")
        valid_identity = source in {"CAMARA", "SENADO"} and _valid_id(external_id)
        if not valid_identity:
            invalid_ids += 1
        key = (
            (source, external_id)
            if valid_identity
            else ("__INVALID__", index, source, external_id)
        )
        ementa = normalize_text(raw.get("ementa"))
        present = bool(raw.get("ementa_present", "ementa" in raw))
        status = "valid" if ementa else ("empty" if present else "missing")
        grouped_documents[key].append(
            {
                "document_id": f"{source}:{external_id}",
                "source": source,
                "external_id": external_id,
                "ano": raw.get("ano"),
                "identification_year": raw.get("identification_year"),
                "partition_year": raw.get("partition_year"),
                "presentation_year": raw.get("presentation_year"),
                "tipo": normalize_text(raw.get("tipo")),
                "tipo_documento": normalize_text(raw.get("tipo_documento"))
                or None,
                "ementa": ementa,
                "ementa_status": status,
            }
        )

    labels_by_identity: dict[tuple, set[str]] = defaultdict(set)
    labels_by_code: dict[tuple[str, str], dict] = {}
    duplicate_label_assignments = 0
    invalid_label_assignments = 0
    label_name_conflicts: set[tuple] = set()
    orphan_label_assignments = 0
    valid_document_keys = {
        key for key in grouped_documents if key and key[0] != "__INVALID__"
    }
    for source, external_id, label in assignments:
        key = (source, external_id)
        if key not in valid_document_keys:
            orphan_label_assignments += 1
            continue
        code = str(label.get("code") or "").strip()
        normalized_label = {
            "code": code,
            "name": normalize_text(label.get("name")),
            "path": normalize_text(label.get("path")) or None,
        }
        if not normalized_label["code"] or not normalized_label["name"]:
            invalid_label_assignments += 1
            continue
        global_key = (source, code)
        existing = labels_by_code.get(global_key)
        if existing is None:
            labels_by_code[global_key] = normalized_label
        elif existing != normalized_label:
            label_name_conflicts.add((source, external_id, code))
            labels_by_code[global_key] = min(
                (existing, normalized_label), key=lambda item: json.dumps(item, sort_keys=True)
            )
        elif code in labels_by_identity[key]:
            duplicate_label_assignments += 1
        labels_by_identity[key].add(code)

    duplicate_id_rows = 0
    conflicting_duplicate_identities = 0
    dataset: list[dict] = []
    for key, candidates in grouped_documents.items():
        duplicate_id_rows += max(0, len(candidates) - 1)
        variants = {
            (
                item["ano"],
                item["identification_year"],
                item["presentation_year"],
                item["tipo"],
                item["ementa"],
                item["ementa_status"],
            )
            for item in candidates
        }
        has_conflict = len(variants) > 1
        if has_conflict:
            conflicting_duplicate_identities += 1
        canonical = max(
            candidates,
            key=lambda item: (
                item["ementa_status"] == "valid",
                len(item["ementa"]),
                str(item["ano"]),
                item["tipo"],
            ),
        )
        canonical = dict(canonical)
        canonical["labels"] = sorted(
            (
                labels_by_code[(canonical["source"], code)]
                for code in labels_by_identity.get(key, set())
            ),
            key=_label_sort_key,
        )
        canonical["duplicate_identity_conflict"] = has_conflict
        dataset.append(canonical)

    dataset.sort(key=lambda item: (str(item["source"]), str(item["external_id"])))

    ementa_groups: dict[str, list[dict]] = defaultdict(list)
    for document in dataset:
        if document["ementa"]:
            ementa_groups[document["ementa"]].append(document)
    duplicate_groups = [group for group in ementa_groups.values() if len(group) > 1]
    conflicting_groups = 0
    for group in duplicate_groups:
        label_sets = {
            tuple(
                (item["source"], label["code"], label["name"])
                for label in item["labels"]
            )
            for item in group
        }
        if len(label_sets) > 1:
            conflicting_groups += 1

    diagnostics = {
        "raw_document_rows": raw_document_rows,
        "unique_documents": len(dataset),
        "invalid_id_rows": invalid_ids,
        "duplicate_id_rows": duplicate_id_rows,
        "conflicting_duplicate_identities": conflicting_duplicate_identities,
        "duplicate_label_assignments": duplicate_label_assignments,
        "invalid_label_assignments": invalid_label_assignments,
        "label_name_conflicts": len(label_name_conflicts),
        "orphan_label_assignments": orphan_label_assignments,
        "duplicate_ementa_groups": len(duplicate_groups),
        "duplicate_ementa_documents": sum(len(group) for group in duplicate_groups),
        "duplicate_ementa_conflicting_label_groups": conflicting_groups,
    }
    return dataset, diagnostics


def is_training_candidate(document: dict) -> bool:
    return (
        document.get("source") in {"CAMARA", "SENADO"}
        and _valid_id(document.get("external_id"))
        and document.get("ementa_status") == "valid"
        and bool(document.get("labels"))
        and not document.get("duplicate_identity_conflict", False)
    )


def write_jsonl_gz(destination: Path, records: Iterable[dict]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.name}.part")
    with temporary.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
            with io.TextIOWrapper(compressed, encoding="utf-8", newline="\n") as target:
                for record in records:
                    target.write(json.dumps(record, ensure_ascii=False, sort_keys=True))
                    target.write("\n")
    temporary.replace(destination)


def read_jsonl_gz(source: Path) -> Iterator[dict]:
    with gzip.open(source, "rt", encoding="utf-8") as records:
        for line in records:
            if line.strip():
                yield json.loads(line)
