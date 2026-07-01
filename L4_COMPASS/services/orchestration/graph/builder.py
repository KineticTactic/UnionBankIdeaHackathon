"""
builder.py — COMPASS LangGraph construction.

Graph shape (Items 2):
  START → intake
        → {cognition ⟲(≤2) [LLM:capped:2] | verify [LLM:0]}
        → merge [LLM:0]
        → {compass_nba [LLM:1] | human_review [LLM:0] → END}
        → gate [LLM:0]
        → {dispatch [LLM:0] → END | suppressed → END}

Three decision points: intake-routing, merge confidence-gate, gate suppression.
One bounded loop: cognition self-loop (max 2 iterations = max +1 LLM call vs baseline).
One human-escalation exit: human_review → END (RM picks up from approval queue).

routing_path in CompassState records the exact path taken for each customer —
expose via /api/v2/customers/:id/routing-path for the demo frontend animation.
"""
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from ..state import CompassState
from ..nodes.intake import intake_node
from ..nodes.cognition import cognition_node
from ..nodes.verify import verify_node
from ..nodes.merge import merge_node
from ..nodes.compass_nba import compass_nba_node
from ..nodes.human_review import human_review_node
from ..nodes.gate import gate_node
from ..nodes.dispatch import dispatch_node
from .edges import (
    route_after_intake,
    route_after_cognition,
    route_after_merge,
    route_after_gate,
)


def build_compass_graph(checkpointer=None):
    graph = StateGraph(CompassState)

    # ── Nodes ─────────────────────────────────────────────────────────────────
    graph.add_node("intake",       intake_node)
    graph.add_node("cognition",    cognition_node)     # [LLM:capped:2]
    graph.add_node("verify",       verify_node)        # [LLM:0]
    graph.add_node("merge",        merge_node)         # [LLM:0]
    graph.add_node("compass_nba",  compass_nba_node)   # [LLM:1]
    graph.add_node("human_review", human_review_node)  # [LLM:0] Item 2
    graph.add_node("gate",         gate_node)          # [LLM:0]
    graph.add_node("dispatch",     dispatch_node)      # [LLM:0]

    # ── Edges ─────────────────────────────────────────────────────────────────
    graph.add_edge(START, "intake")

    # intake → cognition (ambiguous signals) OR verify (high-confidence signals)
    graph.add_conditional_edges("intake", route_after_intake, {
        "cognition": "cognition",
        "verify": "verify",
    })

    # cognition → self (evidence loop, ≤2) OR merge
    graph.add_conditional_edges("cognition", route_after_cognition, {
        "cognition": "cognition",
        "merge": "merge",
    })

    graph.add_edge("verify", "merge")

    # merge → compass_nba (confident) OR human_review (uncertain/high-value)
    graph.add_conditional_edges("merge", route_after_merge, {
        "compass_nba": "compass_nba",
        "human_review": "human_review",
    })

    graph.add_edge("human_review", END)   # RM picks up from approval queue
    graph.add_edge("compass_nba", "gate")

    # gate → dispatch (approved) OR END (suppressed)
    graph.add_conditional_edges("gate", route_after_gate, {
        "dispatch": "dispatch",
        "suppressed": END,
    })

    graph.add_edge("dispatch", END)

    return graph.compile(checkpointer=checkpointer)


def build_demo_graph():
    return build_compass_graph(checkpointer=None)
