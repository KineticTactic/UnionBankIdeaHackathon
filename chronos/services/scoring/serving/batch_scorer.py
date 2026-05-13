"""Batch scoring orchestrator — runs every 6 hours through the full CHRONOS pipeline."""

from __future__ import annotations

import argparse
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

__version__ = "1.0.0"

DEFAULT_BATCH_SIZE = 1024
RISK_TIERS = {
    "critical": (0.80, 1.00),
    "high": (0.60, 0.80),
    "medium": (0.35, 0.60),
    "low": (0.00, 0.35),
}


def _assign_tier(score: float) -> str:
    for tier, (lo, hi) in RISK_TIERS.items():
        if lo <= score < hi:
            return tier
    return "low"


@dataclass
class CustomerRecord:
    customer_id: str
    token_ids: list[int]
    time_gaps: list[float]
    tabular_features: dict[str, float]
    tenure_days: int
    life_events: list[dict] = field(default_factory=list)


@dataclass
class ScoredCustomer:
    customer_id: str
    final_score: float
    tare_score: float | None
    habitat_score: float | None
    is_cold_start: bool
    risk_tier: str
    reason_codes: list[dict]
    model_version: str
    anomaly_flag: bool = False


class BatchScorer:
    """Full CHRONOS batch scoring pipeline."""

    def __init__(
        self,
        tare_onnx_path: str | None = None,
        habitat_model_path: str | None = None,
        genesis_model_path: str | None = None,
        aegis_stats_path: str | None = None,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> None:
        self._batch_size = batch_size

        from services.scoring.serving.onnx_runtime import TARERuntimeSession
        from services.scoring.models.habitat_scorer import HABITATScorer
        from services.scoring.models.genesis_scorer import GENESISScorer
        from services.scoring.guards.aegis_detector import AEGISDetector
        from services.scoring.fusion.fusion_x import FusionX
        from services.scoring.fusion.prism_reconciler import PRISMReconciler

        self._tare_session = TARERuntimeSession(tare_onnx_path) if tare_onnx_path else None
        self._habitat = HABITATScorer(habitat_model_path) if habitat_model_path else HABITATScorer()
        self._genesis = GENESISScorer(genesis_model_path) if genesis_model_path else GENESISScorer()
        self._aegis = AEGISDetector()
        self._fusion = FusionX()
        self._prism = PRISMReconciler()

        if aegis_stats_path:
            self._aegis.load_reference_distributions(aegis_stats_path)

    def _score_tare(self, record: CustomerRecord) -> tuple[float | None, list[float]]:
        """Run TARE ONNX inference; return (score, attn_weights)."""
        if self._tare_session is None:
            return None, []
        try:
            import numpy as np
            ids = np.array([record.token_ids], dtype=np.int64)
            gaps = np.array([record.time_gaps], dtype=np.float32)
            probs, attn = self._tare_session.score(ids, gaps)
            return float(probs[0]), attn[0].tolist()
        except Exception:
            logger.exception("TARE inference failed for customer_id=%s", record.customer_id)
            return None, []

    def _score_habitat(self, record: CustomerRecord) -> tuple[float | None, list[dict]]:
        """Run HABITAT Pass 1; return (score, shap_codes)."""
        try:
            score = self._habitat.score(record.tabular_features)
            shap_codes = self._habitat.shap_reason_codes(record.tabular_features)
            return score, shap_codes
        except Exception:
            logger.exception("HABITAT inference failed for customer_id=%s", record.customer_id)
            return None, []

    def _score_single(self, record: CustomerRecord) -> ScoredCustomer:
        """Score one customer through the full pipeline."""
        from ml.features.sequence_builder import is_cold_start
        from ml.features.cold_start_features import COLD_START_FEATURE_NAMES

        is_cs = is_cold_start(record.token_ids)

        if is_cs:
            cold_feats = {k: record.tabular_features.get(k, 0.0) for k in COLD_START_FEATURE_NAMES}
            try:
                score = self._genesis.score(cold_feats)
                reason_codes = self._genesis.reason_codes(cold_feats)
            except Exception:
                logger.exception("GENESIS failed for customer_id=%s", record.customer_id)
                score = 0.0
                reason_codes = []

            return ScoredCustomer(
                customer_id=record.customer_id,
                final_score=score,
                tare_score=None,
                habitat_score=None,
                is_cold_start=True,
                risk_tier=_assign_tier(score),
                reason_codes=reason_codes,
                model_version="genesis-v1.0",
            )

        # Parallel TARE + HABITAT
        tare_score = None
        habitat_score = None
        attn_weights: list[float] = []
        shap_codes: list[dict] = []

        with ThreadPoolExecutor(max_workers=2) as pool:
            fut_tare = pool.submit(self._score_tare, record)
            fut_habitat = pool.submit(self._score_habitat, record)
            for fut in as_completed([fut_tare, fut_habitat]):
                if fut is fut_tare:
                    tare_score, attn_weights = fut.result()
                else:
                    habitat_score, shap_codes = fut.result()

        # Graceful fallback: if TARE fails, use HABITAT only
        if tare_score is None and habitat_score is not None:
            final_score = habitat_score
            model_version = "habitat-p1-v1.0"
        elif tare_score is not None and habitat_score is None:
            final_score = tare_score
            model_version = "tare-v1.0"
        elif tare_score is not None and habitat_score is not None:
            fusion_result = self._fusion.fuse(tare_score, habitat_score)
            final_score = fusion_result.final_score
            model_version = "fusion-x-v1.0"
        else:
            logger.error("Both TARE and HABITAT failed for customer_id=%s", record.customer_id)
            final_score = 0.0
            model_version = "error"

        # PRISM reason codes
        attn_token_ids = [record.token_ids[i] for i in
                          sorted(range(len(attn_weights)), key=lambda x: attn_weights[x] if attn_weights else 0, reverse=True)[:3]]
        prism_codes = self._prism.reconcile(
            attn_token_ids,
            shap_codes,
            self._fusion.weights.as_dict(),
        )
        reason_codes = [{"category": r.category, "description": r.description, "importance": r.importance, "source": r.source} for r in prism_codes]

        return ScoredCustomer(
            customer_id=record.customer_id,
            final_score=final_score,
            tare_score=tare_score,
            habitat_score=habitat_score,
            is_cold_start=False,
            risk_tier=_assign_tier(final_score),
            reason_codes=reason_codes,
            model_version=model_version,
        )

    def run_full_pipeline(self, customers: list[CustomerRecord]) -> list[ScoredCustomer]:
        """Score all customers through the batch pipeline.

        Args:
            customers: List of CustomerRecord objects.

        Returns:
            List of ScoredCustomer results in the same order.
        """
        total = len(customers)
        t_start = time.perf_counter()
        results: list[ScoredCustomer] = []

        for i in range(0, total, self._batch_size):
            batch = customers[i:i + self._batch_size]
            for j, record in enumerate(batch):
                result = self._score_single(record)
                results.append(result)
                if (i + j + 1) % 100 == 0:
                    logger.info("Scored %d / %d customers", i + j + 1, total)

        elapsed = time.perf_counter() - t_start
        tier_dist = {t: sum(1 for r in results if r.risk_tier == t) for t in RISK_TIERS}

        logger.info(
            "Batch scoring complete: total=%d elapsed=%.1fs tier_distribution=%s",
            total, elapsed, tier_dist,
        )
        return results


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="CHRONOS batch scorer")
    parser.add_argument("--customer-id", help="Score a single customer (debug mode)")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    args = parser.parse_args()

    scorer = BatchScorer(batch_size=args.batch_size)

    if args.customer_id:
        logger.info("Debug mode: scoring single customer %s", args.customer_id)
        dummy = CustomerRecord(
            customer_id=args.customer_id,
            token_ids=[0] * 180,
            time_gaps=[0.0] * 180,
            tabular_features={},
            tenure_days=200,
        )
        result = scorer._score_single(dummy)
        logger.info("Result: %s", result)
    else:
        logger.info("Full pipeline run — load customers from DB and call run_full_pipeline()")


if __name__ == "__main__":
    main()
