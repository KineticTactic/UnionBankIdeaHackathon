"""nexus_serving.py — serve the trained NEXUS-Baseline checkpoint.

Loads ml/checkpoints/nexus_baseline.pkl and scores a single customer's
propensity for each trainable product NOT already held. Uses the per-product
feature layout saved at train time (base features + basket co-occurrence).

Used by:
  - chronos/api/routers/recommendations.py  (live serving endpoint)
  - chronos/scripts/score_demo_customers.py (batch-score the demo book)
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Iterable

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
CKPT_PATH = ROOT / "ml" / "checkpoints" / "nexus_baseline.pkl"

_BUNDLE = None


def _load():
    global _BUNDLE
    if _BUNDLE is None:
        if not CKPT_PATH.exists():
            raise FileNotFoundError(
                f"NEXUS-Baseline checkpoint missing at {CKPT_PATH}. "
                "Run: python -m ml.training.nexus_baseline_train"
            )
        with open(CKPT_PATH, "rb") as f:
            _BUNDLE = pickle.load(f)
        logger.info("NEXUS-Baseline loaded (%s, %d products)",
                    _BUNDLE["model_version"], len(_BUNDLE["trainable_products"]))
    return _BUNDLE


def trainable_products() -> list[str]:
    return list(_load()["trainable_products"])


def model_version() -> str:
    return _load()["model_version"]


def score(features: dict[str, float], held_products: Iterable[str]) -> dict[str, float]:
    """Return {product: propensity in [0,1]} for every trainable product the
    customer does NOT already hold.

    `features` must contain the base feature names; missing ones default to 0.
    `held_products` is the customer's current holdings (used both to skip
    already-held products and to fill the basket co-occurrence features).
    """
    bundle = _load()
    held = set(held_products)
    models = bundle["models"]
    layout = bundle["feature_layout"]
    base_features = set(bundle["base_features"])

    out: dict[str, float] = {}
    for product, clf in models.items():
        if product in held:
            continue
        cols = layout[product]
        x = [
            float(features.get(c, 0.0)) if c in base_features
            else (1.0 if c in held else 0.0)            # basket co-occurrence
            for c in cols
        ]
        prob = float(clf.predict_proba([x])[0, 1])
        out[product] = round(prob, 4)
    return out


def score_ranked(features: dict[str, float], held_products: Iterable[str]) -> list[dict]:
    """Convenience: ranked list of {product, score} descending."""
    scores = score(features, held_products)
    return [{"product": p, "score": s}
            for p, s in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)]
