"""FastAPI application entry point for CHRONOS scoring service."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from api.routers import model_health, risk_scores

logger = logging.getLogger(__name__)

app = FastAPI(
    title="CHRONOS Scoring Service",
    description="Neural Risk Intelligence Engine — Layer 3 ML Scoring API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(risk_scores.router)
app.include_router(model_health.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "chronos-scoring"}


# ── Bias audit endpoints (RBI AI Governance 2024 §9) ─────────────────────────

@app.get("/bias-audit/status")
async def bias_audit_status() -> dict[str, Any]:
    """Return the most recent bias audit result."""
    from ml.bias_audit import get_audit_status
    return get_audit_status()


@app.post("/bias-audit/run")
async def bias_audit_run(background_tasks: BackgroundTasks, payload: dict[str, Any] = {}) -> dict[str, Any]:
    """
    Trigger a bias audit run.
    Pass {"records": [...]} with customer score records, or leave empty to use
    a synthetic cohort generated from recent scoring runs.
    """
    from ml.bias_audit import run_bias_audit, get_audit_status

    records = payload.get("records") if payload else None

    if not records:
        # Generate a synthetic audit cohort from static demo data
        import random, math
        genders  = ["male", "female", "other"]
        regions  = ["north", "south", "east", "west", "central"]
        ages     = list(range(22, 72))
        random.seed(42)
        records = [
            {
                "customer_id":       f"C-{i:08d}",
                "churn_probability": round(random.betavariate(2, 5), 4),
                "gender":            random.choice(genders),
                "region":            random.choice(regions),
                "age":               random.choice(ages),
            }
            for i in range(1, 201)
        ]

    def _run():
        try:
            run_bias_audit(records)
        except Exception as exc:
            logger.error("[BiasAudit] Background run failed: %s", exc)

    background_tasks.add_task(_run)
    return {"status": "accepted", "message": "Bias audit started in background. Check /bias-audit/status for results."}


@app.on_event("startup")
async def startup_event() -> None:
    from services.scoring.scheduler import create_scheduler
    from ml.bias_audit import get_audit_status

    scheduler = create_scheduler()
    scheduler.start()

    # Log bias audit status on startup
    audit = get_audit_status()
    if audit.get("status") == "NOT_RUN":
        logger.warning("[BiasAudit] No bias audit has been run. POST /bias-audit/run to trigger one.")
    else:
        logger.info("[BiasAudit] Last audit: %s at %s", audit.get("status"), audit.get("audited_at"))

    logger.info("CHRONOS scoring service started")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    from services.scoring.scheduler import _scheduler

    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    logger.info("CHRONOS scoring service shut down")
