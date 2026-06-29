"""ORACLE analytics contracts — used by Layer 7 and consumed by orchestrator."""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class InsightCard(BaseModel):
    severity: Literal["high", "medium", "info"]
    title: str
    what: str
    why: str
    where_: str = Field(alias="where")
    recommend: str
    metric_name: Optional[str] = None
    metric_delta: Optional[str] = None
    affected_customers: Optional[int] = None

    model_config = {"populate_by_name": True}


class OracleCycleResult(BaseModel):
    cycle: Literal["retrain", "refine", "route", "narrate"]
    run_date: date
    summary: str
    insight_cards: list[InsightCard] = Field(default_factory=list)
    artifacts: dict[str, str] = Field(default_factory=dict)
