"""FastAPI application entry point for CHRONOS scoring service."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import model_health, risk_scores

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Modern FastAPI lifespan — replaces deprecated on_event hooks."""
    from services.scoring.scheduler import create_scheduler, _scheduler
    from ml.bias_audit import get_audit_status

    scheduler = create_scheduler()
    scheduler.start()
    logger.info("CHRONOS scheduler started with %d jobs", len(scheduler.get_jobs()))

    audit = get_audit_status()
    if audit.get("status") == "NOT_RUN":
        logger.warning("[BiasAudit] No bias audit has been run. POST /bias-audit/run with real records.")
    else:
        logger.info("[BiasAudit] Last audit: %s at %s", audit.get("status"), audit.get("audited_at"))

    # Pre-load the heavy BatchScorer so the first /analyze call is fast
    # (Rule H — models must be loaded once at startup, not per request).
    try:
        from services.scoring.serving.batch_scorer import BatchScorer
        import pathlib
        root = pathlib.Path(__file__).resolve().parent.parent
        tare_path = root / "ml" / "checkpoints" / "tare_churn.onnx"
        app.state.batch_scorer = BatchScorer(
            tare_onnx_path=str(tare_path) if tare_path.exists() else None,
        )
        logger.info("BatchScorer pre-loaded (tare_onnx=%s)", tare_path.exists())
    except Exception as exc:
        logger.warning("BatchScorer pre-load failed: %s — will lazy-load on first request", exc)
        app.state.batch_scorer = None

    logger.info("CHRONOS scoring service started")
    try:
        yield
    finally:
        if _scheduler and _scheduler.running:
            _scheduler.shutdown(wait=False)
        logger.info("CHRONOS scoring service shut down")


app = FastAPI(
    title="CHRONOS Scoring Service",
    description="Neural Risk Intelligence Engine — Layer 3 ML Scoring API",
    version="1.0.0",
    lifespan=_lifespan,
)

# CORS — read from env (Rule C) with * default.
_cors_origins = os.getenv("CHRONOS_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(risk_scores.router)
app.include_router(model_health.router)


@app.get("/health")
async def health() -> dict:
    """Health endpoint for orchestrator preflight + TUI status polling."""
    return {
        "status": "ok",
        "service": "chronos-scoring",
        "stage": 3,
        "stage_name": "chronos",
        "version": "1.0.0",
    }


# ── Bias audit endpoints (RBI AI Governance 2024 §9) ─────────────────────────

@app.get("/bias-audit/status")
async def bias_audit_status() -> dict[str, Any]:
    """Return the most recent bias audit result."""
    from ml.bias_audit import get_audit_status
    return get_audit_status()


@app.post("/bias-audit/run")
async def bias_audit_run(background_tasks: BackgroundTasks, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Trigger a bias audit run on a real cohort of customer score records.
    Body shape: ``{"records": [{"customer_id", "churn_probability", "gender", "region", "age"}, ...]}``
    with at least 30 records (BH-FDR requires non-trivial support).
    """
    from ml.bias_audit import run_bias_audit

    records = (payload or {}).get("records")
    if not records:
        return {
            "error": True,
            "stage": 3,
            "stage_name": "chronos",
            "message": "No records supplied. POST {\"records\": [...]} with real customer scores "
                       "(e.g. from /scores?page_size=200). Synthetic cohorts are no longer "
                       "generated server-side per Rule A.",
        }, 400
    if len(records) < 30:
        return {
            "error": True,
            "stage": 3,
            "stage_name": "chronos",
            "message": f"Bias audit requires at least 30 records (got {len(records)}).",
        }, 400

    def _run():
        try:
            run_bias_audit(records)
        except Exception as exc:
            logger.error("[BiasAudit] Background run failed: %s", exc)

    background_tasks.add_task(_run)
    return {"status": "accepted", "message": "Bias audit started in background. Check /bias-audit/status for results."}


# ── Dev entry point ──────────────────────────────────────────────────────────
# Allows `python -m api.main` to launch uvicorn with sensible defaults
# without requiring the operator to know the port.
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CHRONOS_PORT", "8001"))
    host = os.getenv("CHRONOS_HOST", "0.0.0.0")
    uvicorn.run("api.main:app", host=host, port=port, log_level=os.getenv("CHRONOS_LOG_LEVEL", "info").lower())
