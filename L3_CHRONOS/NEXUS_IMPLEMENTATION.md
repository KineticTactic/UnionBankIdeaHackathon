# NEXUS — Graph-Based Product Recommendation & Cross-Sell Engine
### Detailed Implementation Document · PCOP Layer 3 (CHRONOS sibling) → COMPASS → HERALD

**Name:** NEXUS — *Network-based EXpansion & Upsell Scoring*. Matches the project's naming convention (TARE, HABITAT, GENESIS, GraphSAGE, ARGUS…).

**One-line goal:** given a customer's *current product holdings* and the *holding patterns of similar surrounding customers*, predict which additional products (loans, cards, deposits, insurance) they are most likely to adopt next — filter those against eligibility/compliance rules, defer to the churn model, and hand a ranked, explainable cross-sell list to **COMPASS**, which decides whether HERALD pitches retention, cross-sell, both, or neither.

This document specifies **exactly** what we train on, the model architecture, the training objective, evaluation metrics with concrete targets, the serving contract, the eligibility filter, the COMPASS/HERALD integration, and the demo-side wiring — all grounded against the real files in this repo.

---

## 0. Where NEXUS fits (verified against the repo)

NEXUS is **not** a new microservice. It is a new model family + router *inside CHRONOS*, exactly how GraphSAGE was added to the churn ensemble. It reuses the existing FastAPI app, Postgres engine, scheduler, MLflow setup, and dataset pipeline.

```
CHURN (existing):
  bank API → bank_loader → {TARE, HABITAT, GENESIS, GraphSAGE} → FUSION-X → PRISM
           → churn_scores table → COMPASS.intake (get_churn_score_raw)

CROSS-SELL (NEXUS, new):
  bank API + holdings → nexus_loader → {NEXUS-GNN (primary), NEXUS-Baseline (fallback),
                                        NEXUS-ColdStart} → eligibility filter
           → product_recommendations table → COMPASS.nba (get_product_recommendations_tool)
           → action_plan.offer_code → DISPATCH → Kafka → HERALD
```

**Confirmed integration points (read before coding):**

| What | File | Role |
|---|---|---|
| How COMPASS reads churn | `layer4 compass orchestration/.../nodes/intake.py` → `get_churn_score_raw(customer_id)` | NEXUS mirrors this: a `get_product_recommendations` read |
| Where the cross-sell decision happens | `.../nodes/compass_nba.py` (`compass_nba_node`) | LLM agent already calls `get_offer_eligibility_tool`; add `get_product_recommendations_tool` to its toolset |
| Where the offer is written | `.../tools/db_writes.py` → `write_action_plan_tool(channel, offer_code, …)` | NEXUS's top eligible product becomes `offer_code` |
| Existing GNN to mirror | `chronos/ml/training/graphsage_train.py` | Graph construction, MLflow, StandardScaler-on-train, `honest_caveat` convention |
| The serving trap to avoid | `chronos/services/scoring/models/graphsage_scorer.py:147` (`edge_index = torch.zeros((2,0))`) | NEXUS serving MUST load real holding-edges — see §7 |
| Dataset registry | `chronos/ml/datasets/manifest.json` | `pkdd99` already registered (real card/loan/order ownership) |

---

## 1. Scope & non-goals

**In scope (v1):**
- A fixed product taxonomy (§2).
- **NEXUS-GNN** — a heterogeneous bipartite *customer↔product* link-prediction GNN with *customer↔customer* peer edges. This is the headline model and the pitch centerpiece ("customers like you also hold X").
- **NEXUS-Baseline** — a multi-label gradient-boosted classifier that ships first and is the fallback if the GNN errors.
- **NEXUS-ColdStart** — popularity prior for zero-product customers.
- An **eligibility / compliance filter** that defers to the churn model.
- A new DB table, API router, scheduler job, and the COMPASS tool.
- Demo-side Node service + `/admin/nexus` page so it appears in the live pitch.

**Out of scope for v1 (state as "future work" in the pitch, don't silently skip):**
- Real-time event-triggered re-recommendation — batch (daily) only.
- Interest-rate / credit-limit optimization — NEXUS recommends *which product*, not *what terms*.
- A real transaction-derived customer-customer graph — v1 uses demographic peer-similarity (same honest caveat as GraphSAGE).

---

## 2. Product taxonomy

One stable vocabulary every model, table and contract depends on:

```python
# chronos/ml/features/product_taxonomy.py
PRODUCT_CATALOG: list[str] = [
    "CREDIT_CARD_BASIC",
    "CREDIT_CARD_PREMIUM",
    "PERSONAL_LOAN",
    "HOME_LOAN",
    "CAR_LOAN",
    "FIXED_DEPOSIT",
    "RECURRING_DEPOSIT",
    "DEMAT_ACCOUNT",
    "LIFE_INSURANCE",
    "HEALTH_INSURANCE",
]
PRODUCT_TO_IDX = {p: i for i, p in enumerate(PRODUCT_CATALOG)}
N_PRODUCTS = len(PRODUCT_CATALOG)
```

Keep it 8–12. Each product needs (a) a static feature row (§4.2) and (b) an eligibility rule (§8).

---

## 3. Training data — exactly what we train on

### 3.1 Primary: PKDD'99 Czech Financial Dataset (already registered)

`chronos/ml/datasets/manifest.json` already has:

```json
{ "name": "pkdd99", "source": "kaggle",
  "dataset": "niteshyadav3103/czech-financial-dataset-pkdd-1999",
  "subdirectory": "data/datasets/pkdd99",
  "expected_files": ["account.csv","card.csv","client.csv","disp.csv",
                     "district.csv","loan.csv","order.csv","trans.csv"] }
```

Download it with the existing tool (no new pipeline code):
```bash
cd chronos && python -m ml.datasets.download_public_datasets --only pkdd99
```

This is a **real relational banking dataset** — clients linked to accounts, with actual loan and card ownership — exactly the bipartite structure NEXUS needs. **Verify exact column names against the real CSVs before coding the loader** (the shapes below are from the well-known Berka/PKDD'99 schema, very likely correct but confirm):

| Table | Key columns | Use for NEXUS |
|---|---|---|
| `client.csv` | `client_id`, `birth_number` (DOB+gender), `district_id` | Customer node: age, gender, district |
| `disp.csv` | `disp_id`, `client_id`, `account_id`, `type` | Client↔account link — **OWNER rows only** |
| `account.csv` | `account_id`, `district_id`, `frequency`, `date` | Account open date → tenure proxy |
| `card.csv` | `card_id`, `disp_id`, `type` (junior/classic/gold), `issued` | → `CREDIT_CARD_BASIC` (junior/classic) / `CREDIT_CARD_PREMIUM` (gold) |
| `loan.csv` | `loan_id`, `account_id`, `amount`, `duration`, `payments`, `status` | → `PERSONAL_LOAN` (generic; no purpose field — see caveat) |
| `order.csv` | `order_id`, `account_id`, `amount`, `k_symbol` | `k_symbol="POJISTNE"` → `LIFE_INSURANCE`; `"LEASING"` → `CAR_LOAN` (best proxy) |
| `trans.csv` | transaction rows | Recency / frequency / monetary features |
| `district.csv` | district demographics | Cold-start popularity priors (§7) |

**Honest caveat (put it in the training-script docstring, matching `graphsage_train.py`'s `honest_caveat` field):** PKDD'99 cleanly distinguishes only ~3 product types — card tier, generic loan, insurance/leasing. `HOME_LOAN`, `RECURRING_DEPOSIT`, `DEMAT_ACCOUNT`, `HEALTH_INSURANCE` have **no real ground truth** here. For those: either (a) drop from v1's trainable set and mark "future work," or (b) synthesize plausible holdings the same way `synthetic_sequences_from_bankchurners.py` synthesizes cold-start fields — **clearly labeled synthetic, never claimed as trained signal.** Do not report a per-product metric for a product you had no real labels for.

### 3.2 Stretch: Santander Product Recommendation (Kaggle)

If the 3-product ceiling feels thin, `santander-product-recommendation` has **24 real product flags tracked monthly across 1.5M customers** — the competition task is literally "predict next-month product adoption," a near-perfect match. Add it the standard way:
1. New `manifest.json` entry mirroring the `bank-churn` shape.
2. `chronos/ml/generators/santander_loader.py` mirroring `synthetic_sequences_from_bankchurners.py`.

**Recommendation:** ship v1 on PKDD'99 (zero new pipeline work), treat Santander as a stretch goal. Don't block the baseline on it.

### 3.3 Demo-side data (separate from training — required for the live pitch)

The 50 demo customers in `server/data/customers.json` currently have **`product_count` (an integer) but no product list.** NEXUS needs *which* products each holds. This is a **prerequisite, not polish** (see §10).

---

## 4. Feature engineering

### 4.1 Customer node features — reuse, don't reinvent
Reuse `PASS1_FEATURE_NAMES` from `chronos/ml/features/tabular_features.py` **verbatim** (the same 14-feature vector HABITAT consumes). No new extraction path; NEXUS inherits any future improvements to that function.

### 4.2 Product node features (static, hand-authored — one row per product)
```python
# chronos/ml/features/product_features.py
PRODUCT_FEATURE_NAMES = [
    "is_credit_product",      # 1 if card/loan, else 0
    "is_secured",             # 1 if collateral-backed (home/car), else 0
    "typical_tenure_months",
    "risk_tier",              # 0=low (FD/RD) … 3=high (unsecured personal loan)
]
```

### 4.3 Graph construction — the "surrounding customers" signal (your core idea)

Build a `torch_geometric.data.HeteroData` with **two node types** and **three edge types**:

```python
data = HeteroData()
data["customer"].x = ...   # (N_customers, 14)  — PASS1 features
data["product"].x  = ...   # (N_products, 4)    — static product features

# (a) Bipartite ownership — the collaborative-filtering backbone
data["customer","holds","product"].edge_index   = ...   # from disp/card/loan/order joins
data["product","held_by","customer"].edge_index = ...   # reverse (PyG needs both directions)

# (b) Peer-similarity — "signals of surrounding customers"
#     Reuse graphsage_train.py build_graph() logic almost verbatim:
#     same geography + |age diff| <= 5 + same balance decile, capped at
#     MAX_EDGES_PER_NODE=15 to prevent hub domination.
data["customer","similar_to","customer"].edge_index = ...
```

The peer edges are what make this a *recommendation* system rather than a per-customer classifier: message passing lets a customer inherit adoption signal from demographically-similar neighbors — **"customers like you in your city, age band, and wealth tier also hold a Home Loan."** That is the pitch sentence.

---

## 5. NEXUS-Baseline — ship this first (guarantees a working demo)

Multi-label classifier, structurally identical to HABITAT, predicting `N_PRODUCTS` outputs.

```python
# chronos/services/scoring/models/nexus_baseline.py
class NexusBaselineScorer:
    """Multi-label XGBoost: P(acquire product_i | not currently held).
    Mirrors HABITATScorer.load()/score()/shap_reason_codes() exactly."""

    def score(self, features: dict[str, float], currently_held: set[str]) -> dict[str, float]:
        """Returns {product: prob} for every product NOT in currently_held."""

    def shap_reason_codes(self, features: dict, product: str, top_k: int = 3) -> list[dict]:
        """Same TreeSHAP pattern as HABITATScorer — one explainer per product."""
```

**Training:** `chronos/ml/training/nexus_baseline_train.py`, mirroring `graphsage_train.py` (load → engineer → stratified split → train one XGBoost per product in a loop → eval → checkpoint dict keyed by product → MLflow log).

**Why ship first:** it is the GNN's fallback, it needs no graph, and it alone is demoable. If the GNN slips, NEXUS still works.

---

## 6. NEXUS-GNN — the headline model

### 6.1 Architecture
```python
# chronos/ml/training/nexus_gnn_train.py
class NexusGNN(torch.nn.Module):
    """Heterogeneous 2-layer GraphSAGE encoder + link predictor.

        HeteroConv({
          ('customer','holds','product'):     SAGEConv((14,4), HID),
          ('product','held_by','customer'):   SAGEConv((4,14), HID),
          ('customer','similar_to','customer'):SAGEConv((14,14),HID),
        }) → ReLU → HeteroConv layer 2 → 32-dim embeddings per node type.

    Link score(customer c, product p) = dot(emb_c, emb_p), or a 2-layer MLP
    over concat([emb_c, emb_p]) if dot-product underperforms in validation.
    """
```
Use PyG `HeteroConv` / `HeteroData` — `torch_geometric` is **already a dependency** (imported in `graphsage_train.py`). No new install; just confirm PyG ≥ 2.0. Reuse the hyperparameter spirit of `graphsage_train.py`: `HIDDEN_DIM=64`, `DROPOUT=0.3`, `LR=5e-3`, `WEIGHT_DECAY=1e-4`, MLflow logging, StandardScaler fit on the **train split only**.

### 6.2 Training objective — link prediction (NOT node classification)

This differs from GraphSAGE's churn setup — get it right:

- **Positive edges:** real `(customer, holds, product)` pairs.
- **Negative edges:** random `(customer, product)` pairs the customer does *not* hold, sampled **4:1 negative:positive** per batch (matches `POS_WEIGHT_RATIO=4.0` used for churn).
- **Loss:** binary cross-entropy (or BPR) on `sigmoid(dot(emb_c, emb_p))`.
- **Split — mask EDGES, not nodes:** randomly hide **15% of each customer's `holds` edges** for val/test; train on the rest. The model must rank a customer's hidden held-out product above their sampled negatives. This is standard recommender evaluation and avoids leakage.

### 6.3 Message-passing integrity
Every customer keeps their **non-hidden** `holds` edges + `similar_to` edges during training so embeddings aggregate real neighborhood signal. This is the whole point — and the thing the serving path (§7) must preserve.

---

## 7. Serving contract — read before writing `nexus_gnn_scorer.py`

> **The single biggest implementation risk in this project.** `graphsage_scorer.py:147` scores customers via an **empty `edge_index = torch.zeros((2,0))`** — an isolated node with no neighbors — which silently neutered the existing churn GNN. NEXUS must not repeat this.

```python
# chronos/services/scoring/models/nexus_gnn_scorer.py
class NexusGNNScorer:
    def recommend(self, customer_id, customer_features: dict,
                  current_products: set[str]) -> list[dict]:
        """
        MUST build edge_index from `current_products` (REAL holdings) +
        the customer's peer edges BEFORE the forward pass. Never empty.

        Steps:
          1. Keep the (small, precomputed) training graph in memory.
          2. Insert this customer as a node and attach their REAL holds-edges
             and similar_to peer-edges.
          3. Forward pass → this customer's embedding aggregates from their
             real product + peer neighbors.
          4. Score against every product NOT in current_products (dot / MLP head).
          5. Return ranked top-k with raw scores.
        """
```

**The mantra:** *"Does the live customer have at least one real edge before I run the model?"* If ever no → that customer is the cold-start case (§8), not a degenerate zero-edge GNN call.

---

## 8. Cold-start fallback (zero products on file)

```python
# chronos/services/scoring/serving/nexus_coldstart.py
def coldstart_recommend(customer_features: dict, district_id: str | None) -> list[dict]:
    """Rank products by popularity within the customer's district
    (district.csv aggregates), else global training-set popularity.
    No personalization — deliberately the simplest fallback, same spirit
    as GENESIS being plain logistic regression."""
```
Route here when `len(current_products) == 0`, mirroring how CHRONOS routes to GENESIS when `token_count < 30`.

---

## 9. Eligibility / compliance filter — pitch this as much as the GNN

This is what stops NEXUS being "recommend debt to everyone," and it ties straight into the project's RBI AI-Governance framing in `COMPLIANCE.md`.

```python
# chronos/services/recommend/eligibility.py
ELIGIBILITY_RULES: dict[str, Callable[[dict], bool]] = {
    "PERSONAL_LOAN":       lambda f: f["avg_utilization"] < 0.75 and f["complaint_open_count"] == 0,
    "HOME_LOAN":           lambda f: f["tenure_days"] >= 180 and f["decline_rate_30d"] < 0.2,
    "CAR_LOAN":            lambda f: f["avg_utilization"] < 0.80,
    "CREDIT_CARD_PREMIUM": lambda f: f["monetary_total"] > PREMIUM_THRESHOLD and f["complaint_open_count"] == 0,
    # FD / RD / insurance: no credit-risk gate → default True
}

def filter_recommendations(recs, features, churn_risk_tier) -> list[dict]:
    """Drop/flag any rec failing its rule. CRITICAL RULE: if churn_risk_tier
    is high/critical, suppress new-debt cross-sell — retention should win that
    customer, not cross-sell. Attach `filtered_reason` to every dropped rec
    for the audit log (mirrors AEGIS/SENTINEL gate logging)."""
```

Pull `churn_risk_tier` straight from the customer's `churn_scores` row — free, already computed, and a genuinely strong "we thought about this" detail: **the recommender actively defers to the retention model rather than working in isolation.**

---

## 10. Output schema & the COMPASS → HERALD contract

### 10.1 New table (same pattern as `churn_scores`)
```sql
-- chronos/db/migrations/00X_product_recommendations.sql
CREATE TABLE product_recommendations (
    customer_id      TEXT NOT NULL,
    product          TEXT NOT NULL,
    score            FLOAT NOT NULL,
    source_model     TEXT NOT NULL,   -- 'nexus-gnn' | 'nexus-baseline' | 'coldstart'
    reason_codes     JSONB,
    eligible         BOOLEAN NOT NULL,
    filtered_reason  TEXT,
    scored_at        TIMESTAMPTZ NOT NULL,
    model_version    TEXT NOT NULL,
    PRIMARY KEY (customer_id, product, scored_at)
);
```

### 10.2 API endpoint (mirror `risk_scores.py`)
`chronos/api/routers/recommendations.py`, mounted in `chronos/api/main.py`:
```
GET /recommendations/{customer_id}
```
```json
{
  "customer_id": "CUST00042",
  "recommendations": [
    { "product": "HOME_LOAN", "score": 0.81, "eligible": true,
      "source_model": "nexus-gnn",
      "reason_codes": [
        {"feature": "peer_adoption", "value": 0.62, "direction": "increases_fit",
         "detail": "7 of 15 demographically-similar customers hold a Home Loan"},
        {"feature": "tenure_days", "value": 0.41, "direction": "increases_fit"}
      ]},
    { "product": "FIXED_DEPOSIT", "score": 0.74, "eligible": true, "source_model": "nexus-gnn" }
  ],
  "suppressed": [
    { "product": "PERSONAL_LOAN", "eligible": false,
      "filtered_reason": "churn_risk_tier=high — retention takes priority" }
  ],
  "model_version": "nexus-v1",
  "scored_at": "2026-07-01T06:00:00Z"
}
```

### 10.3 COMPASS integration (exact, against real files)

**Step 1 — add a read tool** in `layer4 compass orchestration/services/orchestration/tools/db_reads.py`, mirroring `get_offer_eligibility_tool` (line ~289):
```python
@tool
async def get_product_recommendations_tool(customer_id: str) -> dict:
    """Return NEXUS's ranked, eligible cross-sell recommendations + reasons.
    Reads the product_recommendations table (or NEXUS /recommendations/{id})."""
```

**Step 2 — register it** in `compass_nba.py`'s `tools = [...]` list (alongside `get_offer_eligibility_tool`).

**Step 3 — extend the NBA decision logic.** `compass_nba_node` already branches on `risk_tier`. Add the cross-sell rule explicitly:
- `risk_tier in {high, critical}` → **suppress cross-sell**, retention messaging only (NEXUS recs already pre-filtered in §9, this is belt-and-suspenders at the orchestration layer).
- `risk_tier in {watch, low}` and a confirmed positive life-event (e.g. salary hike, new job) → cross-sell is *encouraged*; the LLM picks the top eligible NEXUS product.
- Otherwise → LLM weighs both.

**Step 4 — the offer flows to HERALD unchanged.** The NBA agent calls the existing `write_action_plan_tool(channel, offer_code, …)` with NEXUS's top eligible product as `offer_code`. DISPATCH reads `action_plans` → publishes to Kafka → **HERALD** drafts the pitch using the product + its `reason_codes` as grounding. No HERALD change needed beyond letting its prompt consume the cross-sell offer_code (flag this to whoever owns Layer 5).

```
NEXUS table → get_product_recommendations_tool → compass_nba_node (LLM picks)
            → write_action_plan_tool(offer_code=top_product) → action_plans table
            → DISPATCH → Kafka → HERALD draft ("You may be eligible for a Home Loan…")
```

---

## 11. Evaluation — metrics, targets, and what we report

### 11.1 Offline metrics (held-out edges, §6.2 split)

| Metric | What it measures | Target (PKDD'99, small data) |
|---|---|---|
| **Hit Rate@3 / @5** | Did the held-out true product appear in top-K? | Hit@5 ≥ 0.60 |
| **NDCG@5** | Ranking quality (true product ranked high?) | ≥ 0.45 |
| **MAP@5** | Mean average precision across customers | ≥ 0.40 |
| **AUC (held-out pos vs sampled-neg)** | Pairwise ranking, comparable to GraphSAGE churn AUC | ≥ 0.75 |
| **Per-product AUPRC** | Per-product signal (report ONLY for products with real labels) | meaningfully > base rate |
| **Coverage** | % of catalog ever recommended (anti-popularity-collapse) | ≥ 70% of catalog |

**Baseline comparison (required for the pitch):** report NEXUS-GNN vs NEXUS-Baseline vs a **popularity-only** control on the same held-out split. The GNN must beat popularity on NDCG@5/MAP@5 or the "graph adds value" claim is unsupported — and if it doesn't, say so honestly and ship the baseline.

### 11.2 Ablation (proves the "surrounding customers" claim)
Train two GNN variants: **(a)** bipartite-only (`holds` edges), **(b)** bipartite + `similar_to` peer edges. Report the NDCG@5 delta. A positive delta is direct evidence that peer signal helps — this is the single most persuasive number for your stated thesis.

### 11.3 Sanity / honesty checks
- **Already-held leakage:** a recommended product must never be one the customer already holds (assert in serving).
- **Isolated-node guard test:** unit-test that `recommend()` raises/routes-to-coldstart rather than running an empty-edge forward pass (directly prevents the §7 trap).
- **Eligibility coverage:** every dropped rec carries a `filtered_reason`.

### 11.4 What we log to MLflow (mirror `graphsage_train.py`)
Params (hyperparams, edge counts, neg ratio), metrics (all of §11.1 + ablation delta), artifacts (checkpoint, `nexus_node_attr.json`, the eval table), and a `honest_caveat` string in the model config.

---

## 12. File tree (new files)

```
chronos/
  ml/
    features/
      product_taxonomy.py          # §2
      product_features.py          # §4.2
    generators/
      pkdd99_loader.py             # §3.1 — joins client/disp/account/card/loan/order
      santander_loader.py          # §3.2 — stretch
    training/
      nexus_baseline_train.py      # §5
      nexus_gnn_train.py           # §6
  services/
    scoring/
      models/
        nexus_baseline.py          # §5
        nexus_gnn_scorer.py        # §7  (serving contract)
      serving/
        nexus_coldstart.py         # §8
    recommend/
      __init__.py
      eligibility.py               # §9
      orchestrator.py              # combines GNN + baseline + coldstart + eligibility (mirror batch_scorer.py)
  api/
    routers/
      recommendations.py           # §10.2
  db/
    migrations/
      00X_product_recommendations.sql   # §10.1

layer4 compass orchestration/services/orchestration/
  tools/db_reads.py                # ADD get_product_recommendations_tool (§10.3)
  nodes/compass_nba.py             # REGISTER tool + cross-sell branch (§10.3)

server/ (demo app — §13)
  data/customers.json              # ADD products[] array per customer
  services/nexus.js                # demo scoring service
  routes/nexus.js                  # demo API
client/src/app/admin/nexus/page.tsx# demo UI (separate section)
```

**Modified:** `chronos/api/main.py` (mount router), `chronos/services/scoring/scheduler.py` (add daily `_run_nexus_batch` — daily cadence is plenty), `chronos/ml/datasets/manifest.json` (only if adding Santander).

---

## 13. Demo-side build (this is what the judges actually see)

The live demo is the Node/Next.js app reading `server/data/*.json`. The CHRONOS ML is the *credible backing*; the **demo path must work standalone** (same pattern as ARGUS and the RM-assignment engine).

1. **Holdings data — prerequisite.** Add a deterministic `products: string[]` to each of the 50 demo customers, derived from `segment` + `product_count` + `income` (seeded so it's stable across runs). Mark in a comment that production reads real core-banking holdings.
2. **`server/services/nexus.js`** — given a customer, produce ranked recommendations. For the demo, score via a transparent heuristic that *imitates* the GNN's peer logic: for each not-held product, affinity = `w1·segment_fit + w2·peer_adoption_rate + w3·life_event_match`, where `peer_adoption_rate` = fraction of same-segment/city customers in `customers.json` who hold it. This makes the "surrounding customers" story real *in the demo* even before the trained GNN is wired in.
3. **`server/services/eligibility.js`** — port §9 rules; pull `churn_score`/`risk_tier` from the customer record; suppress new-debt for high-risk; attach `filtered_reason`.
4. **`server/routes/nexus.js`** — `GET /api/nexus/:customerId` (ranked recs + suppressed list), `GET /api/nexus/overview` (portfolio cross-sell KPIs).
5. **`client/src/app/admin/nexus/page.tsx`** — **separate section** (its own sidebar nav item). Per-customer: current holdings chips, ranked recommendations with score bars + reason codes ("7 of 15 similar customers hold this"), eligibility pass/fail badges, and a "→ Sent to COMPASS" indicator showing the chosen offer_code. A portfolio overview: top cross-sell opportunities, eligibility-suppression count, churn-deferral count.
6. **Audit:** log every recommendation surfaced + every suppression to `auditLog` (DPDPA Rule 4 consistency).

---

## 14. Phased checklist (each phase leaves the repo runnable)

- [ ] **P0 — Demo holdings.** Add `products[]` to the 50 demo customers (§13.1). *Unblocks the entire demo.*
- [ ] **P1 — Demo NEXUS.** `nexus.js` + `eligibility.js` + `routes/nexus.js` + `/admin/nexus` page (§13). **Fully demoable feature — this is the pitch-critical milestone.**
- [ ] **P2 — Dataset.** Download PKDD'99; write + unit-test `pkdd99_loader.py` (multi-hot holdings + 14 PASS1 features per client). Confirm real column names.
- [ ] **P3 — Baseline model.** `nexus_baseline_train.py` + `NexusBaselineScorer.score()`. Report per-product AUPRC.
- [ ] **P4 — Eligibility (CHRONOS).** `eligibility.py` against baseline output + `churn_scores` lookup.
- [ ] **P5 — API + DB.** Migration, `recommendations.py`, `orchestrator.py` end-to-end (baseline + eligibility). **CHRONOS-side feature complete.**
- [ ] **P6 — GNN.** Build `HeteroData`, train `nexus_gnn_train.py`, report Hit@K/NDCG/MAP + the §11.2 ablation. Implement `NexusGNNScorer.recommend()` **per the §7 serving contract** (with the isolated-node guard test). Swap GNN in as primary, baseline as fallback.
- [ ] **P7 — Cold-start.** `nexus_coldstart.py` + zero-product routing.
- [ ] **P8 — COMPASS wiring.** `get_product_recommendations_tool` + NBA registration + cross-sell branch (§10.3). Verify offer_code reaches HERALD via DISPATCH.
- [ ] **P9 — Scheduler.** Daily `_run_nexus_batch`.
- [ ] **P10 — Tests.** Mirror `chronos/.../tests/` for every new module.

**Critical path for the hackathon:** P0 → P1 (demo) and P2 → P3 → P5 (credible CHRONOS baseline). P6 (GNN) is the headline but highest-risk — do it only after the baseline+demo are solid, and never let its serving path slip into the empty-edge trap.

---

## 15. Honest limitations to state in the pitch

- **PKDD'99 is a 1999 Czech retail dataset** — products/behavior don't map perfectly to a modern Indian bank. Same caveat the team already states for GraphSAGE's training data; state it identically.
- **Partial product coverage** — only ~3 of 10 taxonomy products have real PKDD'99 ground truth; the rest need Santander or clearly-labeled synthetic holdouts. Never claim trained signal for a product without real labels.
- **Peer graph is demographic, not transactional** — `similar_to` edges are synthesized from geography/age/balance, not real referral/relationship data. Honest, and consistent with GraphSAGE.
- **GNN value is conditional on the §7 serving discipline** — if the live path runs an empty edge_index, NEXUS silently degrades to a context-free classifier. The §11.3 guard test exists specifically to prevent that.
- **Demo scoring is heuristic** — the `/admin/nexus` demo uses a transparent peer-adoption heuristic; the trained GNN backs the claim but does not feed the 50-customer live demo unless P6 is wired through. Say which is which.

---

*This document is the implementation contract for NEXUS. Build P0–P1 first for a working demo, P2–P5 for a credible trained baseline, and P6 for the GNN headline — in that order.*
