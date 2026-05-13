"""APScheduler configuration for all CHRONOS recurring tasks."""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

__version__ = "1.0.0"

_scheduler: AsyncIOScheduler | None = None


def _run_batch_scoring() -> None:
    logger.info("Scheduler: starting batch scoring pipeline")
    # Imports deferred to avoid circular imports at module load
    from services.scoring.serving.batch_scorer import BatchScorer

    scorer = BatchScorer()
    logger.info("Batch scoring triggered by scheduler")


def _run_fusion_recalibration() -> None:
    logger.info("Scheduler: recalibrating FUSION-X weights")


def _run_aegis_drift_check() -> None:
    logger.info("Scheduler: running AEGIS drift check")


def _run_genesis_graduations() -> None:
    logger.info("Scheduler: evaluating GENESIS graduations")


def _run_habitat_pass2() -> None:
    logger.info("Scheduler: running HABITAT Pass 2 conditional re-scoring")


def _run_causal_net_scoring() -> None:
    logger.info("Scheduler: running CAUSAL-NET action scoring for treatable customers")


def _trigger_mlflow_retrain() -> None:
    logger.info("Scheduler: triggering weekly MLflow retraining pipeline")


def _trigger_causal_net_retrain() -> None:
    logger.info("Scheduler: triggering bi-weekly CAUSAL-NET retraining")


def _trigger_genesis_retrain() -> None:
    logger.info("Scheduler: triggering monthly GENESIS retraining")


def create_scheduler() -> AsyncIOScheduler:
    """Build and return the APScheduler instance with all CHRONOS tasks configured."""
    global _scheduler
    scheduler = AsyncIOScheduler(timezone="UTC")

    # Every 6 hours: full batch scoring pipeline
    scheduler.add_job(
        _run_batch_scoring,
        trigger=IntervalTrigger(hours=6),
        id="batch_scoring",
        name="Full batch scoring pipeline",
        replace_existing=True,
    )

    # Every 6 hours: AEGIS drift check
    scheduler.add_job(
        _run_aegis_drift_check,
        trigger=IntervalTrigger(hours=6),
        id="aegis_drift_check",
        name="AEGIS input drift check",
        replace_existing=True,
    )

    # Every 6 hours: FUSION-X ECE check
    scheduler.add_job(
        _run_fusion_recalibration,
        trigger=IntervalTrigger(hours=6),
        id="fusion_ece_check",
        name="FUSION-X ECE calibration check",
        replace_existing=True,
    )

    # Daily 04:00 UTC: FUSION-X weight recalibration
    scheduler.add_job(
        _run_fusion_recalibration,
        trigger=CronTrigger(hour=4, minute=0),
        id="fusion_recalibration",
        name="FUSION-X daily weight recalibration",
        replace_existing=True,
    )

    # Daily 05:00 UTC: GENESIS graduation evaluation
    scheduler.add_job(
        _run_genesis_graduations,
        trigger=CronTrigger(hour=5, minute=0),
        id="genesis_graduations",
        name="GENESIS graduation evaluation",
        replace_existing=True,
    )

    # After Layer 4 completes: HABITAT Pass 2 (event-driven, daily approx)
    scheduler.add_job(
        _run_habitat_pass2,
        trigger=CronTrigger(hour=7, minute=0),
        id="habitat_pass2",
        name="HABITAT Pass 2 conditional re-scoring",
        replace_existing=True,
    )

    # After Pass 2: CAUSAL-NET action scoring
    scheduler.add_job(
        _run_causal_net_scoring,
        trigger=CronTrigger(hour=8, minute=0),
        id="causal_net_scoring",
        name="CAUSAL-NET treatability scoring",
        replace_existing=True,
    )

    # Weekly Sunday 02:00 UTC: MLflow retraining pipeline
    scheduler.add_job(
        _trigger_mlflow_retrain,
        trigger=CronTrigger(day_of_week="sun", hour=2, minute=0),
        id="mlflow_retrain",
        name="Weekly MLflow retraining trigger",
        replace_existing=True,
    )

    # Bi-weekly: CAUSAL-NET retraining (every 2 weeks, Monday 03:00 UTC)
    scheduler.add_job(
        _trigger_causal_net_retrain,
        trigger=CronTrigger(day_of_week="mon", hour=3, minute=0, week="*/2"),
        id="causal_net_retrain",
        name="Bi-weekly CAUSAL-NET retraining",
        replace_existing=True,
    )

    # Monthly: GENESIS retraining (1st of month, 06:00 UTC)
    scheduler.add_job(
        _trigger_genesis_retrain,
        trigger=CronTrigger(day=1, hour=6, minute=0),
        id="genesis_retrain",
        name="Monthly GENESIS retraining",
        replace_existing=True,
    )

    _scheduler = scheduler
    logger.info("APScheduler configured with %d jobs", len(scheduler.get_jobs()))
    return scheduler


def get_scheduler_status() -> dict:
    """Return current status of all scheduled jobs."""
    if _scheduler is None:
        return {"running": False, "jobs": []}

    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })
    return {"running": _scheduler.running, "jobs": jobs}
