"""GraphSAGE inference wrapper — mirrors HABITATScorer interface.

Loads the trained GraphSAGE checkpoint and scores individual customers
by inserting them as an isolated node (no edges) into a 1-node mini-graph.

Isolated-node rationale: SAGEConv computes
    out = W_root * x + W_neigh * MEAN(x_neighbours)
With no neighbours the aggregation term is zero and the layer reduces to
    out = W_root * x
This is intentional and documented in training_config.honest_caveat —
the production deployment would build a real transaction network.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

logger = logging.getLogger(__name__)

__version__ = "1.0.0"

ROOT = Path(__file__).resolve().parents[3]
CHECKPOINT_PATH = ROOT / "ml" / "checkpoints" / "graphsage_churn.pt"
ATTR_PATH = ROOT / "ml" / "checkpoints" / "graphsage_node_attr.json"


# ---------------------------------------------------------------------------
# Internal model class — mirrored from graphsage_train.py so this module is
# self-contained and does not import from the training package at load time.
# ---------------------------------------------------------------------------

class _GraphSAGEChurn(torch.nn.Module):
    def __init__(self, in_dim: int, hidden_dim: int, out_dim: int, dropout: float) -> None:
        super().__init__()
        self.conv1 = SAGEConv(in_dim, hidden_dim, aggr="mean")
        self.bn1 = torch.nn.BatchNorm1d(hidden_dim)
        self.conv2 = SAGEConv(hidden_dim, out_dim, aggr="mean")
        self.bn2 = torch.nn.BatchNorm1d(out_dim)
        self.lin = torch.nn.Linear(out_dim, 1)
        self._dropout = dropout

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x, edge_index)
        x = self.bn1(x)
        x = F.relu(x)
        x = F.dropout(x, p=self._dropout, training=self.training)
        x = self.conv2(x, edge_index)
        x = self.bn2(x)
        x = F.relu(x)
        x = F.dropout(x, p=self._dropout, training=self.training)
        return self.lin(x).squeeze(-1)

    def predict_proba(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            return torch.sigmoid(self.forward(x, edge_index))


# ---------------------------------------------------------------------------
# Public scorer
# ---------------------------------------------------------------------------

class GraphSAGEScorer:
    """Loads trained GraphSAGE checkpoint and scores individual customers."""

    def __init__(self, checkpoint_path: str | Path = CHECKPOINT_PATH) -> None:
        self._checkpoint_path = Path(checkpoint_path)
        self._model: _GraphSAGEChurn | None = None
        self._scaler_mean: np.ndarray = np.zeros(14)
        self._scaler_scale: np.ndarray = np.ones(14)
        self._graph_stats: dict = {}
        self._attr: dict = {}
        self._feature_names: list[str] = []

    def load(self) -> None:
        if not self._checkpoint_path.exists():
            raise FileNotFoundError(
                f"GraphSAGE checkpoint not found at {self._checkpoint_path}.\n"
                "Train the model first:\n"
                "  cd chronos && python -m ml.training.graphsage_train"
            )

        ckpt = torch.load(self._checkpoint_path, map_location="cpu", weights_only=False)
        cfg = ckpt["model_config"]

        self._model = _GraphSAGEChurn(
            in_dim=cfg["in_dim"],
            hidden_dim=cfg["hidden_dim"],
            out_dim=cfg["out_dim"],
            dropout=cfg["dropout"],
        )
        self._model.load_state_dict(ckpt["model_state_dict"])
        self._model.eval()

        self._scaler_mean = np.array(ckpt["scaler_mean"], dtype=np.float32)
        self._scaler_scale = np.array(ckpt["scaler_scale"], dtype=np.float32)
        self._graph_stats = ckpt.get("graph_stats", {})
        self._feature_names = ckpt.get("feature_names", [])

        attr_path = self._checkpoint_path.parent / "graphsage_node_attr.json"
        if attr_path.exists():
            with open(attr_path) as f:
                self._attr = json.load(f)

        logger.info(
            "GraphSAGE loaded from %s | test_auc=%.4f",
            self._checkpoint_path,
            ckpt.get("test_auc", float("nan")),
        )

    def score(self, customer_features: dict[str, float]) -> dict[str, Any]:
        """Score a single customer via isolated-node inference.

        Args:
            customer_features: Dict mapping PASS1_FEATURE_NAMES to float values.
                               Missing keys default to 0.0.

        Returns:
            {
              "graph_score":   float,    # churn probability 0–1
              "top_features":  list[str], # top-3 by global attribution
              "graph_stats":   dict,      # from checkpoint
              "model_version": str,
            }
        """
        if self._model is None:
            self.load()

        from ml.features.tabular_features import PASS1_FEATURE_NAMES
        feat_names = self._feature_names or PASS1_FEATURE_NAMES

        x_raw = np.array(
            [[customer_features.get(f, 0.0) for f in feat_names]], dtype=np.float32
        )
        # Apply train-set scaler
        x_scaled = (x_raw - self._scaler_mean) / (self._scaler_scale + 1e-9)

        x_tensor = torch.tensor(x_scaled, dtype=torch.float32)
        # 1-node graph — no edges → SAGEConv falls back to root-linear transform
        edge_index = torch.zeros((2, 0), dtype=torch.long)

        self._model.eval()
        with torch.no_grad():
            logit = self._model(x_tensor, edge_index)
            prob = float(torch.sigmoid(logit).item())

        return {
            "graph_score":   float(np.clip(prob, 0.0, 1.0)),
            "top_features":  self._attr.get("top3_features", []),
            "graph_stats":   self._graph_stats,
            "model_version": "graphsage-v1",
        }

    def attribution_reason_codes(self, top_k: int = 3) -> list[dict[str, Any]]:
        """Return global feature importance as reason codes compatible with PRISM.

        Format mirrors HABITATScorer.shap_reason_codes():
            [{"feature": str, "shap_value": float, "direction": str}, ...]

        direction is always "increases_risk" for global importance (unsigned values).
        """
        if not self._attr and self._model is None:
            self.load()

        importance: dict[str, float] = self._attr.get("global_feature_importance", {})
        sorted_feats = sorted(importance.items(), key=lambda kv: kv[1], reverse=True)[:top_k]

        return [
            {
                "feature":   feat,
                "shap_value": imp,
                "direction": "increases_risk",
            }
            for feat, imp in sorted_feats
        ]
