"""VERDICT measurement contracts — used by Layer 6 and consumed by Layer 7."""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ObservationResult(BaseModel):
    customer_id: str
    outreach_id: Optional[int] = None
    window_days: int
    outcome_label: Literal["retained", "partial", "unresponsive", "churned", "unknown"]
    score_at_measure: float
    score_reduction: float
    signals_cleared: bool
    holdout: bool
    products_closed: int = 0
    observed_at: date


class AttributeResult(BaseModel):
    campaign_id: str
    channel: str
    n_treatment: int
    n_holdout: int
    treatment_retained_rate: float
    holdout_retained_rate: float
    naive_uplift: float
    dr_uplift: float
    dr_uplift_se: float
    overestimation_bias: float
    causal_net_calibrated: bool = False
