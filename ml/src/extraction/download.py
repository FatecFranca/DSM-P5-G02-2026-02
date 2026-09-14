import hashlib
import json
import time
from datetime import datetime, timezone
from http.client import IncompleteRead
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .official_sources import flatten_senado_taxonomy


CAMARA_PROPOSICOES_URL = (
    "https://dadosabertos.camara.leg.br/arquivos/proposicoes/csv/"
    "proposicoes-{year}.csv"
)
CAMARA_TEMAS_URL = (
    "https://dadosabertos.camara.leg.br/arquivos/proposicoesTemas/csv/"
    "proposicoesTemas-{year}.csv"
)
CAMARA_TAXONOMY_URL = (
    "https://dadosabertos.camara.leg.br/api/v2/referencias/proposicoes/codTema"
)
SENADO_PROCESSOS_URL = (
    "https://legis.senado.leg.br/dadosabertos/processo.csv?ano={year}"
)
SENADO_CLASSES_URL = "https://legis.senado.leg.br/dadosabertos/processo/classes"
SENADO_CLASSE_PROCESSOS_URL = (
    "https://legis.senado.leg.br/dadosabertos/processo.csv?codigoClasse={code}"
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _metadata(
    destination: Path,
    url: str,
    source: str,
    reused: bool,
    headers=None,
) -> dict:
    return {
        "source": source,
        "url": url,
        "path": str(destination),
        "bytes": destination.stat().st_size,
        "sha256": _sha256(destination),
        "etag": headers.get("ETag") if headers else None,
        "last_modified": headers.get("Last-Modified") if headers else None,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "reused": reused,
    }


def download_file(
    url: str,
    destination: Path,
    source: str,
    *,
    force: bool = False,
    retries: int = 3,
    timeout_seconds: int = 180,
    previous_metadata: dict | None = None,
) -> dict:
    if destination.is_file() and not force:
        digest = _sha256(destination)
        if previous_metadata and previous_metadata.get("sha256") != digest:
            raise RuntimeError(
                f"Arquivo local diverge do manifesto anterior: {destination.name}"
            )
        now = datetime.now(timezone.utc).isoformat()
        metadata = dict(previous_metadata or {})
        metadata.update(
            {
                "source": source,
                "url": url,
                "path": str(destination),
                "bytes": destination.stat().st_size,
                "sha256": digest,
                "retrieved_at": metadata.get("retrieved_at"),
                "verified_at": now,
                "reused": True,
            }
        )
        return metadata

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.name}.part")
    request = Request(
        url,
        headers={
            "Accept": "text/csv, application/json;q=0.9, */*;q=0.8",
            "User-Agent": "DSM-P5-G02-dataset-research/1.0",
        },
    )
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                with temporary.open("wb") as target:
                    while chunk := response.read(1024 * 1024):
                        target.write(chunk)
                temporary.replace(destination)
                return _metadata(
                    destination, url, source, False, response.headers
                )
        except (HTTPError, URLError, IncompleteRead, TimeoutError, OSError) as error:
            last_error = error
            temporary.unlink(missing_ok=True)
            retryable = not isinstance(error, HTTPError) or error.code in {
                408,
                429,
                500,
                502,
                503,
                504,
            }
            if not retryable or attempt == retries - 1:
                break
            time.sleep(2**attempt)
    raise RuntimeError(f"Falha ao baixar fonte oficial: {url}") from last_error


def extract_official_data(
    root: Path,
    years: list[int],
    sources: set[str],
    *,
    force: bool = False,
    delay_seconds: float = 0.1,
) -> dict:
    raw = root / "data" / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest_path = raw / "extraction-manifest.json"
    previous_manifest = (
        json.loads(manifest_path.read_text("utf-8"))
        if manifest_path.is_file()
        else {}
    )
    previous_by_filename = {
        Path(item["path"]).name: item for item in previous_manifest.get("files", [])
    }
    marker = raw / ".extraction-incomplete"
    marker.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
    manifest_path.unlink(missing_ok=True)
    files: list[dict] = []

    def fetch(url: str, destination: Path, source: str) -> dict:
        item = download_file(
            url,
            destination,
            source,
            force=force,
            previous_metadata=previous_by_filename.get(destination.name),
        )
        item["path"] = destination.relative_to(root).as_posix()
        return item

    if "CAMARA" in sources:
        for year in years:
            resources = (
                (
                    "proposicoes",
                    CAMARA_PROPOSICOES_URL.format(year=year),
                    raw / "camara" / "proposicoes" / f"proposicoes-{year}.csv",
                ),
                (
                    "proposicoes_temas",
                    CAMARA_TEMAS_URL.format(year=year),
                    raw / "camara" / "temas" / f"proposicoesTemas-{year}.csv",
                ),
            )
            for resource, url, destination in resources:
                item = fetch(url, destination, "CAMARA")
                item.update({"resource": resource, "year": year})
                files.append(item)
        taxonomy_destination = raw / "camara" / "temas" / "taxonomy.json"
        taxonomy_item = fetch(CAMARA_TAXONOMY_URL, taxonomy_destination, "CAMARA")
        taxonomy_item.update({"resource": "temas_taxonomia"})
        files.append(taxonomy_item)

    if "SENADO" in sources:
        for year in years:
            destination = (
                raw / "senado" / "processos" / f"processos-{year}.csv"
            )
            item = fetch(
                SENADO_PROCESSOS_URL.format(year=year),
                destination,
                "SENADO",
            )
            item.update({"resource": "processos", "year": year})
            files.append(item)

        taxonomy_path = raw / "senado" / "classes" / "classes.json"
        taxonomy_item = fetch(
            SENADO_CLASSES_URL,
            taxonomy_path,
            "SENADO",
        )
        taxonomy_item.update({"resource": "classes"})
        files.append(taxonomy_item)
        taxonomy = flatten_senado_taxonomy(
            json.loads(taxonomy_path.read_text(encoding="utf-8-sig"))
        )
        for index, label in enumerate(taxonomy, start=1):
            code = label["code"]
            destination = (
                raw
                / "senado"
                / "classes"
                / f"processos-classe-{code}.csv"
            )
            item = fetch(
                SENADO_CLASSE_PROCESSOS_URL.format(code=code),
                destination,
                "SENADO",
            )
            item.update(
                {
                    "resource": "processos_classe",
                    "class_code": code,
                    "class_name": label["name"],
                }
            )
            files.append(item)
            if delay_seconds and not item["reused"]:
                time.sleep(delay_seconds)
            if index % 20 == 0 or index == len(taxonomy):
                print(f"Senado: {index}/{len(taxonomy)} classes extraídas.")

    manifest = {
        "schema_version": 1,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "years": years,
        "sources": sorted(sources),
        "files": files,
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    marker.unlink()
    return manifest
