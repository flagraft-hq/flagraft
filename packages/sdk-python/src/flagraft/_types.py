from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, NotRequired, TypeAlias, TypedDict

ContextValue: TypeAlias = str | int | float | bool | datetime
Context: TypeAlias = Mapping[str, ContextValue]


class VariantPayload(TypedDict):
    type: Literal["string", "json", "csv", "number"]
    value: str


class EvaluatedVariant(TypedDict):
    name: str
    enabled: bool
    payload: NotRequired[VariantPayload]


class Variant(EvaluatedVariant):
    feature_enabled: bool


class Feature(TypedDict):
    name: str
    enabled: bool
    variant: NotRequired[EvaluatedVariant]


class EvaluationResult(TypedDict):
    name: str
    enabled: bool
    variant: NotRequired[EvaluatedVariant]
    reason: Literal["disabled", "strategy-match", "default"]


@dataclass(frozen=True)
class StaleEvent:
    flag_key: str | None
    fetched_at: datetime
