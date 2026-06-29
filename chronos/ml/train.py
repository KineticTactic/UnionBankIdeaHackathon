#!/usr/bin/env python3
"""CHRONOS full training pipeline — runs every training step in order."""

from __future__ import annotations

import argparse
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "ml" / "training"
GENERATORS = ROOT / "ml" / "generators"
DATASETS = ROOT / "ml" / "datasets"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train")


def _step(name: str, cmd: list[str], cwd: Path | None = None) -> None:
    border = "━" * 72
    logger.info("%s\n  STEP: %s\n  CMD:  %s\n%s", border, name, " ".join(cmd), border)
    t0 = time.perf_counter()
    env = os.environ.copy()
    if "PYTHONPATH" not in env:
        env["PYTHONPATH"] = str(ROOT)
    if "MLFLOW_TRACKING_URI" not in env:
        env["MLFLOW_TRACKING_URI"] = "http://localhost:5001"
    proc = subprocess.Popen(
        cmd,
        cwd=cwd or str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    if proc.stdout:
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
    rc = proc.wait()
    elapsed = time.perf_counter() - t0
    if rc != 0:
        logger.error("STEP FAILED: %s (exit=%d, elapsed=%.1fs)", name, rc, elapsed)
        sys.exit(rc)
    logger.info("STEP COMPLETE: %s (exit=0, elapsed=%.1fs)\n", name, elapsed)


def run_pipeline(
    skip_download: bool = False,
    skip_criteo: bool = False,
    tare_subset: float | None = None,
    tare_epochs: int | None = None,
    fine_tune_epochs: int | None = None,
) -> None:
    steps: list[tuple[str, list[str]]] = []

    if not skip_download:
        steps.append(
            ("Step 1/9 — Download datasets", [sys.executable, str(DATASETS / "download_public_datasets.py")])
        )

    steps.append(
        ("Step 2/9 — Generate synthetic sequences",
         [sys.executable, str(GENERATORS / "synthetic_sequences_from_bankchurners.py")])
    )

    steps.append(
        ("Step 3/9 — Train GENESIS (cold-start scorer)",
         [sys.executable, str(SCRIPTS / "genesis_train.py")])
    )

    tare_pretrain_cmd = [sys.executable, str(SCRIPTS / "tare_pretrain.py")]
    if tare_subset is not None:
        tare_pretrain_cmd += ["--subset", str(tare_subset)]
    if tare_epochs is not None:
        tare_pretrain_cmd += ["--epochs", str(tare_epochs)]
    steps.append(("Step 4/9 — Pre-train TARE", tare_pretrain_cmd))

    tare_ft_cmd = [sys.executable, str(SCRIPTS / "tare_finetune.py"),
                   "--pretrain-checkpoint", str(ROOT / "ml" / "checkpoints" / "tare_pretrain_final.pt")]
    if fine_tune_epochs is not None:
        tare_ft_cmd += ["--epochs", str(fine_tune_epochs)]
    steps.append(("Step 5/9 — Fine-tune TARE", tare_ft_cmd))

    steps.append(
        ("Step 6a/9 — Install ONNX export deps",
         [sys.executable, "-m", "pip", "install", "onnxscript>=0.1.2"])
    )

    steps.append(
        ("Step 6b/9 — Export TARE to ONNX",
         [sys.executable, str(SCRIPTS / "export_onnx.py")])
    )

    steps.append(
        ("Step 7/9 — Train HABITAT Pass 1 (XGBoost)",
         [sys.executable, str(SCRIPTS / "habitat_train.py")])
    )

    causal_cmd = [sys.executable, str(SCRIPTS / "causal_net_train.py")]
    if skip_criteo:
        causal_cmd.append("--skip-criteo")
    steps.append(("Step 8/9 — Train CAUSAL-NET", causal_cmd))

    steps.append(
        ("Step 9/9 — Register all models in MLflow",
         [sys.executable, str(SCRIPTS.parent / "register_all_models.py")])
    )

    total_t0 = time.perf_counter()
    for name, cmd in steps:
        _step(name, cmd)
    total_elapsed = time.perf_counter() - total_t0

    logger.info("═" * 72)
    logger.info("  FULL PIPELINE COMPLETE — total time: %.1fs (%.1fmin)", total_elapsed, total_elapsed / 60)
    logger.info("═" * 72)


def main() -> None:
    parser = argparse.ArgumentParser(description="CHRONOS full training pipeline")
    parser.add_argument("--skip-download", action="store_true",
                        help="Skip dataset download (use existing data)")
    parser.add_argument("--skip-criteo", action="store_true",
                        help="Skip 25M-row Criteo pre-training for CAUSAL-NET")
    parser.add_argument("--tare-subset", type=float, default=None,
                        help="TARE pre-training data fraction (e.g. 0.01 for quick dev run)")
    parser.add_argument("--tare-epochs", type=int, default=None,
                        help="Override TARE pre-training epochs")
    parser.add_argument("--fine-tune-epochs", type=int, default=None,
                        help="Override TARE fine-tuning epochs")
    args = parser.parse_args()

    run_pipeline(
        skip_download=args.skip_download,
        skip_criteo=args.skip_criteo,
        tare_subset=args.tare_subset,
        tare_epochs=args.tare_epochs,
        fine_tune_epochs=args.fine_tune_epochs,
    )


if __name__ == "__main__":
    main()
