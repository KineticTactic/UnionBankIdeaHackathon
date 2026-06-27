"""
retraining_gate.py — Model recalibration safety gate for ORACLE (Layer 7).

RBI AI Governance 2024 §8 — Model Risk Management:
  Models must not be recalibrated or updated unless:
    1. A bias audit has been run within the last MAX_BIAS_AUDIT_AGE_DAYS days, AND
    2. The audit result is PASS, AND
    3. A model approval entry exists from the risk committee.

Usage:
    from retraining_gate import check_gate, record_model_approval

    gate = check_gate("FusionXV2", "v2.2")
    if gate["approved"]:
        # proceed with recalibration
        ...
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MAX_BIAS_AUDIT_AGE_DAYS = int(os.getenv("MAX_BIAS_AUDIT_AGE_DAYS", "90"))
BIAS_AUDIT_RESULTS = Path(__file__).parent.parent / "chronos" / "ml" / "checkpoints" / "bias_audit_results.json"
MODEL_APPROVALS_FILE = Path(__file__).parent / "model_approvals.json"


def _load_latest_bias_audit() -> dict[str, Any] | None:
    try:
        if BIAS_AUDIT_RESULTS.exists():
            history = json.loads(BIAS_AUDIT_RESULTS.read_text())
            return history[-1] if history else None
    except Exception as exc:
        logger.error("[RetrainingGate] Could not read bias audit: %s", exc)
    return None


def _load_model_approvals() -> list[dict[str, Any]]:
    try:
        if MODEL_APPROVALS_FILE.exists():
            return json.loads(MODEL_APPROVALS_FILE.read_text())
    except Exception:
        pass
    return []


def _save_model_approvals(approvals: list[dict[str, Any]]) -> None:
    MODEL_APPROVALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    MODEL_APPROVALS_FILE.write_text(json.dumps(approvals, indent=2))


def check_gate(model_name: str, version: str) -> dict[str, Any]:
    """
    Check whether a model recalibration is approved.
    Returns {"approved": bool, "blockers": [...], "bias_audit": {...}, "model_approval": {...}}.
    """
    blockers: list[str] = []
    now = datetime.now(timezone.utc)

    # ── 1. Bias audit check ───────────────────────────────────────────────────
    audit = _load_latest_bias_audit()
    audit_ok = False
    audit_summary: dict[str, Any] = {}

    if audit is None:
        blockers.append("NO_BIAS_AUDIT: No bias audit has been run.")
        audit_summary = {"status": "NOT_RUN"}
    else:
        audited_at = datetime.fromisoformat(audit["audited_at"].replace("Z", "+00:00"))
        age_days = (now - audited_at).days
        audit_summary = {
            "status":      audit.get("status"),
            "audited_at":  audit.get("audited_at"),
            "age_days":    age_days,
            "max_age":     MAX_BIAS_AUDIT_AGE_DAYS,
        }

        if audit.get("status") != "PASS":
            blockers.append(f"BIAS_AUDIT_FAILED: Last audit result was {audit.get('status')}. Fix fairness issues before recalibrating.")
        elif age_days > MAX_BIAS_AUDIT_AGE_DAYS:
            blockers.append(f"BIAS_AUDIT_STALE: Last audit is {age_days} days old (max {MAX_BIAS_AUDIT_AGE_DAYS}). Run a fresh audit.")
        else:
            audit_ok = True

    # ── 2. Model committee approval check ────────────────────────────────────
    approvals = _load_model_approvals()
    approval = next(
        (a for a in reversed(approvals) if a.get("model_name") == model_name and a.get("status") == "APPROVED"),
        None,
    )
    approval_ok = approval is not None

    if not approval_ok:
        blockers.append(f"NO_MODEL_APPROVAL: No committee approval found for {model_name}. Call record_model_approval() to register one.")

    approved = audit_ok and approval_ok and not blockers

    logger.info(
        "[RetrainingGate] model=%s version=%s approved=%s blockers=%s",
        model_name, version, approved, blockers,
    )

    return {
        "approved":       approved,
        "model_name":     model_name,
        "version":        version,
        "checked_at":     now.isoformat(),
        "blockers":       blockers,
        "bias_audit":     audit_summary,
        "model_approval": approval or {},
        "regulatory_basis": "RBI AI Governance 2024 §8 — Model Risk Management",
    }


def record_model_approval(
    model_name: str,
    version: str,
    approved_by: str,
    *,
    notes: str = "",
) -> dict[str, Any]:
    """
    Record that the model risk committee has approved a model version for deployment.
    Must be called before check_gate() will pass the approval check.
    """
    approvals = _load_model_approvals()
    entry = {
        "model_name":  model_name,
        "version":     version,
        "status":      "APPROVED",
        "approved_by": approved_by,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "notes":       notes,
    }
    approvals.append(entry)
    _save_model_approvals(approvals)
    logger.info("[RetrainingGate] Approval recorded: %s %s by %s", model_name, version, approved_by)
    return entry


def revoke_model_approval(model_name: str, version: str, revoked_by: str, reason: str) -> bool:
    """Revoke a previously granted model approval."""
    approvals = _load_model_approvals()
    changed = False
    for a in approvals:
        if a["model_name"] == model_name and a["version"] == version and a["status"] == "APPROVED":
            a["status"]     = "REVOKED"
            a["revoked_by"] = revoked_by
            a["revoked_at"] = datetime.now(timezone.utc).isoformat()
            a["revoke_reason"] = reason
            changed = True
    if changed:
        _save_model_approvals(approvals)
    return changed
