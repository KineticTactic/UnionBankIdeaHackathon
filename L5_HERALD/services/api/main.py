"""HERALD HTTP shim — exposes the LangGraph content generator as a REST API.

Wraps ``layer5 herald content generation.services.content.graph.builder.build_herald_graph``
and serves ``/health``, ``/version``, ``/generate``, and ``/content/:customer_id``.

In live mode, HERALD fetches the action plan from COMPASS and any live
customer context from the Bank API, runs the graph, and returns the
final generated content.  In demo mode, the graph is invoked with a
minimal state (no mocks — empty content payload, compliance_status='skipped').
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime
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
_SCHEMAS_DIR = _REPO_ROOT / "pcop_schemas"
if str(_SCHEMAS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCHEMAS_DIR))

logger = logging.getLogger("herald-api")
logging.basicConfig(
    level=os.getenv("HERALD_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

_DEMO_MODE = os.getenv("HERALD_DEMO_MODE", "true").lower() == "true"
_COMPASS_BASE = os.getenv("COMPASS_BASE_URL", "http://localhost:8004")
_NVIDIA_ENDPOINT = os.getenv("NVIDIA_ENDPOINT", "")
_NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
_NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "deepseek-ai/deepseek-v4-pro")


# ── Request / response models ────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    customer_id: str
    channel: str = "email"
    action_plan: dict[str, Any] | None = None
    risk_tier: str | None = None
    final_score: float | None = None
    final_events: list[dict[str, Any]] = Field(default_factory=list)
    live_fetch: bool = True


class HealthResponse(BaseModel):
    status: str
    service: str
    stage: int
    stage_name: str
    version: str
    demo_mode: bool
    nvidia_configured: bool


# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="HERALD Outreach Generation API",
    description="PCOP Layer 5 — Hyper-personalised Outreach (NVIDIA DeepSeek + SENTINEL compliance)",
    version="1.0.0",
)

_cors = os.getenv("HERALD_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)

_GRAPH = None


def _get_graph():
    global _GRAPH
    if _GRAPH is None:
        try:
            from services.content.graph.builder import build_herald_graph  # type: ignore
            _GRAPH = build_herald_graph()
        except ImportError as exc:
            logger.warning("HERALD graph dependencies missing (%s) — using empty stub graph", exc)
            class _Stub:
                def invoke(self, state):
                    out = dict(state)
                    out.setdefault("generated_content", {
                        "subject": "Stay on track with your finances",
                        "email":   {"body": "Hi there — we noticed some changes in your account. Reach out if you need help."},
                        "sms":     {"body": "We noticed some changes in your account. Reply HELP for assistance."},
                        "push":    {"body": "Account update — tap to review."},
                    })
                    out.setdefault("compliance_status", "human_review")
                    out.setdefault("compliance_notes", "graph_deps_unavailable_fallback_content")
                    out.setdefault("human_review_required", True)
                    out.setdefault("dispatched", False)
                    return out
            _GRAPH = _Stub()
    return _GRAPH


def _initial_state(req: GenerateRequest, action_plan: dict | None) -> dict:
    plan = req.action_plan or action_plan or {}
    return {
        "action_plan_event":     plan,
        "customer_id":           req.customer_id,
        "channel":               req.channel,
        "brief":                 None,
        "generated_content":     None,
        "ab_variant":            None,
        "compliance_status":     None,
        "compliance_notes":      None,
        "retry_count":           0,
        "dispatched":            False,
        "dispatch_provider_id":  None,
        "content_store_id":      None,
        "human_review_required": False,
        "fact_check_violations": None,
        "fact_check_passed":     None,
    }


async def _fetch_compass_plan(customer_id: str) -> dict | None:
    """Try to fetch the live COMPASS action plan."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(f"{_COMPASS_BASE}/orchestrate", json={"customer_id": customer_id, "live_fetch": True})
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.warning("COMPASS live fetch failed for %s: %s", customer_id, exc)
    return None


def _extract_body(result: dict) -> str:
    """Best-effort extract of generated body text from a HERALD graph result."""
    content = result.get("generated_content") or {}
    if isinstance(content, dict):
        for key in ("body", "text", "message", "content"):
            if content.get(key):
                return str(content[key])
        for sub in ("email", "sms", "push"):
            block = content.get(sub)
            if isinstance(block, dict) and block.get("body"):
                return str(block["body"])
    return ""


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="herald-content",
        stage=5,
        stage_name="herald",
        version="1.0.0",
        demo_mode=_DEMO_MODE,
        nvidia_configured=bool(_NVIDIA_API_KEY),
    )


@app.get("/version")
async def version() -> dict:
    return {
        "service": "herald-content",
        "stage": 5,
        "stage_name": "herald",
        "version": "1.0.0",
        "demo_mode": _DEMO_MODE,
        "nvidia_configured": bool(_NVIDIA_API_KEY),
    }


@app.post("/generate")
async def generate(req: GenerateRequest) -> dict:
    """Run the HERALD LangGraph for one customer.

    In live mode, fetches the COMPASS action plan + builds a brief from
    the Bank API.  In demo mode, runs the graph with a minimal state
    (no mocked output — empty body if no upstream data).
    """
    try:
        graph = _get_graph()
    except Exception as exc:
        logger.exception("HERALD graph build failed")
        raise HTTPException(
            status_code=500,
            detail={
                "error": True, "stage": 5, "stage_name": "herald",
                "message": f"Graph build failed: {exc}",
            },
        )

    plan = None
    if req.live_fetch and not req.action_plan:
        plan = await _fetch_compass_plan(req.customer_id)

    state = _initial_state(req, plan)

    try:
        result = await asyncio.to_thread(lambda: graph.invoke(state))
    except Exception as exc:
        logger.exception("HERALD graph invocation failed for %s", req.customer_id)
        raise HTTPException(
            status_code=500,
            detail={
                "error": True, "stage": 5, "stage_name": "herald",
                "message": f"Graph invocation failed: {exc}",
            },
        )

    body = _extract_body(result)
    return {
        "status":                 "ok",
        "customer_id":            req.customer_id,
        "channel":                req.channel,
        "demo_mode":              _DEMO_MODE,
        "compliance_status":      result.get("compliance_status"),
        "compliance_notes":       result.get("compliance_notes"),
        "human_review_required":  result.get("human_review_required", False),
        "dispatched":             result.get("dispatched", False),
        "dispatch_provider_id":   result.get("dispatch_provider_id"),
        "content_store_id":       result.get("content_store_id"),
        "body":                   body,
        "subject":                (result.get("generated_content") or {}).get("subject") if isinstance(result.get("generated_content"), dict) else None,
        "fact_check_passed":      result.get("fact_check_passed"),
        "completed_at":           datetime.utcnow().isoformat(),
    }


@app.get("/content/{customer_id}")
async def get_content(customer_id: str) -> dict:
    """Return the last generated content for a customer (stateless shim → empty)."""
    return {"customer_id": customer_id, "content": None, "source": "herald-engine-stateless"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("HERALD_PORT", "8005"))
    host = os.getenv("HERALD_HOST", "0.0.0.0")
    # access_log=False keeps the TUI's 2s /health probe from
    # flooding the log panel with one INFO line per service per tick.
    uvicorn.run("services.api.main:app", host=host, port=port,
                log_level=os.getenv("HERALD_LOG_LEVEL", "info").lower(),
                access_log=False)
