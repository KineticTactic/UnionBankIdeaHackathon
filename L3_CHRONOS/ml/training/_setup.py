"""Shared setup for CHRONOS training scripts.

Inserting ``chronos/`` on ``sys.path`` lets every training script use
``from ml.…`` package imports regardless of the cwd.  Also configures
logging so every script has the same format.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# chronos/ is the directory that contains the ``ml`` package.
_CHRONOS_ROOT = Path(__file__).resolve().parents[2]
if str(_CHRONOS_ROOT) not in sys.path:
    sys.path.insert(0, str(_CHRONOS_ROOT))

# Same for schemas (sibling of L3_CHRONOS/ in the repo root).
_REPO_ROOT = _CHRONOS_ROOT.parent
_SCHEMAS_DIR = _REPO_ROOT / "schemas"
if _SCHEMAS_DIR.exists() and str(_SCHEMAS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCHEMAS_DIR))


def configure_logging(level: str | None = None) -> None:
    """Idempotently configure root logging for training scripts."""
    lvl = (level or os.getenv("CHRONOS_LOG_LEVEL", "INFO")).upper()
    logging.basicConfig(
        level=lvl,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        force=True,
    )
