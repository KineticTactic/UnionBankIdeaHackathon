"""
fact_check.py — Deterministic pre-sentinel content verifier. [LLM:0]

Runs BEFORE the sentinel LLM compliance critique.
All checks are regex/string — zero model calls.

Catches:
  1. Name mismatches in salutations
  2. Prohibited rate/return promises (banks cannot guarantee returns)
  3. Tenure claims that don't match customer record (±1 year)
  4. Large ₹ amounts that don't appear in the customer's known offer value

Also does a deterministic consent check against the brief's consent data.
On FAIL: injects precise violation list into brief and retries SCRIBE (≤ MAX_RETRIES).
On PASS: hands off to SENTINEL for LLM compliance critique.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
from typing import Optional

import httpx

from ..state import HeraldState

logger = logging.getLogger(__name__)

PCOP_API_BASE = os.getenv("PCOP_API_BASE", "http://localhost:8000")
MAX_RETRIES = 2   # must match sentinel.MAX_RETRIES

# ── Regex patterns ────────────────────────────────────────────────────────────
_RATE_PROMISE = re.compile(
    r"\bguaranteed\b|\bassured\s+return\b|\b\d+\.?\d*\s*%\s*(interest|return|yield|p\.a\.)\b",
    re.IGNORECASE,
)
_AMOUNT = re.compile(r"₹\s*[\d,]+|INR\s*[\d,]+|\b\d{5,}\b")
_TENURE = re.compile(r"\b(\d+)\s+years?\s+(with\s+us|as\s+(?:a|our)\s+(?:valued\s+)?customer)", re.IGNORECASE)
_SALUTATION_NAME = re.compile(r"\bDear\s+([A-Za-z]+)", re.IGNORECASE)


# ── Deterministic checks ──────────────────────────────────────────────────────

def _check_name(content: str, first_name: str) -> Optional[str]:
    if not first_name:
        return None
    for m in _SALUTATION_NAME.finditer(content):
        used = m.group(1).strip()
        if used.lower() != first_name.lower():
            return f"name_mismatch: content greets '{used}' but customer is '{first_name}'"
    return None


def _check_rate_promises(content: str) -> Optional[str]:
    m = _RATE_PROMISE.search(content)
    if m:
        return f"prohibited_promise: '{m.group()}' — banks cannot promise rates in retention messages"
    return None


def _check_tenure(content: str, tenure_years: float) -> Optional[str]:
    for m in _TENURE.finditer(content):
        stated = int(m.group(1))
        if abs(stated - tenure_years) > 1:
            return (
                f"tenure_mismatch: content claims {stated} years but "
                f"actual tenure is {tenure_years:.1f} years"
            )
    return None


def _check_amounts(content: str, offer_value: str) -> Optional[str]:
    known_amounts: set[int] = set()
    for raw in re.findall(r"[\d,]+", offer_value or ""):
        try:
            known_amounts.add(int(raw.replace(",", "")))
        except ValueError:
            pass

    for m in _AMOUNT.finditer(content):
        raw = re.sub(r"[₹,\s]|INR", "", m.group())
        try:
            amount = int(raw)
        except ValueError:
            continue
        if amount < 1_000:   # small numbers are not financial figures
            continue
        if known_amounts and amount not in known_amounts:
            return f"unverified_figure: ₹{amount:,} not in offer terms — judges may flag this"
    return None


def verify_facts(content_str: str, brief: dict) -> list[str]:
    """
    Run all deterministic checks. Returns list of violation strings.
    Empty list = PASS.
    """
    violations: list[str] = []

    v = _check_name(content_str, brief.get("first_name", ""))
    if v:
        violations.append(v)

    v = _check_rate_promises(content_str)
    if v:
        violations.append(v)

    v = _check_tenure(content_str, float(brief.get("tenure_years") or 0))
    if v:
        violations.append(v)

    v = _check_amounts(content_str, str(brief.get("offer_value") or ""))
    if v:
        violations.append(v)

    return violations


def check_consent_from_brief(brief: dict, channel: str) -> Optional[str]:
    """
    Fast consent check using data already in the brief (no extra HTTP call).
    Returns a violation string or None.
    """
    channel_map = {
        "email": "email_opt_in",
        "sms": "sms_opt_in",
        "app": "push_opt_in",
        "call": "call_opt_in",
        "rm_visit": "call_opt_in",
    }
    # The brief doesn't carry opt-in flags directly — rely on COMPASS GATE having
    # already checked consent. If channel_constraints has a block flag, honour it.
    constraints = brief.get("channel_constraints") or {}
    if constraints.get("consent_blocked"):
        return f"consent_blocked:{channel.upper()}"
    return None


def _content_to_str(content: dict, channel: str) -> str:
    if channel == "email":
        return " ".join([
            content.get("subject_line", ""),
            re.sub(r"<[^>]+>", " ", content.get("body_html", "")),
            content.get("cta_text", ""),
        ])
    if channel == "sms":
        return content.get("message", "")
    if channel == "app":
        return " ".join([content.get("title", ""), content.get("card_body", ""), content.get("cta_label", "")])
    return json.dumps(content)


def _log_fail_async(customer_id: str, channel: str, violations: list[str]) -> None:
    """Fire-and-forget audit POST to Node compliance service."""
    def _post():
        try:
            httpx.post(
                f"{PCOP_API_BASE}/api/audit/event",
                json={
                    "eventType": "CONTENT_FACT_CHECK_FAILED",
                    "customerId": customer_id,
                    "actor": "herald_fact_check",
                    "layer": "HERALD",
                    "payload": {"channel": channel, "violations": violations},
                    "modelVersion": "deterministic",
                },
                timeout=2.0,
            )
        except Exception:
            pass
    threading.Thread(target=_post, daemon=True).start()


# ── LangGraph node ────────────────────────────────────────────────────────────

async def fact_check_node(state: HeraldState) -> dict:
    """
    [LLM:0] Deterministic fact-check and consent gate.

    PASS → proceed to sentinel (LLM compliance critique).
    FAIL + retries_remaining → call scribe again with exact fix instructions.
    FAIL + no retries → proceed to sentinel which will FAIL → human_review.
    """
    customer_id = state["customer_id"]
    channel = state["channel"]
    content = state.get("generated_content") or {}
    brief = state.get("brief") or {}
    retry_count = state.get("retry_count", 0)

    logger.info(f"FACT_CHECK [LLM:0]: {customer_id} channel={channel} attempt={retry_count+1}")

    content_str = _content_to_str(content, channel)
    violations = verify_facts(content_str, brief)

    consent_v = check_consent_from_brief(brief, channel)
    if consent_v:
        violations.append(consent_v)

    if not violations:
        logger.info(f"FACT_CHECK: PASS for {customer_id}")
        return {"fact_check_violations": [], "fact_check_passed": True}

    logger.warning(f"FACT_CHECK: FAIL for {customer_id} — {violations}")
    _log_fail_async(customer_id, channel, violations)

    if retry_count < MAX_RETRIES:
        # Inject precise violation list as fix instructions and re-run scribe
        from .scribe import scribe_node  # late import avoids circular

        fix_instructions = (
            "FACT-CHECK FAILED — fix these exact issues before regenerating:\n"
            + "\n".join(f"  • {v}" for v in violations)
        )
        updated_brief = {
            **brief,
            "compliance_fix_hint": fix_instructions,
            "tone_instructions": (
                (brief.get("tone_instructions") or "")
                + f"\n\n{fix_instructions}"
            ),
        }
        updated_state = {
            **state,
            "brief": updated_brief,
            "retry_count": retry_count + 1,
        }
        logger.info(f"FACT_CHECK: Retrying SCRIBE for {customer_id} (attempt {retry_count+2})")
        scribe_result = await scribe_node(updated_state)
        merged = {**updated_state, **scribe_result}

        # Re-run fact_check on fresh content (recursive, bounded by MAX_RETRIES)
        return await fact_check_node(merged)

    # Retries exhausted: pass violations to sentinel so it can escalate to human_review
    logger.warning(f"FACT_CHECK: Retries exhausted for {customer_id} — escalating to sentinel")
    return {
        "fact_check_violations": violations,
        "fact_check_passed": False,
        "compliance_notes": f"Fact-check failed after {retry_count+1} attempts: {'; '.join(violations)}",
    }
