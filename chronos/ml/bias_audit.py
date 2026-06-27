"""
bias_audit.py — Disparate impact audit for CHRONOS FusionXV2.

RBI AI Governance 2024 §9 — AI systems in banking must undergo fairness and bias
audits before deployment and at regular intervals.

Implements the 4/5ths rule (EEOC / EU AI Act guidance):
  Adverse Impact Ratio (AIR) = (adverse rate for protected group) / (adverse rate for reference group)
  PASS if AIR >= 0.80 for all protected groups.

Protected attributes audited: gender, region, age_group
Target: churn_probability >= HIGH_RISK_THRESHOLD (i.e., flagged as high-risk)
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

HIGH_RISK_THRESHOLD = float(os.getenv("BIAS_AUDIT_THRESHOLD", "0.60"))
AIR_LOWER_BOUND = float(os.getenv("BIAS_AUDIT_AIR_LOWER", "0.80"))
AIR_UPPER_BOUND = float(os.getenv("BIAS_AUDIT_AIR_UPPER", "1.20"))

PROTECTED_ATTRIBUTES = ["gender", "region", "age_group"]

RESULTS_FILE = Path(__file__).parent / "checkpoints" / "bias_audit_results.json"


def _age_group(age: int) -> str:
    if age < 30:
        return "18-29"
    elif age < 45:
        return "30-44"
    elif age < 60:
        return "45-59"
    return "60+"


def run_bias_audit(
    records: list[dict[str, Any]],
    *,
    threshold: float = HIGH_RISK_THRESHOLD,
) -> dict[str, Any]:
    """
    Audit records for disparate impact across protected attributes.

    Each record must have:
      - churn_probability (float 0-1)
      - gender (str)
      - region (str)
      - age (int) or age_group (str)

    Returns a dict with per-attribute AIR values and overall PASS/FAIL.
    """
    if not records:
        return {
            "status": "SKIPPED",
            "reason": "No records provided",
            "audited_at": datetime.now(timezone.utc).isoformat(),
        }

    # Normalise age → age_group
    for r in records:
        if "age_group" not in r and "age" in r:
            r["age_group"] = _age_group(int(r["age"]))

    results_by_attr: dict[str, Any] = {}
    overall_pass = True

    for attr in PROTECTED_ATTRIBUTES:
        groups: dict[str, dict[str, int]] = {}
        for r in records:
            val = r.get(attr)
            if not val:
                continue
            val = str(val).strip().lower()
            if val not in groups:
                groups[val] = {"total": 0, "flagged": 0}
            groups[val]["total"] += 1
            if float(r.get("churn_probability", 0)) >= threshold:
                groups[val]["flagged"] += 1

        if len(groups) < 2:
            results_by_attr[attr] = {"status": "SKIPPED", "reason": "< 2 groups"}
            continue

        # Adverse rate = proportion flagged in each group
        rates = {
            g: (v["flagged"] / v["total"] if v["total"] > 0 else 0.0)
            for g, v in groups.items()
        }

        ref_group = min(rates, key=rates.get)  # lowest adverse rate = reference
        ref_rate = rates[ref_group]

        group_results = []
        attr_pass = True
        for g, rate in rates.items():
            if g == ref_group:
                air = 1.0
            else:
                air = rate / ref_rate if ref_rate > 0 else float("inf")
            group_pass = AIR_LOWER_BOUND <= air <= AIR_UPPER_BOUND or g == ref_group
            if not group_pass:
                attr_pass = False
                overall_pass = False
            group_results.append({
                "group":       g,
                "total":       groups[g]["total"],
                "flagged":     groups[g]["flagged"],
                "adverse_rate": round(rate, 4),
                "air":         round(air, 4),
                "reference":   g == ref_group,
                "pass":        group_pass,
            })

        results_by_attr[attr] = {
            "status":       "PASS" if attr_pass else "FAIL",
            "reference_group": ref_group,
            "air_lower_bound": AIR_LOWER_BOUND,
            "air_upper_bound": AIR_UPPER_BOUND,
            "groups":       sorted(group_results, key=lambda x: x["adverse_rate"], reverse=True),
        }

    audit_result = {
        "status":           "PASS" if overall_pass else "FAIL",
        "overall_pass":     overall_pass,
        "audited_at":       datetime.now(timezone.utc).isoformat(),
        "threshold":        threshold,
        "records_audited":  len(records),
        "attributes":       results_by_attr,
        "regulatory_basis": "RBI AI Governance 2024 §9 + EEOC 4/5ths Rule",
    }

    _save_results(audit_result)
    logger.info("[BiasAudit] Status=%s (records=%d)", audit_result["status"], len(records))
    return audit_result


def _save_results(result: dict[str, Any]) -> None:
    try:
        RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        history: list[dict] = []
        if RESULTS_FILE.exists():
            history = json.loads(RESULTS_FILE.read_text())
        history.append(result)
        # Keep last 50 audit runs
        RESULTS_FILE.write_text(json.dumps(history[-50:], indent=2))
    except Exception as exc:
        logger.error("[BiasAudit] Could not save results: %s", exc)


def load_latest_result() -> dict[str, Any] | None:
    try:
        if RESULTS_FILE.exists():
            history = json.loads(RESULTS_FILE.read_text())
            return history[-1] if history else None
    except Exception:
        return None
    return None


def get_audit_status() -> dict[str, Any]:
    latest = load_latest_result()
    if not latest:
        return {
            "status":     "NOT_RUN",
            "message":    "No bias audit has been run yet.",
            "audited_at": None,
        }
    return {
        "status":          latest.get("status", "UNKNOWN"),
        "overall_pass":    latest.get("overall_pass"),
        "audited_at":      latest.get("audited_at"),
        "records_audited": latest.get("records_audited"),
        "attributes":      {
            attr: {"status": v.get("status")}
            for attr, v in latest.get("attributes", {}).items()
        },
    }
