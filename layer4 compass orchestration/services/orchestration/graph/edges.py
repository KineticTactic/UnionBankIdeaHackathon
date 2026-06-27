"""
edges.py — All conditional routing functions for the COMPASS LangGraph.

LLM cost of routing decisions: [LLM:0] for all functions in this file.

Graph shape (Item 2):
  START → intake → {cognition ⟲(≤2) | verify} → merge
        → {compass_nba | human_review→END}
        → gate → {dispatch | suppressed→END}
"""
from ..state import CompassState

# ── Thresholds ────────────────────────────────────────────────────────────────
HIGH_VALUE_BALANCE = 1_000_000   # ₹10L+ customers get human eyes
LOW_CONFIDENCE = 0.55            # below this → uncertain inference
DISAGREEMENT_LIMIT = 0.35        # ensemble spread too wide → escalate
MAX_EVIDENCE_LOOPS = 2           # hard cap on cognition self-loops


# ── intake → {cognition | verify} ────────────────────────────────────────────

def route_after_intake(state: CompassState) -> str:
    """[LLM:0] High-confidence signals → rule-based VERIFY; ambiguous → LLM COGNITION."""
    signals = state.get("signal_results", [])

    if not signals:
        return "verify"

    ambiguous = [s for s in signals if (s.get("confidence") or 0) < 0.80 and s.get("detected")]

    if ambiguous:
        return "cognition"
    return "verify"


# ── cognition → {cognition (loop) | merge} ───────────────────────────────────

def route_after_cognition(state: CompassState) -> str:
    """
    [LLM:0] Evidence loop: if cognition found no events AND has budget, loop back.
    Worst-case: cognition runs TWICE (+1 LLM call vs. baseline).
    Hard cap: MAX_EVIDENCE_LOOPS = 2.
    """
    rounds = state.get("cognition_rounds", 0)
    evidence_sufficient = state.get("evidence_sufficient", True)

    if not evidence_sufficient and rounds < MAX_EVIDENCE_LOOPS:
        return "cognition"   # loop back — gather more tool evidence
    return "merge"


# ── merge → {compass_nba | human_review} ─────────────────────────────────────

def route_after_merge(state: CompassState) -> str:
    """
    [LLM:0] Deterministic confidence gate.

    Escalates to human review when:
    - Inference confidence is below threshold (uncertain signals)
    - CHRONOS ensemble disagreement is too wide
    (High-value balance check removed: account balance not currently in CompassState —
     add it if you wire balance through INTAKE/score_data.)
    """
    events = state.get("final_events", [])
    max_conf = max((e.get("confidence", 0) for e in events), default=1.0)
    disagreement = state.get("ensemble_disagreement") or 0.0

    if max_conf < LOW_CONFIDENCE or disagreement > DISAGREEMENT_LIMIT:
        return "human_review"
    return "compass_nba"


# ── gate → {dispatch | suppressed} ───────────────────────────────────────────

def route_after_gate(state: CompassState) -> str:
    """[LLM:0] Suppression check — consent, cooldown, fatigue."""
    action_plan = state.get("action_plan", {})
    if action_plan and action_plan.get("suppressed", False):
        return "suppressed"
    return "dispatch"
