"""Domain model for evidence-backed practice observations.

A PracticeObservation represents one observation extracted from one evidence
item within one projection. Similar observations across evidence items or
projections intentionally remain independent; this model does not represent
canonical or aggregated practices.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class SelectionCondition(str, Enum):
    CONTEXT = "context"
    EXECUTION = "execution"
    VERIFICATION = "verification"
    COORDINATION = "coordination"
    OBSERVABILITY = "observability"
    ECONOMICS = "economics"
    LEARNING = "learning"


@dataclass(frozen=True)
class PracticeObservation:
    id: str
    projection_id: str
    evidence_id: str
    use_case: str
    problem: str
    reported_practice: str
    selection_conditions: tuple[SelectionCondition, ...]

    def __post_init__(self) -> None:
        for field_name in (
            "id",
            "projection_id",
            "evidence_id",
            "use_case",
            "problem",
            "reported_practice",
        ):
            value = getattr(self, field_name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field_name} must be a non-empty string")

        if not self.selection_conditions:
            raise ValueError("selection_conditions must contain at least one condition")

        if any(not isinstance(condition, SelectionCondition) for condition in self.selection_conditions):
            raise ValueError("selection_conditions must contain only SelectionCondition values")

        if len(set(self.selection_conditions)) != len(self.selection_conditions):
            raise ValueError("selection_conditions must not contain duplicates")
