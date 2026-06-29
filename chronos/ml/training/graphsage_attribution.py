"""
Gradient-based feature attribution for GraphSAGE.

Method: input_gradient × input (a cheap Integrated-Gradients approximation).
  For each node i in the evaluation mask:
    attr_i = |d sigmoid(logit_i)/d x_i  ×  x_i|   (element-wise)

  global_importance[j] = mean_i(attr_i[j])  — unsigned, averaged over nodes.
  Normalised to sum to 1 so values are directly comparable to HABITAT SHAP.

Saved to: ml/checkpoints/graphsage_node_attr.json
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

import torch

if TYPE_CHECKING:
    from torch_geometric.data import Data

logger = logging.getLogger(__name__)

CHECKPOINT_DIR = Path(__file__).resolve().parents[2] / "ml" / "checkpoints"


def compute_node_attributions(
    model: torch.nn.Module,
    data: "Data",
    mask: torch.Tensor,
) -> dict:
    """Compute input-gradient × input attribution for the masked subset of nodes.

    Args:
        model: Trained GraphSAGEChurn in eval mode.
        data: Full PyG Data object (x, edge_index, y).
        mask: Boolean tensor of shape (N,) selecting which nodes to evaluate.

    Returns:
        {
          "global_feature_importance": {feature_name: float, ...},
          "top3_features": [str, str, str],
          "method": "input_gradient_x_input",
          "n_nodes_evaluated": int,
        }
    """
    from ml.features.tabular_features import PASS1_FEATURE_NAMES

    model.eval()

    # Enable grad on a fresh copy of x so we do not contaminate data.x
    x = data.x.clone().requires_grad_(True)

    logits = model(x, data.edge_index)
    probs = torch.sigmoid(logits[mask])
    probs.sum().backward()

    assert x.grad is not None, "Gradient not populated — check model forward pass"

    grads = x.grad[mask]                  # (N_mask, 14)
    attrs = (grads * x[mask]).abs()       # (N_mask, 14)  element-wise product
    global_imp = attrs.mean(dim=0).detach().numpy()
    global_imp = global_imp / (global_imp.sum() + 1e-9)  # normalise → sum = 1

    importance_dict: dict[str, float] = {
        name: float(val) for name, val in zip(PASS1_FEATURE_NAMES, global_imp)
    }
    top3 = sorted(importance_dict, key=importance_dict.__getitem__, reverse=True)[:3]

    result = {
        "global_feature_importance": importance_dict,
        "top3_features": top3,
        "method": "input_gradient_x_input",
        "n_nodes_evaluated": int(mask.sum().item()),
    }

    logger.info(
        "Attribution computed on %d nodes | top-3: %s",
        result["n_nodes_evaluated"],
        top3,
    )
    return result
