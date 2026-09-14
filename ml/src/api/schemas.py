from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..preprocessing.dataset import normalize_text


MAX_TEXT_LENGTH = 5_000


def _to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class PredictRequest(ApiModel):
    text: str = Field(
        strict=True,
        min_length=1,
        max_length=MAX_TEXT_LENGTH,
        description="Ementa legislativa a classificar, limitada a 5.000 caracteres.",
    )

    @field_validator("text")
    @classmethod
    def normalize_and_reject_blank(cls, value: str) -> str:
        normalized = normalize_text(value)
        if not normalized:
            raise ValueError("O texto não pode conter somente espaços.")
        return normalized


class HealthResponse(ApiModel):
    status: str
    model_loaded: bool
    model_name: str
    model_version: str
    classes: int


class PredictedLabel(ApiModel):
    code: str
    name: str
    decision_score: float = Field(
        description="Margem técnica do LinearSVC; não é probabilidade."
    )


class ModelSummary(ApiModel):
    name: str
    version: str
    source: str
    years: list[int]


class PredictResponse(ApiModel):
    labels: list[PredictedLabel]
    label_count: int
    model: ModelSummary
