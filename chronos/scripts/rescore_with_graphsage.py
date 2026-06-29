"""
Re-score the 20 demo customers using the trained GraphSAGEScorer.

Replaces the deterministic `base + noise(7)` graph_score in scores_v2.json
with real model output from graphsage_churn.pt.

Run after training:
    cd chronos && python -m scripts.rescore_with_graphsage
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
SCORES_PATH = ROOT / "data" / "scores_v2.json"


def _build_features(record: dict) -> dict[str, float]:
    """Map score record fields → PASS1_FEATURE_NAMES with sensible defaults.

    scores_v2.json does not carry all raw features, so we reconstruct
    approximations from the available score-level fields. These are
    good enough for a demo — a production scorer would pull from the
    bank core-banking API.
    """
    tare = record.get("tare_score", 0.5)
    habitat = record.get("habitat_score", 0.5)
    survival_30d = record.get("survival_30d", 0.3)
    final = record.get("final_score", 0.5)

    # Approximate balance from final score (higher risk → higher or lower balance)
    # Use mid-range 50,000 as default; survival gives a rough tenure proxy.
    balance = 50_000.0
    tenure_months = max(1.0, (1.0 - survival_30d) * 60)   # rough inverse proxy
    income = 80_000.0

    return {
        "recency_days":           30.0,
        "monetary_avg":           balance / tenure_months,
        "monetary_total":         balance,
        "frequency_30d":          max(1.0, (1.0 - habitat) * 5),
        "frequency_90d":          max(3.0, (1.0 - habitat) * 15),
        "decline_rate_30d":       float(max(0.0, final - 0.4) * 0.3),
        "support_contacts_90d":   float(round(final * 3)),
        "inactivity_streak_days": float(max(0.0, (1.0 - tare) * 30)),
        "product_count":          max(1.0, 3.0 - final * 2),
        "digital_ratio":          float(1.0 - min(0.9, final)),
        "avg_utilization":        float(min(1.0, balance / max(income, 1))),
        "complaint_open_count":   float(round(final * 2)),
        "tenure_days":            tenure_months * 30.0,
        "channel_diversity":      max(1.0, 3.0 - final * 2),
    }


def rescore() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )

    # Lazy import — requires torch and torch_geometric
    try:
        from services.scoring.models.graphsage_scorer import GraphSAGEScorer
    except ImportError as exc:
        logger.error("Import failed: %s", exc)
        logger.error("Make sure you are running from the chronos/ directory.")
        sys.exit(1)

    if not SCORES_PATH.exists():
        logger.error("scores_v2.json not found at %s", SCORES_PATH)
        sys.exit(1)

    scorer = GraphSAGEScorer()
    try:
        scorer.load()
    except FileNotFoundError as exc:
        logger.error("%s", exc)
        sys.exit(1)

    with open(SCORES_PATH) as f:
        scores: list[dict] = json.load(f)

    updated = 0
    for record in scores:
        cid = record.get("customer_id", "?")
        features = _build_features(record)
        result = scorer.score(features)

        old_graph_score = record.get("graph_score", None)
        record["graph_score"] = round(result["graph_score"], 4)
        updated += 1

        logger.info(
            "%s: graph_score  %.4f → %.4f",
            cid, old_graph_score or 0.0, record["graph_score"],
        )

    with open(SCORES_PATH, "w") as f:
        json.dump(scores, f, indent=2)

    logger.info("Updated %d customer graph_scores in %s", updated, SCORES_PATH)


if __name__ == "__main__":
    rescore()
