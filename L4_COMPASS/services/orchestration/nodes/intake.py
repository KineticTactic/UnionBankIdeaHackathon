import logging
from ..state import CompassState
from ..tools.db_reads import get_churn_score_raw

logger = logging.getLogger(__name__)


async def intake_node(state: CompassState) -> dict:
    customer_id = state["customer_id"]
    logger.info(f"INTAKE: Processing customer {customer_id}")

    score_data = await get_churn_score_raw(customer_id)

    risk_tier = score_data.get("risk_tier") or "watch"
    final_score = score_data.get("final_score") or 0.0
    action_score = score_data.get("action_score") or float(final_score) * 0.5

    logger.info(
        f"INTAKE: customer={customer_id} tier={risk_tier} "
        f"score={final_score:.3f} action_score={action_score:.3f}"
    )

    alarm_severity = state.get("alarm_severity", "LOW")
    if risk_tier in ["watch", "low"] and alarm_severity not in ["CRITICAL", "HIGH"]:
        logger.info(
            f"INTAKE: Routing customer {customer_id} to verify-only "
            f"(tier={risk_tier}, alarm={alarm_severity})"
        )

    ensemble_disagreement = float(score_data.get("ensemble_disagreement") or 0.0)

    return {
        "risk_tier": risk_tier,
        "final_score": final_score,
        "action_score": action_score,
        "ensemble_disagreement": ensemble_disagreement,
        "confirmed_events": [],
        "llm_inferred_events": [],
        "final_events": [],
        "risk_adjustment": 0.0,
        # Item 2 — initialize dynamic routing fields
        "cognition_rounds": 0,
        "evidence_sufficient": None,
        "escalation_reason": None,
        "routing_path": ["intake"],
    }
