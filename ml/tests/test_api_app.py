from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.app import MAX_TEXT_LENGTH, create_app
from tests.test_api_service import service


def test_health_is_ready_only_with_loaded_model():
    with TestClient(create_app(service=service())) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "modelLoaded": True,
        "modelName": "linear_svc_balanced",
        "modelVersion": "experimental-1",
        "classes": 3,
    }


def test_predict_returns_validated_multilabel_response():
    with TestClient(create_app(service=service())) as client:
        response = client.post(
            "/predict", json={"text": "Institui política pública de educação."}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["labelCount"] == 2
    assert [item["code"] for item in body["labels"]] == ["46", "34"]
    assert all("decisionScore" in item for item in body["labels"])
    assert "probability" not in response.text


@pytest.mark.parametrize(
    "payload",
    [None, {}, {"text": None}, {"text": 123}, {"text": ""}, {"text": "   \n"}],
)
def test_predict_rejects_missing_invalid_or_blank_text(payload):
    with TestClient(create_app(service=service())) as client:
        response = client.post("/predict", json=payload)

    assert response.status_code == 422


def test_predict_rejects_text_above_documented_limit_without_truncating():
    with TestClient(create_app(service=service())) as client:
        response = client.post(
            "/predict", json={"text": "a" * (MAX_TEXT_LENGTH + 1)}
        )

    assert response.status_code == 422


def test_swagger_and_openapi_document_health_and_predict():
    with TestClient(create_app(service=service())) as client:
        docs = client.get("/docs")
        schema = client.get("/openapi.json")

    assert docs.status_code == 200
    assert schema.status_code == 200
    assert set(schema.json()["paths"]) == {"/health", "/predict"}


def test_startup_fails_when_required_artifacts_cannot_be_loaded(tmp_path: Path):
    application = create_app(artifacts_dir=tmp_path)

    with pytest.raises(RuntimeError, match="artefatos"):
        with TestClient(application):
            pass
