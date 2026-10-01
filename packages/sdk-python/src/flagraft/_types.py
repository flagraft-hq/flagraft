from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, TypeAlias, TypedDict

ContextValue: TypeAlias = str | int | float | bool | datetime
Context: TypeAlias = Mapping[str, ContextValue]


class Feature(TypedDict):
    name: str
    enabled: bool


class EvaluationResult(TypedDict):
    name: str
    enabled: bool
    reason: Literal["disabled", "strategy-match", "default"]


@dataclass(frozen=True)
class StaleEvent:
    flag_key: str | None
    fetched_at: datetime
