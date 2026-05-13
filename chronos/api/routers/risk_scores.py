"""FastAPI router for CHRONOS risk score endpoints."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.models.risk import ChurnScoreListResponse, ChurnScoreResponse, ReasonCodeV2

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scores", tags=["risk-scores"])


def _get_db() -> Session:
    raise NotImplementedError("Wire up your SQLAlchemy session factory here")


@router.get("/{customer_id}", response_model=ChurnScoreResponse)
async def get_customer_score(
    customer_id: str,
    db: Annotated[Session, Depends(_get_db)] = None,  # type: ignore[assignment]
) -> ChurnScoreResponse:
    """Return the latest CHRONOS score for a single customer.

    Includes TARE, HABITAT, treatability, action score, reason codes v2, and anomaly flag.
    """
    row = _fetch_latest_score(customer_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No score found for customer {customer_id}")
    return _row_to_response(row)


@router.get("", response_model=ChurnScoreListResponse)
async def list_scores(
    anomaly_only: bool = Query(default=False, description="Return only customers with anomaly_flag=TRUE"),
    tier: Optional[str] = Query(default=None, description="Comma-separated risk tiers, e.g. critical,high"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: Annotated[Session, Depends(_get_db)] = None,  # type: ignore[assignment]
) -> ChurnScoreListResponse:
    """List churn scores with optional filtering by tier and anomaly flag."""
    tiers = [t.strip() for t in tier.split(",")] if tier else None
    rows, total = _fetch_score_list(db, anomaly_only=anomaly_only, tiers=tiers, page=page, page_size=page_size)
    return ChurnScoreListResponse(
        customers=[_row_to_response(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{customer_id}/reason-codes", response_model=list[ReasonCodeV2])
async def get_reason_codes(
    customer_id: str,
    db: Annotated[Session, Depends(_get_db)] = None,  # type: ignore[assignment]
) -> list[ReasonCodeV2]:
    """Return the full PRISM reason_codes_v2 in structured format."""
    row = _fetch_latest_score(customer_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No score found for customer {customer_id}")
    raw_v2 = row.get("reason_codes_v2") or []
    return [ReasonCodeV2(**rc) for rc in raw_v2]


def _fetch_latest_score(customer_id: str, db: Session | None) -> dict | None:
    """Fetch the most recent churn_scores row for a customer."""
    if db is None:
        return None
    result = db.execute(
        "SELECT * FROM churn_scores WHERE customer_id = :cid ORDER BY scored_at DESC LIMIT 1",
        {"cid": customer_id},
    ).fetchone()
    return dict(result) if result else None


def _fetch_score_list(
    db: Session | None,
    anomaly_only: bool,
    tiers: list[str] | None,
    page: int,
    page_size: int,
) -> tuple[list[dict], int]:
    if db is None:
        return [], 0
    conditions = []
    params: dict = {}
    if anomaly_only:
        conditions.append("anomaly_flag = TRUE")
    if tiers:
        conditions.append("risk_tier = ANY(:tiers)")
        params["tiers"] = tiers
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    offset = (page - 1) * page_size
    rows = db.execute(
        f"SELECT * FROM churn_scores {where} ORDER BY scored_at DESC LIMIT :lim OFFSET :off",
        {**params, "lim": page_size, "off": offset},
    ).fetchall()
    total = db.execute(f"SELECT COUNT(*) FROM churn_scores {where}", params).scalar()
    return [dict(r) for r in rows], int(total)


def _row_to_response(row: dict) -> ChurnScoreResponse:
    raw_v2 = row.get("reason_codes_v2") or []
    codes_v2 = [ReasonCodeV2(**rc) for rc in raw_v2] if raw_v2 else []
    return ChurnScoreResponse(
        customer_id=str(row["customer_id"]),
        final_score=float(row.get("final_score") or row.get("tare_score") or 0.0),
        risk_tier=row.get("risk_tier", "low"),
        tare_score=row.get("tare_score"),
        habitat_score=row.get("habitat_score"),
        treatability_score=row.get("treatability_score"),
        action_score=row.get("action_score"),
        scoring_pass=row.get("scoring_pass"),
        reason_codes=list(row.get("reason_codes") or []),
        reason_codes_v2=codes_v2,
        anomaly_flag=bool(row.get("anomaly_flag", False)),
        model_version=row.get("model_version", "unknown"),
        scored_at=row.get("scored_at") or datetime.utcnow(),
        is_cold_start=bool(row.get("is_cold_start", False)),
    )
