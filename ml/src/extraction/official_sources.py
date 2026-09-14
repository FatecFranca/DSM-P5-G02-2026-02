import csv
import json
import re
from pathlib import Path
from typing import Iterator


def _rows(
    path: Path, delimiter: str, required_headers: set[str]
) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter=delimiter)
        headers = set(reader.fieldnames or [])
        if not required_headers.issubset(headers):
            missing = ", ".join(sorted(required_headers - headers))
            raise ValueError(
                f"CSV com cabeçalho incompatível em {path.name}; ausentes: {missing}."
            )
        yield from reader


def _integer(value: str | None) -> int | str | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    try:
        return int(normalized)
    except ValueError:
        return normalized


def _id_from_uri(value: str | None) -> int | str | None:
    match = re.search(r"/(\d+)/?$", (value or "").strip())
    return int(match.group(1)) if match else _integer(value)


def _year(value: str | None) -> int | None:
    normalized = (value or "").strip()[:4]
    return int(normalized) if normalized.isdigit() else None


def _partition_year(path: Path) -> int | None:
    match = re.search(r"-(\d{4})\.csv$", path.name)
    return int(match.group(1)) if match else None


def parse_camara_documents(path: Path) -> Iterator[dict]:
    for row in _rows(path, ";", {"id", "ano", "siglaTipo", "ementa"}):
        identification_year = _integer(row.get("ano"))
        presentation_year = _year(row.get("dataApresentacao"))
        yield {
            "source": "CAMARA",
            "external_id": _integer(row.get("id")),
            "ano": presentation_year or _partition_year(path),
            "identification_year": identification_year,
            "partition_year": _partition_year(path),
            "presentation_year": presentation_year,
            "tipo": (row.get("siglaTipo") or "").strip(),
            "ementa": row.get("ementa"),
            "ementa_present": "ementa" in row and row.get("ementa") is not None,
        }


def parse_camara_labels(path: Path) -> Iterator[tuple[int | str | None, dict]]:
    for row in _rows(path, ";", {"uriProposicao", "codTema", "tema"}):
        yield (
            _id_from_uri(row.get("uriProposicao")),
            {
                "code": str(row.get("codTema") or "").strip(),
                "name": (row.get("tema") or "").strip(),
                "path": None,
            },
        )


def parse_camara_taxonomy(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload.get("dados"), list):
        raise ValueError("Taxonomia da Câmara possui formato inválido.")
    taxonomy = []
    for item in payload["dados"]:
        code = str(item.get("cod") or "").strip()
        name = str(item.get("nome") or "").strip()
        if not code.isdigit() or not name:
            raise ValueError("Taxonomia da Câmara contém tema inválido.")
        taxonomy.append({"code": code, "name": name, "path": None})
    return taxonomy


def parse_senado_documents(path: Path) -> Iterator[dict]:
    for row in _rows(
        path,
        ",",
        {"id", "identificacao", "ementa", "tipoDocumento", "dataApresentacao"},
    ):
        identification = (row.get("identificacao") or "").strip()
        identification_year = re.search(r"/(\d{4})", identification)
        presentation_year = _year(row.get("dataApresentacao"))
        yield {
            "source": "SENADO",
            "external_id": _integer(row.get("id")),
            "ano": presentation_year or _partition_year(path),
            "identification_year": int(identification_year.group(1))
            if identification_year
            else None,
            "partition_year": _partition_year(path),
            "presentation_year": presentation_year,
            "tipo": identification.split(maxsplit=1)[0] if identification else "",
            "tipo_documento": (row.get("tipoDocumento") or "").strip(),
            "ementa": row.get("ementa"),
            "ementa_present": "ementa" in row and row.get("ementa") is not None,
        }


def parse_senado_class_assignments(
    path: Path, label: dict
) -> Iterator[tuple[int | str | None, dict]]:
    for row in _rows(path, ",", {"id"}):
        yield (_integer(row.get("id")), label)


def flatten_senado_taxonomy(nodes: list[dict]) -> list[dict]:
    flattened: list[dict] = []

    def visit(node: dict, parents: tuple[str, ...]) -> None:
        if not isinstance(node.get("codigo"), int) or node["codigo"] <= 0:
            raise ValueError("Taxonomia do Senado contém código inválido.")
        name = str(node["nome"]).strip()
        if not name:
            raise ValueError("Taxonomia do Senado contém nome vazio.")
        path = (*parents, name)
        flattened.append(
            {
                "code": str(node["codigo"]),
                "name": name,
                "path": " / ".join(path),
            }
        )
        for child in node.get("filhos") or []:
            visit(child, path)

    for root in nodes:
        visit(root, ())
    return flattened
