"""HERALD content-generation contracts — used by Layer 5 and consumed by orchestrator."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class HeraldRequest(BaseModel):
    customer_id: str
    channel: Literal["email", "sms", "push", "call", "rm_visit", "app"]
    action_plan: Optional[dict[str, Any]] = None
    offer_code: Optional[str] = None
    risk_tier: Optional[str] = None
    final_score: Optional[float] = None
    final_events: list[dict[str, Any]] = Field(default_factory=list)


class HeraldResponse(BaseModel):
    customer_id: str
    channel: str
    content_id: Optional[str] = None
    subject: Optional[str] = None
    body: str
    compliance_status: Literal["passed", "failed", "human_review"] = "passed"
    compliance_notes: Optional[str] = None
    ab_variant: Optional[str] = None
    dispatched: bool = False
    dispatch_provider_id: Optional[str] = None
    generated_at: datetime
    human_review_required: bool = False
    error: Optional[dict[str, Any]] = None
