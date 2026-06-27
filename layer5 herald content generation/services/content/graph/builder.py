from langgraph.graph import StateGraph, END
from ..state import HeraldState
from ..nodes.brief import brief_node
from ..nodes.scribe import scribe_node
from ..nodes.fact_check import fact_check_node
from ..nodes.sentinel import sentinel_node
from ..nodes.dispatch import dispatch_node
from ..nodes.chronicle import chronicle_node

#
# Graph shape (Item 4 adds fact_check between scribe and sentinel):
#
#   briefing → scribe → fact_check → sentinel → dispatch → chronicle → END
#                ↑ (retry, bounded ≤ MAX_RETRIES, handled inside fact_check_node)
#
# fact_check [LLM:0]: regex + consent checks, retries scribe internally on FAIL.
# sentinel   [LLM:1]: compliance LLM critique (unchanged). Only reached on fact-check PASS.
#


def build_herald_graph():
    workflow = StateGraph(HeraldState)

    workflow.add_node("briefing", brief_node)
    workflow.add_node("scribe", scribe_node)
    workflow.add_node("fact_check", fact_check_node)   # [LLM:0] Item 4
    workflow.add_node("sentinel", sentinel_node)
    workflow.add_node("dispatch", dispatch_node)
    workflow.add_node("chronicle", chronicle_node)

    workflow.set_entry_point("briefing")
    workflow.add_edge("briefing", "scribe")
    workflow.add_edge("scribe", "fact_check")      # deterministic check first
    workflow.add_edge("fact_check", "sentinel")    # LLM compliance critique second
    workflow.add_edge("sentinel", "dispatch")
    workflow.add_edge("dispatch", "chronicle")
    workflow.add_edge("chronicle", END)

    return workflow.compile()
