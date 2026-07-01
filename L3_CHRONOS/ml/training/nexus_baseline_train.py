"""nexus_baseline_train.py — NEXUS-Baseline: per-product propensity models.

One XGBoost classifier per trainable product, predicting the customer's
propensity to HOLD that product from demographics + behaviour + the customer's
OTHER product holdings (basket co-occurrence — the cross-sell signal).

Honest framing: Berka is cross-sectional (no temporal "next product"), so this
models P(holds product | profile, other holdings) as a propensity proxy for
adoption, not a true next-month prediction. Stated in NEXUS_IMPLEMENTATION.md
§5 / §15. Only PKDD99_TRAINABLE products (real Berka labels) are trained.

Mirrors graphsage_train.py conventions: stratified split, MLflow logging,
per-product AUC/AUPRC, and a popularity baseline for honest comparison.

Run:  python -m ml.training.nexus_baseline_train
"""

from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path

import numpy as np
import mlflow
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from ml.generators.pkdd99_loader import load_pkdd99, FEATURE_NAMES
from ml.features.product_taxonomy import PKDD99_TRAINABLE

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
CKPT_DIR = ROOT / "ml" / "checkpoints"
CKPT_PATH = CKPT_DIR / "nexus_baseline.pkl"
METRICS_PATH = CKPT_DIR / "nexus_baseline_metrics.json"

SEED = 42
TEST_SIZE = 0.25

XGB_PARAMS = dict(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_lambda=1.0,
    eval_metric="logloss",
    random_state=SEED,
    n_jobs=4,
)


def train() -> dict:
    df = load_pkdd99()
    n = len(df)
    logger.info("Training NEXUS-Baseline on %d clients, %d trainable products", n, len(PKDD99_TRAINABLE))

    models: dict[str, XGBClassifier] = {}
    feature_layout: dict[str, list[str]] = {}
    metrics: dict[str, dict] = {}

    mlflow.set_experiment("nexus-baseline")
    with mlflow.start_run(run_name="nexus_baseline_pkdd99"):
        mlflow.log_params({"n_clients": n, "test_size": TEST_SIZE, **XGB_PARAMS})

        for product in PKDD99_TRAINABLE:
            others = [p for p in PKDD99_TRAINABLE if p != product]
            feat_cols = FEATURE_NAMES + others          # basket co-occurrence features
            X = df[feat_cols].values
            y = df[product].values.astype(int)
            prevalence = float(y.mean())

            X_tr, X_te, y_tr, y_te = train_test_split(
                X, y, test_size=TEST_SIZE, random_state=SEED, stratify=y)

            # Handle class imbalance (premium card ~2%)
            pos = max(int(y_tr.sum()), 1)
            neg = int((y_tr == 0).sum())
            spw = neg / pos

            clf = XGBClassifier(scale_pos_weight=spw, **XGB_PARAMS)
            clf.fit(X_tr, y_tr)

            p_te = clf.predict_proba(X_te)[:, 1]
            auc   = roc_auc_score(y_te, p_te) if len(set(y_te)) > 1 else float("nan")
            auprc = average_precision_score(y_te, p_te)
            lift  = auprc / prevalence if prevalence > 0 else float("nan")  # vs popularity baseline

            models[product] = clf
            feature_layout[product] = feat_cols
            metrics[product] = {
                "prevalence": round(prevalence, 4),
                "test_auc": round(float(auc), 4),
                "test_auprc": round(float(auprc), 4),
                "popularity_auprc": round(prevalence, 4),
                "auprc_lift_vs_popularity": round(float(lift), 2),
                "n_positives": int(y.sum()),
            }
            for k, v in metrics[product].items():
                if isinstance(v, (int, float)) and not np.isnan(v):
                    mlflow.log_metric(f"{product}.{k}", v)
            logger.info("  %-20s AUC=%.3f AUPRC=%.3f (pop=%.3f, lift=%.2fx, n+=%d)",
                        product, auc, auprc, prevalence, lift, int(y.sum()))

        macro_auc   = float(np.nanmean([m["test_auc"] for m in metrics.values()]))
        macro_auprc = float(np.nanmean([m["test_auprc"] for m in metrics.values()]))
        macro_lift  = float(np.nanmean([m["auprc_lift_vs_popularity"] for m in metrics.values()]))
        mlflow.log_metric("macro_auc", macro_auc)
        mlflow.log_metric("macro_auprc", macro_auprc)
        mlflow.log_metric("macro_auprc_lift", macro_lift)

    # ── Persist checkpoint + metrics ─────────────────────────────────────────
    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    with open(CKPT_PATH, "wb") as f:
        pickle.dump({
            "models": models,
            "feature_layout": feature_layout,
            "base_features": FEATURE_NAMES,
            "trainable_products": PKDD99_TRAINABLE,
            "model_version": "nexus-baseline-v1",
            "dataset": "pkdd99-berka",
            "honest_caveat": (
                "Cross-sectional propensity-to-hold model on Berka/PKDD'99. "
                "Not a temporal next-product prediction. Only 5 products have real "
                "labels; the rest of the NEXUS catalog is not trained here."
            ),
        }, f)

    summary = {
        "model_version": "nexus-baseline-v1",
        "n_clients": n,
        "macro_auc": round(macro_auc, 4),
        "macro_auprc": round(macro_auprc, 4),
        "macro_auprc_lift_vs_popularity": round(macro_lift, 2),
        "per_product": metrics,
    }
    METRICS_PATH.write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    s = train()
    print("\n" + "=" * 64)
    print("NEXUS-Baseline trained — eval summary")
    print("=" * 64)
    print(f"{'product':<20} {'AUC':>6} {'AUPRC':>7} {'pop':>6} {'lift':>6}")
    for p, m in s["per_product"].items():
        print(f"{p:<20} {m['test_auc']:>6.3f} {m['test_auprc']:>7.3f} "
              f"{m['popularity_auprc']:>6.3f} {m['auprc_lift_vs_popularity']:>5.2f}x")
    print("-" * 64)
    print(f"{'MACRO':<20} {s['macro_auc']:>6.3f} {s['macro_auprc']:>7.3f} "
          f"{'':>6} {s['macro_auprc_lift_vs_popularity']:>5.2f}x")
    print(f"\nCheckpoint: {CKPT_PATH}")
    print(f"Metrics:    {METRICS_PATH}")
