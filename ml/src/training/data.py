import json
from pathlib import Path

from ..preprocessing.dataset import normalize_text, read_jsonl_gz


def _code_sort_key(item: dict) -> tuple[int, int | str]:
    code = str(item["code"])
    return (0, int(code)) if code.isdigit() else (1, code)


def load_camara_training_data(
    dataset_path: Path, taxonomy_path: Path
) -> tuple[list[dict], list[dict]]:
    taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8-sig"))
    classes = sorted(
        (
            {
                "code": str(item["code"]),
                "name": item["name"],
                "path": item.get("path"),
            }
            for item in taxonomy
            if item.get("source") == "CAMARA"
        ),
        key=_code_sort_key,
    )
    codes = [item["code"] for item in classes]
    if len(codes) != len(set(codes)):
        raise ValueError("A taxonomia da Câmara contém código duplicado.")
    official_codes = set(codes)

    documents = []
    for raw in read_jsonl_gz(dataset_path):
        external_id = raw.get("external_id")
        labels = raw.get("labels") or []
        label_codes = {str(item.get("code", "")) for item in labels}
        text = normalize_text(raw.get("ementa"))
        if (
            raw.get("source") != "CAMARA"
            or not isinstance(external_id, int)
            or isinstance(external_id, bool)
            or external_id <= 0
            or raw.get("ementa_status") != "valid"
            or not text
            or not label_codes
            or not label_codes.issubset(official_codes)
        ):
            continue
        document = dict(raw)
        document["ementa"] = text
        document["labels"] = sorted(
            (
                {
                    "code": str(label["code"]),
                    "name": label["name"],
                    "path": label.get("path"),
                }
                for label in labels
            ),
            key=_code_sort_key,
        )
        documents.append(document)

    documents.sort(key=lambda item: (item["external_id"], item["document_id"]))
    return documents, classes
