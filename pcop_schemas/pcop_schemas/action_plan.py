"""COMPASS action-plan contracts — used by Layer 4 and consumed by Layer 5."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .signal import SignalResult


class ActionPlan(BaseModel):
    channel: Optional[str] = None
    offer_code: Optional[str] = None
    offer_display: Optional[str] = None
    timing: Optional[datetime] = None
    owner_id: Optional[str] = None
    priority: int = 5
    rationale: Optional[str] = None


class CompassState(BaseModel):
    """LangGraph state object passed between COMPASS nodes."""

    customer_id: str
    as_of_date: date
    alarm_severity: Optional[str] = None
    alarm_timestamp: Optional[datetime] = None
    signal_results: list[SignalResult] = Field(default_factory=list)
    risk_tier: Optional[str] = None
    final_score: Optional[float] = None
    action_score: Optional[float] = None
    confirmed_events: list[dict[str, Any]] = Field(default_factory=list)
    llm_inferred_events: list[dict[str, Any]] = Field(default_factory=list)
    final_events: list[dict[str, Any]] = Field(default_factory=list)
    risk_adjustment: float = 0.0
    action_plan: Optional[ActionPlan] = None
    gate_decision: Optional[Literal["approved", "rejected", "human_review"]] = None
    gate_reason: Optional[str] = None
    dispatch_timestamp: Optional[datetime] = None
    outreach_id: Optional[int] = None
