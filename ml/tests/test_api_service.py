import json
import tempfile
from pathlib import Path

import joblib
import numpy as np
import pytest

from src.api.service import ArtifactLoadError, PredictionService


class FakeVectorizer:
    def __init__(self):
        self.transformed = []
        self.fit_called = False

    def transform(self, texts):
        self.transformed.append(list(texts))
        return np.ones((len(texts), 2))

    def fit(self, *_args, **_kwargs):
        self.fit_called = True
        raise AssertionError("fit não pode ser chamado em serving")

    def fit_transform(self, *_args, **_kwargs):
        self.fit_called = True
        raise AssertionError("fit_transform não pode ser chamado em serving")


class FakeModel:
    def __init__(self, scores):
        self.scores = np.asarray(scores, dtype=float)
        self.decision_calls = 0
        self.fit_called = False

    def decision_function(self, features):
        self.decision_calls += 1
        return np.tile(self.scores, (features.shape[0], 1))

    def fit(self, *_args, **_kwargs):
        self.fit_called = True
        raise AssertionError("fit não pode ser chamado em serving")


class FakeBinarizer:
    def __init__(self):
        self.classes_ = np.asarray(["34", "46", "56"])


def metadata():
    return {
        "model_name": "linear_svc_balanced",
        "model_version": "experimental-1",
        "source": "CAMARA",
        "years": [2023, 2024, 2025],
        "class_count": 3,
        "classes": [
            {"index": 0, "code": "34", "name": "Administração Pública"},
            {"index": 1, "code": "46", "name": "Educação"},
            {"index": 2, "code": "56", "name": "Saúde"},
        ],
        "model_config": {"algorithm": "LinearSVC", "threshold": 0.0},
    }


def service(scores=(0.2, 1.4, -0.1)):
    return PredictionService(
        FakeModel(scores), FakeVectorizer(), FakeBinarizer(), metadata()
    )


def test_predict_normalizes_with_training_preprocessing_and_never_fits():
    inference = service()

    result = inference.predict("  Institui\n política de educação.  ")

    assert inference.vectorizer.transformed == [
        ["Institui política de educação."]
    ]
    assert inference.vectorizer.fit_called is False
    assert inference.model.fit_called is False
    assert inference.model.decision_calls == 1
    assert [item["code"] for item in result["labels"]] == ["46", "34"]
    assert result["labels"][0]["decisionScore"] == pytest.approx(1.4)


def test_predict_returns_multiple_labels_ordered_by_score_and_model_metadata():
    result = service((0.4, 0.8, 1.2)).predict("Texto legislativo válido.")

    assert [item["name"] for item in result["labels"]] == [
        "Saúde",
        "Educação",
        "Administração Pública",
    ]
    assert result["labelCount"] == 3
    assert result["model"] == {
        "name": "linear_svc_balanced",
        "version": "experimental-1",
        "source": "CAMARA",
        "years": [2023, 2024, 2025],
    }


def test_predict_does_not_force_a_label_when_all_scores_are_non_positive():
    result = service((0.0, -0.1, -2.0)).predict("Texto fora das classes.")

    assert result["labels"] == []
    assert result["labelCount"] == 0


def test_loads_all_persisted_artifacts_once_and_exposes_health():
    with tempfile.TemporaryDirectory() as directory:
        artifacts = Path(directory)
        joblib.dump(FakeModel((0.1, -0.1, 0.2)), artifacts / "model.joblib")
        joblib.dump(FakeVectorizer(), artifacts / "vectorizer.joblib")
        joblib.dump(FakeBinarizer(), artifacts / "label_binarizer.joblib")
        (artifacts / "metadata.json").write_text(
            json.dumps(metadata(), ensure_ascii=False), encoding="utf-8"
        )

        inference = PredictionService.from_artifacts(artifacts)

    assert inference.health() == {
        "status": "ok",
        "modelLoaded": True,
        "modelName": "linear_svc_balanced",
        "modelVersion": "experimental-1",
        "classes": 3,
    }


def test_artifact_loading_fails_clearly_when_a_file_is_missing():
    with tempfile.TemporaryDirectory() as directory:
        with pytest.raises(ArtifactLoadError, match="model.joblib"):
            PredictionService.from_artifacts(Path(directory))


def test_rejects_incompatible_class_order_between_metadata_and_binarizer():
    incompatible = FakeBinarizer()
    incompatible.classes_ = np.asarray(["46", "34", "56"])

    with pytest.raises(ArtifactLoadError, match="ordem das classes"):
        PredictionService(
            FakeModel((0.1, 0.2, 0.3)),
            FakeVectorizer(),
            incompatible,
            metadata(),
        )
