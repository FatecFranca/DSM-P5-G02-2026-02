import json
import warnings
from pathlib import Path

import joblib


ARTIFACT_FILES = {
    "model": "model.joblib",
    "vectorizer": "vectorizer.joblib",
    "label_binarizer": "label_binarizer.joblib",
    "metadata": "metadata.json",
}

REQUIRED_METADATA = {
    "model_name",
    "model_version",
    "training_date",
    "source",
    "years",
    "classes",
    "class_count",
    "train_documents",
    "validation_documents",
    "test_documents",
    "random_seed",
    "tfidf_config",
    "model_config",
    "validation_metrics",
    "test_metrics",
}


def save_artifacts(
    destination: Path, model, vectorizer, label_binarizer, metadata: dict
) -> dict[str, Path]:
    missing = REQUIRED_METADATA - metadata.keys()
    if missing:
        raise ValueError(f"metadata incompleto; campos ausentes: {sorted(missing)}")
    destination.mkdir(parents=True, exist_ok=True)
    paths = {key: destination / filename for key, filename in ARTIFACT_FILES.items()}
    joblib.dump(model, paths["model"])
    joblib.dump(vectorizer, paths["vectorizer"])
    joblib.dump(label_binarizer, paths["label_binarizer"])
    paths["metadata"].write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return paths


def load_artifacts(source: Path) -> dict:
    # NumPy 2.5 deprecates an internal shape assignment still used by joblib 1.5.
    # It does not affect deserialization and should not leak into CLI/test output.
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Setting the shape on a NumPy array has been deprecated.*",
            category=DeprecationWarning,
            module=r"joblib\..*",
        )
        return {
            "model": joblib.load(source / ARTIFACT_FILES["model"]),
            "vectorizer": joblib.load(source / ARTIFACT_FILES["vectorizer"]),
            "label_binarizer": joblib.load(
                source / ARTIFACT_FILES["label_binarizer"]
            ),
            "metadata": json.loads(
                (source / ARTIFACT_FILES["metadata"]).read_text(encoding="utf-8")
            ),
        }
