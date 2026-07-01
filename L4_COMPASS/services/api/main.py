"""COMPASS HTTP shim — exposes the LangGraph orchestrator as a REST API.

This wraps ``layer4 compass orchestration.services.orchestration.graph.builder.build_demo_graph``
and serves ``/health``, ``/version``, and ``/orchestrate``.

In live mode, COMPASS fetches the customer's CHRONOS score and any ARGUS
alarms from upstream services, builds a CompassState, and runs the graph
synchronously.  In demo mode (default), the graph is invoked with a
minimal state object (no mocked data — empty signal list → graph returns
end state without firing an action plan).
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Path setup
_THIS_DIR = Path(__file__).resolve().parent
_LAYER_ROOT = _THIS_DIR.parent.parent
if str(_LAYER_ROOT) not in sys.path:
    sys.path.insert(0, str(_LAYER_ROOT))
_REPO_ROOT = _LAYER_ROOT.parent
_SCHEMAS_DIR = _REPO_ROOT / "schemas"
if str(_SCHEMAS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCHEMAS_DIR))

logger = logging.getLogger("compass-api")
logging.basicConfig(
    level=os.getenv("COMPASS_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

_DEMO_MODE = os.getenv("COMPASS_DEMO_MODE", "true").lower() == "true"
_CHRONOS_BASE = os.getenv("CHRONOS_BASE_URL", "http://localhost:8001")
_ARGUS_BASE = os.getenv("ARGUS_BASE_URL", "http://localhost:8002")


# ── Request / response models ────────────────────────────────────────────────
class OrchestrateRequest(BaseModel):
    customer_id: str
    alarm_severity: str | None = None
    signal_results: list[dict[str, Any]] = Field(default_factory=list)
    live_fetch: bool = True  # pull score + signals from upstream if true


class HealthResponse(BaseModel):
    status: str
    service: str
    stage: int
    stage_name: str
    version: str
    demo_mode: bool


# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="COMPASS Orchestration API",
    description="PCOP Layer 4 — Next-Best-Action Agentic Orchestration (LangGraph 7-node)",
    version="1.0.0",
)

_cors = os.getenv("COMPASS_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── RM Copilot router ────────────────────────────────────────────────────────
# Serves POST /copilot/ask — the endpoint the frontend RMCopilotPanel calls.
# Guarded so missing optional deps (langchain, etc.) never block the rest of the
# COMPASS API from starting. Run/fake-mode details: COPILOT_RUNBOOK.md.
try:
    from services.orchestration.copilot.router import router as _copilot_router  # type: ignore
    app.include_router(_copilot_router)
    logger.info("RM Copilot router mounted at /copilot")
except Exception as exc:  # pragma: no cover — optional-dependency guard
    logger.warning("RM Copilot router NOT mounted (%s) — /copilot/ask unavailable", exc)

_GRAPH = None  # lazy-init to avoid loading at import time in dev


def _get_graph():
    global _GRAPH
    if _GRAPH is None:
        try:
            from services.orchestration.graph.builder import build_demo_graph  # type: ignore
            _GRAPH = build_demo_graph()
        except ImportError as exc:
            logger.warning("COMPASS graph dependencies missing (%s) — using empty stub graph", exc)
            # Stub graph that simply returns the input state.
            class _Stub:
                def invoke(self, state):
                    out = dict(state)
                    out.setdefault("routing_path", ["intake-stub"])
                    out.setdefault("final_events", [])
                    out.setdefault("action_plan", None)
                    out.setdefault("gate_decision", "approved")
                    out.setdefault("gate_reason", "graph_deps_unavailable")
                    return out
            _GRAPH = _Stub()
    return _GRAPH


def _initial_state(req: OrchestrateRequest, score: dict | None, argus_signals: list | None) -> dict:
    """Build the initial CompassState TypedDict expected by the LangGraph nodes."""
    signals = req.signal_results or []
    if not signals and argus_signals:
        # Map ARGUS output to COMPASS SignalResult shape.
        for s in argus_signals:
            signals.append({
                "signal_type":   s.get("signal_type", "argus_signal"),
                "detected":      s.get("detected", True),
                "confidence":    s.get("confidence", 0.5),
                "evidence":      s.get("evidence", []),
                "cusum_value":   s.get("statistic"),
                "alarm_threshold": s.get("threshold"),
                "onset_estimate": s.get("onset_estimate"),
                "direction":     s.get("direction"),
                "expires_at":    None,
            })
    return {
        "customer_id":          req.customer_id,
        "as_of_date":           str(date.today()),
        "alarm_severity":       req.alarm_severity or "MEDIUM",
        "alarm_timestamp":      f"{datetime.utcnow().isoformat()}Z",
        "signal_results":       signals,
        "risk_tier":            (score or {}).get("risk_tier"),
        "final_score":          (score or {}).get("final_score"),
        "action_score":         (score or {}).get("action_score"),
        "ensemble_disagreement": None,
        "confirmed_events":     [],
        "llm_inferred_events":  [],
        "final_events":         [],
        "risk_adjustment":      0.0,
        "action_plan":          None,
        "gate_decision":        None,
        "gate_reason":          None,
        "dispatch_timestamp":   None,
        "outreach_id":          None,
        "cognition_rounds":     0,
        "evidence_sufficient":  None,
        "escalation_reason":    None,
        "routing_path":         [],
    }


async def _fetch_upstream(customer_id: str) -> tuple[dict | None, list | None]:
    """Fetch live CHRONOS score + ARGUS signals (best-effort, non-fatal)."""
    import httpx
    score = None
    argus_signals = None
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(f"{_CHRONOS_BASE}/scores/{customer_id}")
            if r.status_code == 200:
                score = r.json()
        except Exception as exc:
            logger.warning("CHRONOS live fetch failed for %s: %s", customer_id, exc)
        try:
            r = await client.post(f"{_ARGUS_BASE}/evaluate", json={"customer_id": customer_id})
            if r.status_code == 200:
                body = r.json()
                argus_signals = list((body.get("herald_results") or {}).values())
        except Exception as exc:
            logger.warning("ARGUS live fetch failed for %s: %s", customer_id, exc)
    return score, argus_signals


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="compass-orchestration",
        stage=4,
        stage_name="compass",
        version="1.0.0",
        demo_mode=_DEMO_MODE,
    )


@app.get("/version")
async def version() -> dict:
    return {
        "service": "compass-orchestration",
        "stage": 4,
        "stage_name": "compass",
        "version": "1.0.0",
        "demo_mode": _DEMO_MODE,
    }


@app.post("/orchestrate")
async def orchestrate(req: OrchestrateRequest) -> dict:
    """Run the COMPASS LangGraph for one customer."""
    try:
        graph = _get_graph()
    except Exception as exc:
        logger.exception("Failed to build COMPASS graph")
        raise HTTPException(
            status_code=500,
            detail={
                "error": True, "stage": 4, "stage_name": "compass",
                "message": f"Graph build failed: {exc}",
            },
        )

    score = None
    argus_signals = None
    if req.live_fetch:
        score, argus_signals = await _fetch_upstream(req.customer_id)

    state = _initial_state(req, score, argus_signals)

    try:
        result = await asyncio.to_thread(lambda: graph.invoke(state))
    except Exception as exc:
        logger.exception("COMPASS graph invocation failed for %s", req.customer_id)
        raise HTTPException(
            status_code=500,
            detail={
                "error": True, "stage": 4, "stage_name": "compass",
                "message": f"Graph invocation failed: {exc}",
            },
        )

    return {
        "status":          "ok",
        "customer_id":     req.customer_id,
        "demo_mode":       _DEMO_MODE,
        "routing_path":    result.get("routing_path", []),
        "final_events":    result.get("final_events", []),
        "action_plan":     result.get("action_plan"),
        "gate_decision":   result.get("gate_decision"),
        "gate_reason":     result.get("gate_reason"),
        "risk_tier":       result.get("risk_tier"),
        "final_score":     result.get("final_score"),
        "outreach_id":     result.get("outreach_id"),
        "completed_at":    datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("COMPASS_PORT", "8004"))
    host = os.getenv("COMPASS_HOST", "0.0.0.0")
    # access_log=False keeps the TUI's 2s /health probe from
    # flooding the log panel with one INFO line per service per tick.
    uvicorn.run("services.api.main:app", host=host, port=port,
                log_level=os.getenv("COMPASS_LOG_LEVEL", "info").lower(),
                access_log=False)
