"""
cognition.py — LLM reasoning node for ambiguous signal interpretation.

[LLM:capped:2] per customer (MAX_EVIDENCE_LOOPS=2 enforces this).

Item 2: tracks cognition_rounds and evidence_sufficient for the self-loop edge.
Self-loop: if round 1 finds no events and budget remains → route_after_cognition
returns "cognition" and we run again with expanded tool evidence. Hard cap at 2.
"""
import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from ..state import CompassState
from ..clients.nvidia_client import get_langchain_cognition_llm
from ..prompts.cognition_system import COGNITION_SYSTEM_PROMPT
from ..tools.db_reads import (
    get_signal_results_tool,
    get_crm_notes_tool,
    get_transactions_tool,
    get_kyc_updates_tool,
    get_account_events_tool,
    get_enrichment_tool,
)
from ..tools.db_writes import write_life_event_tool, adjust_risk_score_tool
from ..tools.rag_tool import retrieve_playbook_tool

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5
MAX_EVIDENCE_LOOPS = 2   # hard cap on cognition self-loops [LLM:capped:2]


async def cognition_node(state: CompassState) -> dict:
    customer_id = state["customer_id"]
    rounds = state.get("cognition_rounds", 0) + 1
    logger.info(f"COGNITION [LLM:1]: {customer_id} (evidence loop {rounds}/{MAX_EVIDENCE_LOOPS})")

    path = list(state.get("routing_path", []))
    path.append(f"cognition:{rounds}")

    llm = get_langchain_cognition_llm(node=f"cognition_round{rounds}")

    read_tools = [
        retrieve_playbook_tool,          # [LLM:0] local RAG — Item 3
        get_signal_results_tool,
        get_crm_notes_tool,
        get_transactions_tool,
        get_kyc_updates_tool,
        get_account_events_tool,
        get_enrichment_tool,
    ]
    write_tools = [write_life_event_tool, adjust_risk_score_tool]
    all_tools = read_tools + write_tools

    llm_with_tools = llm.bind_tools(all_tools)

    # On loop-back (rounds > 1), instruct the model to dig deeper
    loop_instruction = ""
    if rounds > 1:
        loop_instruction = (
            "\n\n## Evidence loop 2 of 2\n"
            "You previously found no conclusive events. "
            "Use additional tools (transactions, KYC, enrichment) to look harder. "
            "If still inconclusive, conclude with your best assessment."
        )

    human_message = HumanMessage(content=f"""
Customer ID: {customer_id}
As-of date: {state['as_of_date']}
Risk tier: {state.get('risk_tier', 'unknown')}
Churn score: {(state.get('final_score') or 0.0):.3f}

## ARGUS signals detected

{_format_signal_summary(state["signal_results"])}

## Your task

Analyse these signals and determine which life events are occurring.
Use the available tools to gather evidence.
Confirm events by calling write_life_event for each one with confidence >= 0.60.
{loop_instruction}
""")

    messages = [
        SystemMessage(content=COGNITION_SYSTEM_PROMPT),
        human_message,
    ]

    inferred_events = list(state.get("llm_inferred_events", []))
    tool_call_count = 0

    for round_num in range(MAX_TOOL_ROUNDS):
        response = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            logger.info(
                f"COGNITION: Completed loop {rounds} after {round_num + 1} steps, "
                f"{tool_call_count} tool calls, {len(inferred_events)} events total"
            )
            break

        for tool_call in response.tool_calls:
            tool_call_count += 1
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]

            logger.debug(f"COGNITION: Tool {tool_call_count} — {tool_name}({tool_args})")
            tool_result = await _execute_tool(tool_name, tool_args, customer_id, all_tools)

            if tool_name == "write_life_event_tool" and tool_result.get("success"):
                inferred_events.append(tool_result["event"])

            messages.append(ToolMessage(
                content=json.dumps(tool_result, default=str),
                tool_call_id=tool_call["id"],
            ))
    else:
        logger.warning(f"COGNITION: MAX_TOOL_ROUNDS={MAX_TOOL_ROUNDS} reached for {customer_id}")

    # Evidence sufficiency: if no events found on first loop and budget allows → loop back
    evidence_sufficient = bool(inferred_events) or rounds >= MAX_EVIDENCE_LOOPS

    return {
        "llm_inferred_events": inferred_events,
        "cognition_rounds": rounds,
        "evidence_sufficient": evidence_sufficient,
        "routing_path": path,
    }


def _format_signal_summary(signal_results: list) -> str:
    detected = [s for s in signal_results if s.get("detected")]
    if not detected:
        return "No signals detected."
    lines = []
    for s in detected:
        lines.append(
            f"- {s['signal_type']}: confidence={s['confidence']:.2f}, "
            f"direction={s.get('direction', 'n/a')}, "
            f"onset={s.get('onset_estimate', 'unknown')}\n"
            f"  Evidence: {'; '.join(s.get('evidence', [])[:2])}"
        )
    return "\n".join(lines)


async def _execute_tool(
    tool_name: str, tool_args: dict, customer_id: str, all_tools: list
) -> dict:
    tool_args["customer_id"] = customer_id
    tool_map = {t.name: t for t in all_tools}
    if tool_name not in tool_map:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        return await tool_map[tool_name].ainvoke(tool_args)
    except Exception as e:
        logger.error(f"Tool {tool_name} failed: {e}")
        return {"error": str(e), "tool": tool_name}
