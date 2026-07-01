"""score_demo_customers.py — batch-score the 50 demo customers with the REAL
trained NEXUS-Baseline model, writing server/data/nexus_model_scores.json.

The demo customers are modern Indian-bank profiles; the model was trained on
1990s Czech-koruna Berka data. We bridge the domains with QUANTILE MAPPING:
each demo customer's scale-sensitive feature (income, balance, transaction
volume) is mapped to the Berka value at the SAME percentile, so the trained
model receives in-distribution inputs. Demographic features (age) and basket
co-occurrence (other holdings) pass through directly.

This is honest domain adaptation, clearly labelled in the output. The demo book
covers 10 products; the model only covers the 5 with real Berka labels — Node
blends real model scores (these 5) with the transparent heuristic (the rest).

Run:  python -m scripts.score_demo_customers
Batch cadence matches NEXUS_IMPLEMENTATION.md (daily), not real-time.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np

from ml.generators.pkdd99_loader import load_pkdd99, FEATURE_NAMES
from services.recommend import nexus_serving

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]          # chronos/
REPO = ROOT.parent
DEMO_CUSTOMERS = REPO / "server" / "data" / "customers.json"
OUT_PATH = REPO / "server" / "data" / "nexus_model_scores.json"

TRAINABLE = nexus_serving.trainable_products()


def _quantile_map(demo_vals: np.ndarray, berka_vals: np.ndarray) -> np.ndarray:
    """Map each demo value to the Berka value at the same empirical percentile."""
    demo_sorted = np.sort(demo_vals.astype(float))
    ranks = np.searchsorted(demo_sorted, demo_vals.astype(float), side="right") / max(len(demo_sorted), 1)
    ranks = np.clip(ranks, 0.0, 1.0)
    return np.quantile(berka_vals.astype(float), ranks)


def build_bridged_features(customers: list[dict], berka) -> list[dict]:
    """Return one Berka-space feature dict per demo customer."""
    # Demo raw arrays
    income      = np.array([c.get("income", 0)        or 0 for c in customers], float)
    balance     = np.array([c.get("balance", 0)       or 0 for c in customers], float)
    txn_year    = np.array([(c.get("txn_freq_90d", 0) or 0) * 4 for c in customers], float)
    avg_txn     = np.array([c.get("avg_txn_amount", 0) or 0 for c in customers], float)
    total_txn   = txn_year * avg_txn
    digital     = np.array([c.get("digital_ratio", 0.5) or 0.5 for c in customers], float)
    tenure_days = np.array([(c.get("tenure_months", 0) or 0) * 30 for c in customers], float)

    # Berka reference distributions
    bz = {f: berka[f].values for f in FEATURE_NAMES}

    # Quantile-mapped features (scale-sensitive)
    m_salary  = _quantile_map(income,    bz["district_avg_salary"])
    m_ntx     = _quantile_map(txn_year,  bz["n_transactions"])
    m_avgtx   = _quantile_map(avg_txn,   bz["avg_txn_amount"])
    m_totaltx = _quantile_map(total_txn, bz["total_txn_amount"])
    m_balance = _quantile_map(balance,   bz["last_balance"])
    m_credit  = _quantile_map(digital,   bz["credit_txn_ratio"])
    m_tenure  = _quantile_map(tenure_days, bz["account_tenure_days"])

    berka_unemp_median = float(np.median(bz["district_unemployment"]))

    feats = []
    for i, c in enumerate(customers):
        feats.append({
            "age":                   float(c.get("age", 40) or 40),       # direct
            "is_female":             0.0,                                  # unknown in demo
            "account_tenure_days":   float(m_tenure[i]),
            "n_accounts_owned":      1.0,
            "district_avg_salary":   float(m_salary[i]),
            "district_unemployment": berka_unemp_median,
            "n_transactions":        float(m_ntx[i]),
            "avg_txn_amount":        float(m_avgtx[i]),
            "total_txn_amount":      float(m_totaltx[i]),
            "last_balance":          float(m_balance[i]),
            "credit_txn_ratio":      float(m_credit[i]),
            "freq_monthly":          1.0,
            "freq_weekly":           0.0,
        })
    return feats


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    customers = json.loads(DEMO_CUSTOMERS.read_text(encoding="utf-8"))
    berka = load_pkdd99()
    feats = build_bridged_features(customers, berka)

    out = {"_meta": {
        "model_version": nexus_serving.model_version(),
        "trainable_products": TRAINABLE,
        "method": "trained XGBoost (PKDD'99) + quantile domain-bridge",
        "note": "Real model scores for the 5 PKDD'99-labelled products; "
                "other catalog products fall back to the transparent heuristic in Node.",
    }}

    n_scored = 0
    for c, f in zip(customers, feats):
        held = set(c.get("products", [])) & set(TRAINABLE)
        scores = nexus_serving.score(f, held)             # {product: prob} for not-held trainable
        out[c["customer_id"]] = {
            "scores": scores,
            "held_trainable": sorted(held),
        }
        if scores:
            n_scored += 1

    OUT_PATH.write_text(json.dumps(out, indent=2), encoding="utf-8")
    logger.info("Wrote model scores for %d/%d customers → %s", n_scored, len(customers), OUT_PATH)

    # Spot-check
    sample = customers[0]["customer_id"]
    logger.info("Sample %s: %s", sample, json.dumps(out[sample]["scores"]))


if __name__ == "__main__":
    main()
