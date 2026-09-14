import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request

from .schemas import (
    MAX_TEXT_LENGTH,
    HealthResponse,
    PredictRequest,
    PredictResponse,
)
from .service import ArtifactLoadError, PredictionService


logger = logging.getLogger(__name__)


def resolve_artifacts_dir(explicit: Path | None = None) -> Path:
    if explicit is not None:
        return explicit.resolve()
    configured = os.getenv("ML_ARTIFACTS_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[2] / "artifacts"


def create_app(
    artifacts_dir: Path | None = None,
    service: PredictionService | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        try:
            inference = service or PredictionService.from_artifacts(
                resolve_artifacts_dir(artifacts_dir)
            )
        except ArtifactLoadError as error:
            logger.critical("Falha no startup dos artefatos de ML: %s", error)
            raise RuntimeError(f"Falha no startup dos artefatos de ML: {error}") from error
        application.state.prediction_service = inference
        health = inference.health()
        logger.info(
            "Modelo carregado: name=%s version=%s classes=%s",
            health["modelName"],
            health["modelVersion"],
            health["classes"],
        )
        yield

    application = FastAPI(
        title="Serviço interno de classificação temática legislativa",
        description=(
            "Classifica ementas nos temas oficiais da Câmara com TF-IDF e "
            "LinearSVC. Decision scores não são probabilidades."
        ),
        version="1.0.0-experimental",
        lifespan=lifespan,
    )

    @application.get(
        "/health",
        response_model=HealthResponse,
        summary="Verifica readiness dos artefatos de ML",
    )
    def health(request: Request):
        return request.app.state.prediction_service.health()

    @application.post(
        "/predict",
        response_model=PredictResponse,
        summary="Classifica uma ementa nos temas oficiais da Câmara",
    )
    def predict(payload: PredictRequest, request: Request):
        try:
            result = request.app.state.prediction_service.predict(payload.text)
        except Exception as error:
            logger.exception("Falha de inferência sem registrar o texto da requisição.")
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "INFERENCE_ERROR",
                    "message": "Não foi possível classificar o texto informado.",
                },
            ) from error
        logger.info("Predição concluída: label_count=%s", result["labelCount"])
        return result

    return application


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "src.api.app:app",
        host=os.getenv("ML_HOST", "0.0.0.0"),
        port=int(os.getenv("ML_PORT", "8001")),
    )


if __name__ == "__main__":
    main()
