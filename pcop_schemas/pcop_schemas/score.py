"""CHRONOS scoring contracts — used by Layer 3 and consumed by Layer 4/5/6."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ReasonCodeV2(BaseModel):
    category: str
    description: str
    importance: float = Field(ge=0.0, le=1.0)
    source: Literal["sequence", "tabular", "both"]


class ChurnScore(BaseModel):
    """Output of `GET /scores/:customer_id` (CHRONOS Layer 3)."""

    customer_id: str
    final_score: float = Field(ge=0.0, le=1.0)
    risk_tier: Literal["critical", "high", "medium", "low"]
    tare_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    habitat_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    treatability_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    action_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    scoring_pass: Optional[str] = None
    reason_codes: list[str] = Field(default_factory=list)
    reason_codes_v2: list[ReasonCodeV2] = Field(default_factory=list)
    anomaly_flag: bool = False
    model_version: str
    scored_at: datetime
    is_cold_start: bool = False


class Survival(BaseModel):
    """Survival curve + horizon returned by CHRONOS."""

    customer_id: str
    p7: float = Field(ge=0.0, le=1.0)
    p30: float = Field(ge=0.0, le=1.0)
    p90: float = Field(ge=0.0, le=1.0)
    survival_curve: list[float] = Field(default_factory=list)
    urgency_horizon_days: Optional[int] = None


class AnalyzeResponse(ChurnScore):
    """Output of `POST /scores/:customer_id/analyze` — full diagnostics."""

    token_count: int = 0
    tabular_features: dict[str, float] = Field(default_factory=dict)
    attention_weights: list[dict[str, Any]] = Field(default_factory=list)
    shap_values: list[dict[str, Any]] = Field(default_factory=list)
    fusion_tare_weight: float = 0.0
    fusion_habitat_weight: float = 0.0
    fusion_ci_lower: float = 0.0
    fusion_ci_upper: float = 0.0
    tare_duration_ms: float = 0.0
    habitat_duration_ms: float = 0.0
    fusion_duration_ms: float = 0.0
    prism_duration_ms: float = 0.0


class ModelComponentStatus(BaseModel):
    name: str
    version: str
    last_updated: Optional[datetime] = None
    status: Literal["healthy", "degraded", "unavailable"]
    metrics: dict[str, Any] = Field(default_factory=dict)


class ModelHealthResponse(BaseModel):
    fusion_tare_weight: float
    fusion_habitat_weight: float
    fusion_ece: Optional[float] = None
    fusion_last_calibration: Optional[datetime] = None
    aegis_drift_status: str
    components: list[ModelComponentStatus]
    overall_status: Literal["healthy", "degraded", "unavailable"]


class PipelineError(BaseModel):
    """Structured error returned by any stage when something fails.

    Used so the client can display a meaningful error and the orchestrator
    can short-circuit downstream stages.
    """

    error: bool = True
    stage: int
    stage_name: str
    message: str
    detail: Optional[str] = None
    correlation_id: Optional[str] = None
