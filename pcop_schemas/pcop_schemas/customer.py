"""Customer record contracts shared between Bank API, ARGUS, CHRONOS, COMPASS."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class BankCustomer(BaseModel):
    """Customer record as served by the Bank API.

    Mirrors `bank/data/customers.json` and the live response from
    `GET /api/core-banking/customers/:id`.
    """

    customer_id: str
    full_name: str
    age: Optional[int] = None
    city: Optional[str] = None
    segment: Optional[str] = None
    archetype: Optional[str] = None
    tenure_months: Optional[int] = None
    tenure_years: Optional[float] = None
    income: Optional[float] = None
    employer: Optional[str] = None
    balance: Optional[float] = None
    risk_tier: Optional[str] = None
    churn_score: Optional[float] = None
    preferred_channel: Optional[str] = None
    email_opt_in: Optional[bool] = None
    sms_opt_in: Optional[bool] = None
    push_opt_in: Optional[bool] = None
    life_event: Optional[str] = None
    life_event_desc: Optional[str] = None
    nps: Optional[int] = None
    inactivity_days: Optional[int] = None
    digital_ratio: Optional[float] = None


class CustomerRecord(BaseModel):
    """Customer record consumed by CHRONOS scoring (token sequence + tabular).

    Produced by `chronos.services.scoring.serving.bank_loader` from the
    Bank API on every analyze call. Token sequence and tabular features
    are required for inference.
    """

    customer_id: str
    token_ids: list[int] = Field(default_factory=list)
    time_gaps: list[float] = Field(default_factory=list)
    tabular_features: dict[str, float] = Field(default_factory=dict)
    tenure_days: int = 0
    as_of_date: Optional[date] = None


class CustomerSnapshot(BaseModel):
    """Composite customer snapshot returned by `/api/customers/:id`.

    Combines the customer record, latest score, signals, plan, survival,
    and HERALD content into one payload.
    """

    customer: BankCustomer
    score: Optional[dict[str, Any]] = None
    signals: list[dict[str, Any]] = Field(default_factory=list)
    plan: Optional[dict[str, Any]] = None
    survival: Optional[dict[str, Any]] = None
    herald: Optional[dict[str, Any]] = None
    enrichment: Optional[dict[str, Any]] = None
    snapshot_at: Optional[datetime] = None
