"""
human_review.py — Human escalation node. [LLM:0]

Reached when route_after_merge() decides the inference is too uncertain
or the customer is too high-value for auto-dispatch.

Does NOT call an LLM. It:
  1. Sets action_plan with requires_human_approval=True + status=PENDING_APPROVAL.
  2. Posts to the approval queue via the Node server's /api/outreach/approve-request.
  3. Sets escalation_reason and appends to routing_path.
  4. Routes to END — the RM picks it up from the approval queue; no auto-dispatch.
"""
from __future__ import annotations

import logging
import os
import threading

import httpx

from ..state import CompassState

logger = logging.getLogger(__name__)

PCOP_API_BASE = os.getenv("PCOP_API_BASE", "http://localhost:8000")


async def human_review_node(state: CompassState) -> dict:
    """[LLM:0] Escalate to human approval queue."""
    customer_id = state["customer_id"]
    events = state.get("final_events", [])
    max_conf = max((e.get("confidence", 0) for e in events), default=1.0)
    disagreement = state.get("ensemble_disagreement") or 0.0

    # Determine reason
    if disagreement > 0.35:
        reason = f"ensemble_disagreement:{disagreement:.2f}"
    elif max_conf < 0.55:
        reason = f"low_confidence:{max_conf:.2f}"
    else:
        reason = "policy_escalation"

    logger.info(f"HUMAN_REVIEW [LLM:0]: Escalating {customer_id} — {reason}")

    # Build a pending action plan (no auto-send)
    score_data = await _get_rm_id(customer_id)
    rm_id = score_data.get("rm_id") or "rm_unassigned"

    action_plan = {
        "channel": state.get("action_plan", {}).get("channel") if state.get("action_plan") else None,
        "offer_code": None,
        "timing": state.get("as_of_date"),
        "owner_id": rm_id,
        "priority": 1,   # high priority — needs human attention
        "rationale": (
            f"Escalated to human review: {reason}. "
            f"Risk tier: {state.get('risk_tier')}. "
            f"Events: {[e['event_type'] for e in events]}."
        ),
        "suppressed": False,
        "requires_human_approval": True,
        "status": "PENDING_APPROVAL",
    }

    # Fire-and-forget: notify the approval queue
    _notify_approval_queue_async(customer_id, action_plan, reason)

    path = list(state.get("routing_path", []))
    path.append("human_review")

    return {
        "action_plan": action_plan,
        "escalation_reason": reason,
        "gate_decision": "human_review",
        "gate_reason": reason,
        "routing_path": path,
    }


async def _get_rm_id(customer_id: str) -> dict:
    """Fetch RM id from DB. Non-critical — returns empty dict on failure."""
    try:
        from ..tools.db_reads import get_rm_availability_tool
        result = await get_rm_availability_tool.ainvoke({"customer_id": customer_id})
        return result
    except Exception:
        return {}


def _notify_approval_queue_async(customer_id: str, action_plan: dict, reason: str) -> None:
    """POST to Node approval service (fire-and-forget, non-blocking)."""
    def _post():
        try:
            httpx.post(
                f"{PCOP_API_BASE}/api/outreach/approve-request",
                json={
                    "customerId": customer_id,
                    "actionPlan": action_plan,
                    "escalationReason": reason,
                    "requestedBy": "compass_auto_escalation",
                },
                timeout=3.0,
            )
        except Exception as e:
            logger.warning(f"HUMAN_REVIEW: Could not notify approval queue: {e}")
    threading.Thread(target=_post, daemon=True).start()
