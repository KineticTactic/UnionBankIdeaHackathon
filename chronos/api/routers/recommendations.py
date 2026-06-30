"""FastAPI router for NEXUS product-recommendation endpoints.

Serves the trained NEXUS-Baseline model (XGBoost on PKDD'99). Mirrors the
risk_scores router pattern. See NEXUS_IMPLEMENTATION.md §10.2.

  GET  /recommendations/health            — model metadata + per-product metrics
  POST /recommendations/score             — score an arbitrary feature payload
  GET  /recommendations/{customer_id}     — (demo) read batch-scored demo customer

The COMPASS get_product_recommendations_tool reads this router in production.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.recommend import nexus_serving

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

ROOT = Path(__file__).resolve().parents[2]
METRICS_PATH = ROOT / "ml" / "checkpoints" / "nexus_baseline_metrics.json"
DEMO_SCORES = ROOT.parent / "server" / "data" / "nexus_model_scores.json"


class ScoreRequest(BaseModel):
    features: dict[str, float]
    held_products: list[str] = []


@router.get("/health")
async def health() -> dict:
    """Model metadata + offline eval metrics."""
    out = {
        "model_version": nexus_serving.model_version(),
        "trainable_products": nexus_serving.trainable_products(),
    }
    if METRICS_PATH.exists():
        out["metrics"] = json.loads(METRICS_PATH.read_text())
    return out


@router.post("/score")
async def score(req: ScoreRequest) -> dict:
    """Score a raw feature payload → ranked product propensities."""
    try:
        ranked = nexus_serving.score_ranked(req.features, req.held_products)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {
        "model_version": nexus_serving.model_version(),
        "recommendations": ranked,
    }


@router.get("/{customer_id}")
async def get_for_customer(customer_id: str) -> dict:
    """Demo convenience: read the batch-scored propensities for a demo customer."""
    if not DEMO_SCORES.exists():
        raise HTTPException(status_code=503, detail="Demo scores not generated. Run scripts.score_demo_customers.")
    data = json.loads(DEMO_SCORES.read_text())
    rec = data.get(customer_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No scores for {customer_id}")
    ranked = sorted(({"product": p, "score": s} for p, s in rec["scores"].items()),
                    key=lambda d: d["score"], reverse=True)
    return {
        "customer_id": customer_id,
        "model_version": data["_meta"]["model_version"],
        "held_trainable": rec.get("held_trainable", []),
        "recommendations": ranked,
    }
