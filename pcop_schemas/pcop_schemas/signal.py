"""ARGUS signal-detection contracts — used by Layer 2 and consumed by Layer 4."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class SignalResult(BaseModel):
    """Result of a single HERALD agent or joint detector run.

    Mirrors `pcop_layer2_argus.services.detection.agents.base_agent.SignalResult`.
    """

    customer_id: str
    signal_type: str
    detected: bool
    p_value: float = 1.0
    confidence: float = Field(ge=0.0, le=1.0)
    method_used: str
    statistic: float = 0.0
    threshold: float = 0.0
    direction: Optional[str] = None
    onset_estimate: Optional[date] = None
    evidence: list[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None


class AlarmPayload(BaseModel):
    """Build by ECHO and emitted to Kafka topic `risk.signal_detections`."""

    customer_id: str
    severity: str
    rejected_tests: list[str]
    adjusted_p: dict[str, float] = Field(default_factory=dict)
    signal_details: dict[str, Any] = Field(default_factory=dict)
    nexus_changed: bool = False
    oracle_onset: Optional[date] = None
    active_signal_count: int = 0
    published_at: datetime


class ARGUSInput(BaseModel):
    """Top-level input to ARGUS `evaluate()`."""

    customer_id: str
    today: date
    herald_data: dict[str, dict[str, Any]] = Field(default_factory=dict)
    signal_matrix: Optional[Any] = None
    signal_dates: list[date] = Field(default_factory=list)
    baseline_mus: Optional[Any] = None
    baseline_sigmas: Optional[Any] = None
    nexus_state: Optional[Any] = None


class ARGUSOutput(BaseModel):
    customer_id: str
    evaluated_at: datetime
    warden_severity: Optional[str] = None
    warden_alarm: bool = False
    rejected_tests: list[str] = Field(default_factory=list)
    herald_results: dict[str, SignalResult] = Field(default_factory=dict)
    nexus_detected: bool = False
    oracle_detected: bool = False
    alarm_payload: Optional[AlarmPayload] = None
