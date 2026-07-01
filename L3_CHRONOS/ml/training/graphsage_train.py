"""Train GraphSAGE peer-similarity churn GNN on Bank Customer Churn dataset.

Graph construction:
  - Nodes  : one per customer (~10 k nodes)
  - Edges  : undirected, connect customers sharing the same Geography
             AND with |Age_i - Age_j| <= AGE_BUCKET (5 years)
             AND in the same Balance decile.
  - Labels : Exited (binary, same as HABITAT)

This is a principled peer-similarity graph — not a transaction network.
Edges represent 'customers with similar profiles in the same geography
are exposed to the same economic shocks and social influence vectors.'
This is stated honestly in model_config and should be stated in the pitch.
"""

from __future__ import annotations

import argparse
import json
import logging
import urllib.request
from pathlib import Path

import mlflow
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.metrics import average_precision_score, log_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import Data
from torch_geometric.nn import SAGEConv

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
BANK_CHURN_PATH = ROOT / "data" / "datasets" / "bank-churn" / "Bank Customer Churn Prediction.csv"
CHECKPOINT_DIR = ROOT / "ml" / "checkpoints"

# Graph construction hyperparameters
AGE_BUCKET = 5           # max age difference for an edge
N_BALANCE_DECILES = 10   # balance bucketed into deciles for edge construction
MAX_EDGES_PER_NODE = 15  # cap: prevent high-degree hub nodes from dominating

# Model hyperparameters
HIDDEN_DIM = 64
DROPOUT = 0.3
EPOCHS = 150
LR = 5e-3
WEIGHT_DECAY = 1e-4
POS_WEIGHT_RATIO = 4.0   # approx inverse of ~20 % churn rate

TARGET_COL = "Exited"
GEO_COL = "Geography"


# ---------------------------------------------------------------------------
# Step 1: Dataset download fallback
# ---------------------------------------------------------------------------

def _ensure_dataset(path: Path) -> Path:
    """Download Bank Customer Churn CSV from public mirror if not present."""
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    url = (
        "https://raw.githubusercontent.com/dsrscientist/dataset1/master/"
        "bank_customer_churn.csv"
    )
    logger.info("Downloading Bank Churn dataset to %s ...", path)
    try:
        urllib.request.urlretrieve(url, path)
        logger.info("Download complete: %d bytes", path.stat().st_size)
    except Exception as exc:
        raise RuntimeError(
            f"Auto-download failed ({exc}). "
            f"Please place 'Bank Customer Churn Prediction.csv' at:\n  {path}"
        ) from exc
    return path


# ---------------------------------------------------------------------------
# Step 2: Feature engineering → 14 HABITAT-compatible features
# ---------------------------------------------------------------------------

def load_and_engineer(
    path: Path,
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Load CSV, engineer 14 PASS1 features, return (df_graph, X_scaled_placeholder, y).

    The returned X is NOT yet scaled — caller must fit StandardScaler on the
    train split and transform all splits before passing to build_graph().

    Returns:
        df_graph : DataFrame with columns [Geography, Age, Balance] for edge construction.
        X_raw    : (N, 14) float32 numpy array — raw (unscaled) feature values.
        y        : (N,)   int numpy array — binary churn labels.
    """
    from ml.features.tabular_features import PASS1_FEATURE_NAMES

    df = pd.read_csv(path)

    # Handle both naming conventions (Kaggle vs. alternative download)
    rename_map = {
        "credit_score": "CreditScore",
        "age": "Age",
        "tenure": "Tenure",
        "balance": "Balance",
        "products_number": "NumOfProducts",
        "credit_card": "HasCrCard",
        "active_member": "IsActiveMember",
        "estimated_salary": "EstimatedSalary",
        "churn": "Exited",
        "geography": "Geography",
        "gender": "Gender",
    }
    df = df.rename(columns=rename_map)

    # Ensure required columns exist
    required = ["CreditScore", "Age", "Tenure", "Balance", "NumOfProducts",
                "HasCrCard", "IsActiveMember", "EstimatedSalary", TARGET_COL]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing columns: {missing}. Got: {list(df.columns)}")

    df = df.dropna(subset=[TARGET_COL]).reset_index(drop=True)

    # Map raw columns → PASS1_FEATURE_NAMES (14 features)
    feat = pd.DataFrame(index=df.index)
    feat["recency_days"] = 30.0
    feat["monetary_avg"] = df["Balance"] / np.maximum(df["Tenure"], 1)
    feat["monetary_total"] = df["Balance"]
    feat["frequency_30d"] = df["NumOfProducts"].astype(float)
    feat["frequency_90d"] = df["NumOfProducts"].astype(float) * 3.0
    feat["decline_rate_30d"] = 0.0
    feat["support_contacts_90d"] = 0.0
    feat["inactivity_streak_days"] = (1 - df["IsActiveMember"]) * 30.0
    feat["product_count"] = df["NumOfProducts"].astype(float)
    feat["digital_ratio"] = df["IsActiveMember"].astype(float)
    feat["avg_utilization"] = np.clip(df["Balance"] / np.maximum(df["EstimatedSalary"], 1), 0, 1)
    feat["complaint_open_count"] = 0.0
    feat["tenure_days"] = df["Tenure"] * 30.0
    feat["channel_diversity"] = df["HasCrCard"].astype(float) + 1.0

    assert list(feat.columns) == PASS1_FEATURE_NAMES, (
        f"Feature schema mismatch: {list(feat.columns)} != {PASS1_FEATURE_NAMES}"
    )

    y = df[TARGET_COL].values.astype(int)
    logger.info("Dataset loaded: %d rows, churn rate=%.1f%%", len(df), 100.0 * y.mean())

    geo = df[GEO_COL].values if GEO_COL in df.columns else np.array(["Unknown"] * len(df))
    df_graph = pd.DataFrame({
        "Geography": geo,
        "Age": df["Age"].values.astype(float),
        "Balance": df["Balance"].values.astype(float),
    })

    return df_graph, feat.values.astype(np.float32), y


# ---------------------------------------------------------------------------
# Step 3: Peer-similarity graph construction
# ---------------------------------------------------------------------------

def build_graph(
    df: pd.DataFrame,
    X: np.ndarray,
    y: np.ndarray,
) -> tuple[Data, float]:
    """Build a PyG Data object with peer-similarity edges.

    Edges connect customers in the same Geography + balance decile where
    |Age_i - Age_j| <= AGE_BUCKET. Nodes with degree > MAX_EDGES_PER_NODE
    are randomly trimmed (seed=42) to prevent hub dominance.

    Returns:
        data       : PyG Data with x=(N,14), edge_index=(2,E), y=(N,)
        avg_degree : mean edges per node (after capping)
    """
    N = len(df)
    ages = df["Age"].values.astype(float)
    geos = df["Geography"].values

    # Balance deciles — duplicates='drop' handles the many-zero-balance case
    try:
        deciles = pd.qcut(df["Balance"], q=N_BALANCE_DECILES, labels=False, duplicates="drop")
    except Exception:
        # Absolute fallback: equal-width bins
        deciles = pd.cut(df["Balance"], bins=N_BALANCE_DECILES, labels=False)
    deciles = np.array(deciles.fillna(0).astype(int))

    rng = np.random.default_rng(seed=42)

    # Build adjacency list: node_idx → list of neighbor node_idxs
    adj: list[list[int]] = [[] for _ in range(N)]

    # Group indices by (Geography, balance_decile)
    groups: dict[tuple, list[int]] = {}
    for i, (geo, dec) in enumerate(zip(geos, deciles)):
        key = (geo, int(dec))
        if key not in groups:
            groups[key] = []
        groups[key].append(i)

    for group_nodes in groups.values():
        n_grp = len(group_nodes)
        if n_grp < 2:
            continue

        grp = np.array(group_nodes)
        grp_ages = ages[grp]

        # Vectorised pairwise age-difference check (upper triangle)
        age_diff = np.abs(grp_ages[:, None] - grp_ages[None, :])   # (n_grp, n_grp)
        mask_upper = np.triu(age_diff <= AGE_BUCKET, k=1)           # no self-loops
        row_idx, col_idx = np.where(mask_upper)

        for ri, ci in zip(row_idx, col_idx):
            i, j = int(grp[ri]), int(grp[ci])
            adj[i].append(j)
            adj[j].append(i)

    # Build edge tensors, capping per-node degree at MAX_EDGES_PER_NODE
    edge_src: list[int] = []
    edge_dst: list[int] = []

    for i, neighbors in enumerate(adj):
        if not neighbors:
            continue
        if len(neighbors) > MAX_EDGES_PER_NODE:
            neighbors = rng.choice(neighbors, MAX_EDGES_PER_NODE, replace=False).tolist()
        for j in neighbors:
            edge_src.append(i)
            edge_dst.append(j)

    edge_index = torch.tensor([edge_src, edge_dst], dtype=torch.long)
    x_tensor = torch.tensor(X, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.long)

    # Graph statistics
    if edge_src:
        degree_counts = np.bincount(edge_src, minlength=N)
    else:
        degree_counts = np.zeros(N, dtype=int)
    avg_deg = float(degree_counts.mean())
    max_deg = int(degree_counts.max())
    E = len(edge_src)

    logger.info(
        "Graph: %d nodes, %d edges, avg_degree=%.1f, max_degree=%d",
        N, E // 2, avg_deg, max_deg,
    )

    data = Data(x=x_tensor, edge_index=edge_index, y=y_tensor)
    return data, avg_deg


# ---------------------------------------------------------------------------
# Step 4: GraphSAGE model
# ---------------------------------------------------------------------------

class GraphSAGEChurn(torch.nn.Module):
    """2-layer GraphSAGE for binary churn classification.

    Architecture:
        SAGEConv(14→64, aggr='mean') → BN → ReLU → Dropout
        SAGEConv(64→32, aggr='mean') → BN → ReLU → Dropout
        Linear(32→1)                  [logits; sigmoid at inference]
    """

    def __init__(
        self,
        in_dim: int = 14,
        hidden_dim: int = HIDDEN_DIM,
        out_dim: int = 32,
        dropout: float = DROPOUT,
    ) -> None:
        super().__init__()
        self.conv1 = SAGEConv(in_dim, hidden_dim, aggr="mean")
        self.bn1 = torch.nn.BatchNorm1d(hidden_dim)
        self.conv2 = SAGEConv(hidden_dim, out_dim, aggr="mean")
        self.bn2 = torch.nn.BatchNorm1d(out_dim)
        self.lin = torch.nn.Linear(out_dim, 1)
        self._dropout = dropout

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Return logits (pre-sigmoid), shape (N,)."""
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
        """Return post-sigmoid probabilities, shape (N,). Inference only."""
        with torch.no_grad():
            return torch.sigmoid(self.forward(x, edge_index))

    @classmethod
    def from_checkpoint(cls, path: Path) -> "GraphSAGEChurn":
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        cfg = ckpt["model_config"]
        model = cls(
            in_dim=cfg["in_dim"],
            hidden_dim=cfg["hidden_dim"],
            out_dim=cfg["out_dim"],
            dropout=cfg["dropout"],
        )
        model.load_state_dict(ckpt["model_state_dict"])
        return model


# ---------------------------------------------------------------------------
# Step 5: Training helpers
# ---------------------------------------------------------------------------

def train_epoch(
    model: GraphSAGEChurn,
    data: Data,
    optimizer: torch.optim.Optimizer,
    criterion: torch.nn.Module,
    train_mask: torch.Tensor,
) -> float:
    model.train()
    optimizer.zero_grad()
    logits = model(data.x, data.edge_index)
    loss = criterion(logits[train_mask], data.y[train_mask].float())
    loss.backward()
    optimizer.step()
    return float(loss.item())


@torch.no_grad()
def evaluate(
    model: GraphSAGEChurn,
    data: Data,
    mask: torch.Tensor,
) -> dict[str, float]:
    model.eval()
    logits = model(data.x, data.edge_index)
    probs = torch.sigmoid(logits[mask]).numpy()
    labels = data.y[mask].numpy()
    return {
        "auc":     float(roc_auc_score(labels, probs)),
        "logloss": float(log_loss(labels, probs)),
        "auprc":   float(average_precision_score(labels, probs)),
    }


# ---------------------------------------------------------------------------
# Step 6: Main train() function
# ---------------------------------------------------------------------------

def train(args: argparse.Namespace) -> None:
    from ml.features.tabular_features import PASS1_FEATURE_NAMES

    _ensure_dataset(BANK_CHURN_PATH)
    df_graph, X_raw, y = load_and_engineer(BANK_CHURN_PATH)

    N = len(y)
    all_idx = np.arange(N)

    # Stratified 70 / 15 / 15 split — identical ratios to HABITAT
    train_idx, tmp_idx = train_test_split(all_idx, test_size=0.30, stratify=y, random_state=42)
    val_idx, test_idx = train_test_split(tmp_idx, test_size=0.50, stratify=y[tmp_idx], random_state=42)

    # Fit scaler on train only; transform val + test with train scaler
    scaler = StandardScaler()
    X_scaled = X_raw.copy()
    X_scaled[train_idx] = scaler.fit_transform(X_raw[train_idx])
    X_scaled[val_idx] = scaler.transform(X_raw[val_idx])
    X_scaled[test_idx] = scaler.transform(X_raw[test_idx])

    data, avg_degree = build_graph(df_graph, X_scaled, y)

    train_mask = torch.zeros(N, dtype=torch.bool)
    val_mask = torch.zeros(N, dtype=torch.bool)
    test_mask = torch.zeros(N, dtype=torch.bool)
    train_mask[train_idx] = True
    val_mask[val_idx] = True
    test_mask[test_idx] = True

    model = GraphSAGEChurn(
        in_dim=14,
        hidden_dim=args.hidden_dim,
        out_dim=32,
        dropout=DROPOUT,
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=WEIGHT_DECAY)
    criterion = torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor([POS_WEIGHT_RATIO]))

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    best_val_auc = 0.0
    patience_counter = 0
    PATIENCE_EVALS = 3   # stop after 3 × 10-epoch windows without improvement

    mlflow.set_experiment(args.experiment)

    with mlflow.start_run():
        mlflow.log_params({
            "hidden_dim":          args.hidden_dim,
            "lr":                  args.lr,
            "epochs":              args.epochs,
            "dropout":             DROPOUT,
            "weight_decay":        WEIGHT_DECAY,
            "pos_weight":          POS_WEIGHT_RATIO,
            "age_bucket":          AGE_BUCKET,
            "n_balance_deciles":   N_BALANCE_DECILES,
            "max_edges_per_node":  MAX_EDGES_PER_NODE,
        })

        for epoch in range(1, args.epochs + 1):
            train_loss = train_epoch(model, data, optimizer, criterion, train_mask)

            if epoch % 10 == 0:
                val_metrics = evaluate(model, data, val_mask)
                logger.info(
                    "Epoch %3d/%d | loss=%.4f | val_auc=%.4f | val_logloss=%.4f | val_auprc=%.4f",
                    epoch, args.epochs,
                    train_loss, val_metrics["auc"], val_metrics["logloss"], val_metrics["auprc"],
                )
                mlflow.log_metrics(
                    {
                        "train_loss": train_loss,
                        "val_auc":    val_metrics["auc"],
                        "val_logloss": val_metrics["logloss"],
                        "val_auprc":  val_metrics["auprc"],
                    },
                    step=epoch,
                )

                if val_metrics["auc"] > best_val_auc:
                    best_val_auc = val_metrics["auc"]
                    patience_counter = 0
                    torch.save({"model_state_dict": model.state_dict()},
                               CHECKPOINT_DIR / "graphsage_best.pt")
                    logger.info("  ↑ New best val_auc=%.4f — checkpoint saved", best_val_auc)
                else:
                    patience_counter += 1
                    if patience_counter >= PATIENCE_EVALS:
                        logger.info("Early stopping at epoch %d (no improvement for %d evals)",
                                    epoch, PATIENCE_EVALS)
                        break

        # Load best checkpoint and eval on test set
        best_ckpt = torch.load(CHECKPOINT_DIR / "graphsage_best.pt",
                               map_location="cpu", weights_only=False)
        model.load_state_dict(best_ckpt["model_state_dict"])

        test_metrics = evaluate(model, data, test_mask)
        logger.info(
            "TEST AUC=%.4f | logloss=%.4f | auprc=%.4f",
            test_metrics["auc"], test_metrics["logloss"], test_metrics["auprc"],
        )
        mlflow.log_metrics(
            {
                "test_auc":    test_metrics["auc"],
                "test_logloss": test_metrics["logloss"],
                "test_auprc":  test_metrics["auprc"],
                "best_val_auc": best_val_auc,
            }
        )

        # Recompute max_degree from the final edge_index
        if data.edge_index.shape[1] > 0:
            max_degree = int(torch.bincount(data.edge_index[0]).max().item())
        else:
            max_degree = 0

        checkpoint: dict = {
            "model_state_dict": model.state_dict(),
            "test_auc":         test_metrics["auc"],
            "test_logloss":     test_metrics["logloss"],
            "test_auprc":       test_metrics["auprc"],
            "best_val_auc":     best_val_auc,
            "scaler_mean":      scaler.mean_.tolist(),
            "scaler_scale":     scaler.scale_.tolist(),
            "graph_stats": {
                "n_nodes":    int(data.num_nodes),
                "n_edges":    int(data.edge_index.shape[1] // 2),
                "avg_degree": float(avg_degree),
                "max_degree": max_degree,
                "edge_basis":  "Geography + Age±5 + Balance decile",
            },
            "model_config": {
                "in_dim":     14,
                "hidden_dim": args.hidden_dim,
                "out_dim":    32,
                "dropout":    DROPOUT,
                "aggr":       "mean",
                "n_layers":   2,
            },
            "training_config": {
                "epochs":             args.epochs,
                "lr":                 args.lr,
                "weight_decay":       WEIGHT_DECAY,
                "pos_weight":         POS_WEIGHT_RATIO,
                "age_bucket":         AGE_BUCKET,
                "n_balance_deciles":  N_BALANCE_DECILES,
                "max_edges_per_node": MAX_EDGES_PER_NODE,
                "train_size":         0.70,
                "val_size":           0.15,
                "test_size":          0.15,
                "random_state":       42,
                "dataset":            "Bank Customer Churn Prediction (Kaggle)",
                "graph_type":         "peer_similarity_undirected",
                "honest_caveat": (
                    "Edges are synthesized from demographic similarity, "
                    "not real transaction network."
                ),
            },
            "feature_names": PASS1_FEATURE_NAMES,
        }

        final_path = CHECKPOINT_DIR / "graphsage_churn.pt"
        torch.save(checkpoint, final_path)
        logger.info("GraphSAGE checkpoint saved to %s", final_path)

        # Feature attribution on test nodes
        from ml.training.graphsage_attribution import compute_node_attributions

        attr_result = compute_node_attributions(model, data, test_mask)
        attr_path = CHECKPOINT_DIR / "graphsage_node_attr.json"
        with open(attr_path, "w") as f:
            json.dump(attr_result, f, indent=2)
        logger.info("Attribution saved to %s | top-3: %s", attr_path, attr_result["top3_features"])

        mlflow.log_artifact(str(final_path))
        mlflow.log_artifact(str(attr_path))

    logger.info("=" * 60)
    logger.info("GraphSAGE training complete.")
    logger.info("  test_auc=%.4f  best_val_auc=%.4f", test_metrics["auc"], best_val_auc)
    logger.info("  top-3 features: %s", attr_result["top3_features"])
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# Step 7: CLI entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )
    parser = argparse.ArgumentParser(
        description="Train GraphSAGE peer-similarity churn GNN"
    )
    parser.add_argument("--experiment", default="GraphSAGE-PeerSimilarity",
                        help="MLflow experiment name")
    parser.add_argument("--epochs",     type=int,   default=EPOCHS,
                        help="Maximum training epochs")
    parser.add_argument("--hidden-dim", type=int,   default=HIDDEN_DIM,
                        help="SAGEConv hidden dimension")
    parser.add_argument("--lr",         type=float, default=LR,
                        help="AdamW learning rate")
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
