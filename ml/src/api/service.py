import logging
from pathlib import Path

import numpy as np

from ..preprocessing.dataset import normalize_text
from ..training.artifacts import ARTIFACT_FILES, load_artifacts


logger = logging.getLogger(__name__)


class ArtifactLoadError(RuntimeError):
    """Raised when the persisted serving bundle is absent or incompatible."""


class PredictionService:
    def __init__(self, model, vectorizer, label_binarizer, metadata: dict):
        self.model = model
        self.vectorizer = vectorizer
        self.label_binarizer = label_binarizer
        self.metadata = metadata
        self._classes, self._threshold = self._validate_bundle()

    @classmethod
    def from_artifacts(cls, artifacts_dir: Path) -> "PredictionService":
        missing = [
            filename
            for filename in ARTIFACT_FILES.values()
            if not (artifacts_dir / filename).is_file()
        ]
        if missing:
            raise ArtifactLoadError(
                f"Artefatos obrigatórios ausentes: {', '.join(missing)}."
            )
        try:
            artifacts = load_artifacts(artifacts_dir)
            return cls(
                artifacts["model"],
                artifacts["vectorizer"],
                artifacts["label_binarizer"],
                artifacts["metadata"],
            )
        except ArtifactLoadError:
            raise
        except Exception as error:
            raise ArtifactLoadError(
                f"Falha ao carregar ou validar artefatos: {error}"
            ) from error

    def _validate_bundle(self) -> tuple[list[dict], float]:
        if not callable(getattr(self.vectorizer, "transform", None)):
            raise ArtifactLoadError("O vectorizer não oferece transform.")
        if not callable(getattr(self.model, "decision_function", None)):
            raise ArtifactLoadError("O modelo não oferece decision_function.")
        persisted_codes = getattr(self.label_binarizer, "classes_", None)
        if persisted_codes is None:
            raise ArtifactLoadError("O label binarizer não possui classes persistidas.")

        required_metadata = {
            "model_name",
            "model_version",
            "source",
            "years",
            "classes",
            "class_count",
            "model_config",
        }
        missing = required_metadata - self.metadata.keys()
        if missing:
            raise ArtifactLoadError(
                f"Metadata incompleto; campos ausentes: {sorted(missing)}."
            )
        classes = self.metadata["classes"]
        if not isinstance(classes, list) or not classes:
            raise ArtifactLoadError("Metadata não contém classes utilizáveis.")
        metadata_codes = [str(item.get("code", "")) for item in classes]
        binarizer_codes = [str(code) for code in persisted_codes]
        if metadata_codes != binarizer_codes:
            raise ArtifactLoadError(
                "A ordem das classes no metadata diverge do label binarizer."
            )
        if self.metadata["class_count"] != len(classes):
            raise ArtifactLoadError("A contagem de classes no metadata é incompatível.")
        if any(not code or not item.get("name") for code, item in zip(metadata_codes, classes)):
            raise ArtifactLoadError("Metadata contém código ou nome de classe inválido.")

        config = self.metadata["model_config"]
        if config.get("algorithm") != "LinearSVC":
            raise ArtifactLoadError("O artefato selecionado não é LinearSVC.")
        threshold = config.get("threshold")
        if not isinstance(threshold, (int, float)):
            raise ArtifactLoadError("O threshold do modelo não é numérico.")
        return classes, float(threshold)

    def health(self) -> dict:
        return {
            "status": "ok",
            "modelLoaded": True,
            "modelName": self.metadata["model_name"],
            "modelVersion": self.metadata["model_version"],
            "classes": len(self._classes),
        }

    def predict(self, text: str) -> dict:
        normalized = normalize_text(text)
        if not normalized:
            raise ValueError("O texto normalizado está vazio.")
        features = self.vectorizer.transform([normalized])
        scores = np.asarray(self.model.decision_function(features), dtype=float)
        if scores.ndim == 2:
            if scores.shape[0] != 1:
                raise RuntimeError("O modelo retornou mais de uma linha para uma predição.")
            scores = scores[0]
        if scores.ndim != 1 or scores.shape[0] != len(self._classes):
            raise RuntimeError("O modelo retornou decision scores incompatíveis.")

        positive = [
            {
                "code": str(self.label_binarizer.classes_[index]),
                "name": self._classes[index]["name"],
                "decisionScore": float(score),
                "_index": index,
            }
            for index, score in enumerate(scores)
            if score > self._threshold
        ]
        positive.sort(key=lambda item: (-item["decisionScore"], item["_index"]))
        for item in positive:
            del item["_index"]
        return {
            "labels": positive,
            "labelCount": len(positive),
            "model": {
                "name": self.metadata["model_name"],
                "version": self.metadata["model_version"],
                "source": self.metadata["source"],
                "years": self.metadata["years"],
            },
        }
