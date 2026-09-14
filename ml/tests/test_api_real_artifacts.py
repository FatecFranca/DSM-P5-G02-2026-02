from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.preprocessing.dataset import normalize_text
from src.training.artifacts import load_artifacts


ROOT = Path(__file__).resolve().parents[1]


def test_api_matches_direct_model_predictions_with_real_artifacts():
    artifacts_dir = ROOT / "artifacts"
    artifacts = load_artifacts(artifacts_dir)
    texts = [
        "Requer informações ao Ministério da Saúde sobre a campanha de vacinação contra a gripe.",
        "Institui programa nacional de formação e valorização dos professores da educação básica.",
        "Institui programa de conectividade digital sustentável para escolas públicas da Amazônia Legal.",
    ]
    features = artifacts["vectorizer"].transform(
        [normalize_text(text) for text in texts]
    )
    expected = np.asarray(artifacts["model"].predict(features))
    expected_codes = [
        artifacts["label_binarizer"].classes_[np.flatnonzero(row)].tolist()
        for row in expected
    ]

    with TestClient(create_app(artifacts_dir=artifacts_dir)) as client:
        actual_codes = [
            [item["code"] for item in client.post("/predict", json={"text": text}).json()["labels"]]
            for text in texts
        ]

    assert [set(items) for items in actual_codes] == [
        set(items) for items in expected_codes
    ]
