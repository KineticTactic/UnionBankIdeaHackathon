"""ARGUS HTTP shim — exposes the in-process ARGUSEngine as a REST API.

This wraps ``L2_ARGUS.services.detection.main.ARGUSEngine`` and
serves ``/health``, ``/version``, ``/evaluate``, and ``/signals/:customer_id``.

Run:
    cd L2_ARGUS
    PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8002
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Make the in-process detection library importable.
_THIS_DIR = Path(__file__).resolve().parent
_LAYER2_ROOT = _THIS_DIR.parent.parent
if str(_LAYER2_ROOT) not in sys.path:
    sys.path.insert(0, str(_LAYER2_ROOT))

# Also expose pcop_schemas for the shared Pydantic models.
_REPO_ROOT = _LAYER2_ROOT.parent
_SCHEMAS_DIR = _REPO_ROOT / "pcop_schemas"
if str(_SCHEMAS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCHEMAS_DIR))

logger = logging.getLogger("argus-api")
logging.basicConfig(
    level=os.getenv("ARGUS_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)


# ── Lazy imports to keep startup fast ────────────────────────────────────────
def _get_engine():
    """Build a fresh ARGUSEngine on first call (stateless)."""
    from services.detection.main import ARGUSEngine  # type: ignore
    return ARGUSEngine()


# ── Request / response models ────────────────────────────────────────────────
class EvaluateRequest(BaseModel):
    customer_id: str
    today: date = Field(default_factory=date.today)
    herald_data: dict[str, dict[str, Any]] = Field(default_factory=dict)
    nexus_state: dict[str, Any] | None = None


class EvaluateResponse(BaseModel):
    customer_id: str
    evaluated_at: str
    warden_alarm: bool
    warden_severity: str | None
    rejected_tests: list[str]
    nexus_detected: bool
    oracle_detected: bool
    herald_results: dict[str, Any]
    alarm_payload: dict[str, Any] | None
    updated_state: dict[str, dict[str, Any]] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    service: str
    stage: int
    stage_name: str
    version: str
    demo_mode: bool


# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="ARGUS Signal Detection API",
    description="PCOP Layer 2 — Statistical Signal Detection (HERALD + NEXUS + ORACLE + WARDEN + ECHO)",
    version="1.0.0",
)

_cors = os.getenv("ARGUS_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DEMO_MODE = os.getenv("ARGUS_DEMO_MODE", "true").lower() == "true"


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="argus-detection",
        stage=2,
        stage_name="argus",
        version="1.0.0",
        demo_mode=_DEMO_MODE,
    )


@app.get("/version")
async def version() -> dict:
    return {
        "service": "argus-detection",
        "stage": 2,
        "stage_name": "argus",
        "version": "1.0.0",
        "demo_mode": _DEMO_MODE,
    }


@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(req: EvaluateRequest) -> EvaluateResponse:
    """Run ARGUS for a single customer with the supplied data.

    In demo mode with empty ``herald_data``, ARGUS returns an empty
    result set (no mocks — Rule A).  Live callers should populate
    ``herald_data`` from the Bank API.
    """
    try:
        engine = _get_engine()
        from services.detection.main import ARGUSInput  # type: ignore
        inp = ARGUSInput(
            customer_id=req.customer_id,
            today=req.today,
            herald_data=req.herald_data,
            nexus_state=req.nexus_state,
        )
        out = engine.evaluate(inp)
    except Exception as exc:
        logger.exception("ARGUS evaluation failed for %s", req.customer_id)
        raise HTTPException(
            status_code=500,
            detail={
                "error": True, "stage": 2, "stage_name": "argus",
                "message": f"ARGUS evaluation failed: {exc}",
            },
        ) from exc

    # Coerce numpy scalars to native Python types so the response
    # serialises cleanly (Pydantic v2 + numpy has a known
    # PydanticSerializationError for numpy.bool_ / numpy.float64).
    def _py(v):
        if v is None:
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float, str)):
            return v
        if isinstance(v, (list, tuple)):
            return [_py(x) for x in v]
        if isinstance(v, dict):
            return {k: _py(x) for k, x in v.items()}
        # numpy scalar
        if hasattr(v, "item"):
            try:
                return v.item()
            except Exception:
                return str(v)
        return v

    return EvaluateResponse(
        customer_id=out.customer_id,
        evaluated_at=out.evaluated_at,
        warden_alarm=bool(out.warden.alarm),
        warden_severity=out.warden.severity,
        rejected_tests=list(out.warden.rejected_tests),
        nexus_detected=bool(out.nexus.nexus_detected),
        oracle_detected=bool(out.oracle.oracle_detected),
        herald_results={
            name: {
                "signal_type":     r.signal_type,
                "detected":        bool(r.detected),
                "p_value":         _py(r.p_value),
                "confidence":      _py(r.confidence),
                "method_used":     r.method_used,
                "statistic":       _py(r.statistic),
                "threshold":       _py(r.threshold),
                "direction":       r.direction,
                "onset_estimate":  r.onset_estimate.isoformat() if r.onset_estimate else None,
                "evidence":        list(r.evidence),
            }
            for name, r in out.herald_results.items()
        },
        alarm_payload=(
            {
                "customer_id":         out.alarm_payload.customer_id,
                "alarm_timestamp":     out.alarm_payload.alarm_timestamp,
                "alarm_severity":      out.alarm_payload.alarm_severity,
                "rejected_tests":      list(out.alarm_payload.rejected_tests),
                "active_signal_count": int(out.alarm_payload.active_signal_count),
                "expires_at":          out.alarm_payload.expires_at,
            }
            if out.alarm_payload
            else None
        ),
        updated_state={k: _py(v) for k, v in inp.updated_state.items()},
    )


@app.get("/signals/{customer_id}")
async def get_signals(customer_id: str) -> dict:
    """Return the last known signals for a customer.

    In demo mode, ARGUS runs stateless so this returns an empty list.
    In production, this is backed by Postgres (out of scope for the shim).
    """
    return {"customer_id": customer_id, "signals": [], "source": "argus-engine-stateless"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ARGUS_PORT", "8002"))
    host = os.getenv("ARGUS_HOST", "0.0.0.0")
    # access_log=False suppresses the per-request "INFO: 127.0.0.1 - GET /health
    # HTTP/1.1 200 OK" line that the TUI's 2s health probe would otherwise
    # flood into the log panel.
    uvicorn.run("services.api.main:app", host=host, port=port,
                log_level=os.getenv("ARGUS_LOG_LEVEL", "info").lower(),
                access_log=False)
