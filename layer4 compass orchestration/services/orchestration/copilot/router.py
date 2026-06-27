"""
copilot/router.py — RM Conversational Copilot FastAPI endpoint.

Item 5: on-demand, [LLM:1 per turn], Postgres-backed conversation memory.

POST /copilot/ask
  body: { session_id, rm_user_id, customer_id, message }
  → { reply, tools_used, session_id }

The copilot has 15 read tools that let it answer questions about any customer
(scores, events, channel history, CRM notes, offers, consents, transactions,
KYC, enrichment, account events, RM availability, playbook lookups, and the
routing path from the last COMPASS run).

MAX_TOOL_ROUNDS=4 caps tool calls per turn to avoid runaway cost.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from pydantic import BaseModel

from ..clients.nvidia_client import get_langchain_copilot_llm, track_llm_call
from ..tools.db_reads import (
    get_offer_eligibility_tool,
    get_channel_history_tool,
    get_rm_availability_tool,
    get_consent_flags_tool,
    get_life_events_tool,
    get_signal_results_tool,
    get_crm_notes_tool,
    get_transactions_tool,
    get_kyc_updates_tool,
    get_account_events_tool,
    get_enrichment_tool,
)
from ..tools.rag_tool import retrieve_playbook_tool

router = APIRouter(prefix="/copilot", tags=["copilot"])
logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 10   # messages to load from DB for context window

_COPILOT_TOOLS = [
    retrieve_playbook_tool,
    get_offer_eligibility_tool,
    get_channel_history_tool,
    get_rm_availability_tool,
    get_consent_flags_tool,
    get_life_events_tool,
    get_signal_results_tool,
    get_crm_notes_tool,
    get_transactions_tool,
    get_kyc_updates_tool,
    get_account_events_tool,
    get_enrichment_tool,
]

_TOOL_MAP = {t.name: t for t in _COPILOT_TOOLS}

_SYSTEM_PROMPT = """\
You are the PCOP RM Copilot — a private assistant for Union Bank Relationship Managers.
You have read-only access to customer data tools and a retention playbook knowledge base.

Guidelines:
- Answer concisely. RMs are busy. Lead with the key fact, then details.
- When asked about a customer, always look up their current data first.
- For offer recommendations, check both eligibility AND playbook context.
- If data suggests a life event, mention it as a signal — not a confirmed fact.
- Never fabricate data. If uncertain, say so and suggest what to check.
- Compliance: do not recommend products the customer has opted out of.
"""


class AskRequest(BaseModel):
    session_id: str | None = None
    rm_user_id: str
    customer_id: str
    message: str


class AskResponse(BaseModel):
    reply: str
    tools_used: list[str]
    session_id: str


@router.post("/ask", response_model=AskResponse)
async def ask_copilot(req: AskRequest) -> AskResponse:
    session_id = req.session_id or str(uuid.uuid4())
    track_llm_call("copilot")

    history = await _load_history(session_id, req.customer_id, limit=MAX_HISTORY_TURNS)

    llm = get_langchain_copilot_llm()
    llm_with_tools = llm.bind_tools(_COPILOT_TOOLS)

    messages = [SystemMessage(content=_SYSTEM_PROMPT)]
    messages.extend(history)
    messages.append(HumanMessage(content=req.message))

    tools_used: list[str] = []
    reply = ""

    for _ in range(MAX_TOOL_ROUNDS):
        response = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            reply = response.content or ""
            break

        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = {**tc["args"], "customer_id": req.customer_id}
            tools_used.append(tool_name)

            if tool_name not in _TOOL_MAP:
                result: Any = {"error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result = await _TOOL_MAP[tool_name].ainvoke(tool_args)
                except Exception as e:
                    result = {"error": str(e)}

            messages.append(ToolMessage(
                content=json.dumps(result, default=str),
                tool_call_id=tc["id"],
            ))
    else:
        reply = reply or "I reached my tool limit. Here is what I found so far."

    await _persist_turn(
        session_id=session_id,
        rm_user_id=req.rm_user_id,
        customer_id=req.customer_id,
        user_message=req.message,
        assistant_reply=reply,
        tools_used=tools_used,
    )

    return AskResponse(reply=reply, tools_used=tools_used, session_id=session_id)


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _load_history(session_id: str, customer_id: str, limit: int) -> list:
    from langchain_core.messages import AIMessage
    demo_mode = os.environ.get("DEMO_MODE", "true").lower() != "false"
    if demo_mode:
        return []

    try:
        from ..db.connection import get_db_session
        async with get_db_session() as conn:
            rows = await conn.fetch(
                """
                SELECT role, content FROM copilot_messages
                WHERE session_id = $1 AND customer_id = $2
                ORDER BY created_at DESC LIMIT $3
                """,
                uuid.UUID(session_id), customer_id, limit,
            )
        msgs = []
        for row in reversed(rows):
            if row["role"] == "user":
                msgs.append(HumanMessage(content=row["content"]))
            elif row["role"] == "assistant":
                msgs.append(AIMessage(content=row["content"]))
        return msgs
    except Exception as e:
        logger.warning("Failed to load copilot history: %s", e)
        return []


async def _persist_turn(
    session_id: str,
    rm_user_id: str,
    customer_id: str,
    user_message: str,
    assistant_reply: str,
    tools_used: list[str],
) -> None:
    demo_mode = os.environ.get("DEMO_MODE", "true").lower() != "false"
    if demo_mode:
        return

    try:
        from ..db.connection import get_db_session
        sess_uuid = uuid.UUID(session_id)
        async with get_db_session() as conn:
            await conn.executemany(
                """
                INSERT INTO copilot_messages
                    (session_id, rm_user_id, customer_id, role, content, tools_used)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                [
                    (sess_uuid, rm_user_id, customer_id, "user", user_message, None),
                    (sess_uuid, rm_user_id, customer_id, "assistant", assistant_reply,
                     json.dumps(tools_used)),
                ],
            )
    except Exception as e:
        logger.warning("Failed to persist copilot turn: %s", e)
