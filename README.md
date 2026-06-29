# PCOP — Predictive Customer Outreach Platform

> **UnionBank iDEA 2.0 Hackathon 2026** · Team MoneyLords · IIT Guwahati

---

## Problem Statement

This project addresses **PS-3: AI-Driven Proactive Customer Retention for Retail Banking**.

Banks lose customers silently — churn typically takes 60–90 days to manifest in account closure data, by which time intervention is too late. PCOP is a seven-layer intelligence platform that monitors behavioural signals in real time, predicts which customers are approaching a decision point using a 5-model ML ensemble, autonomously determines the optimal retention action via an agentic orchestration layer, and generates hyper-personalised outreach content using NVIDIA DeepSeek V4 Pro — all before the customer disengages.

---

## Live Demo

🔗 **Live App:** [https://moneylords-pcop.up.railway.app](https://moneylords-pcop.up.railway.app)

🎥 **Demo Video:** [https://www.youtube.com/watch?v=HVEjXQ74iBo](https://www.youtube.com/watch?v=HVEjXQ74iBo)

📓 **Technical Walkthrough:** [Open in Google Colab](https://colab.research.google.com/drive/1tOCU-VWpDs-SW6dNmlDM_rAdbpCsEbit?usp=sharing)

**Architecture, stage registry, and inter-service contracts:** see [ARCHITECTURE.md](ARCHITECTURE.md).

**Bubbletea Dev Console:** see [tui/README.md](tui/README.md).

**Demo credentials:**

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Relationship Manager | `rm_user` | `rm123` |
| Risk Officer | `risk_user` | `risk123` |

---

## Tech Stack

**Frontend**
- Next.js 16.2.1 (App Router) · React 19 · TypeScript 5
- Tailwind CSS v4 · shadcn/ui · Recharts v3 · Lucide React

**Backend**
- Node.js · Express 5 · JWT (HS256, 8h) · KafkaJS
- Server-Sent Events (SSE) for real-time streaming

**AI / LLM**
- NVIDIA DeepSeek V4 Pro via `integrate.api.nvidia.com/v1`
- LangGraph (agentic orchestration — COMPASS layer)

**ML / Data Science**
- Python 3.11 · FastAPI · PyTorch 2.2 · ONNX Runtime
- XGBoost 2.0 · scikit-learn · scikit-uplift
- GraphSAGE (PyTorch Geometric) · DeepHit survival modelling
- SHAP (explainability) · Pandas · NumPy

**Infrastructure**
- Railway (production deployment — two services: server + client)
- Apache Kafka (real-time event streaming; simulation fallback if broker absent)
- Docker Compose (local Postgres + Kafka + MLflow stack)
- MLflow (experiment tracking + model registry)

---

## How to Run Locally

### Prerequisites
- Node.js ≥ 20
- Python 3.11+ with Poetry (`pip install poetry`) — only for ML layer
- Go 1.22+ (only for the Bubbletea TUI)
- Docker Desktop — only for full Kafka stack

---

### Option A — One-command demo (Bubbletea TUI)

The recommended way to run the entire system is the **PCOP Dev Console** —
a single Go binary that starts every service, streams their logs in
color, monitors health, and exposes a 27-command palette + a
cron-scheduler.

```bash
cp .env.example .env
docker compose up -d            # Postgres + Redis + Kafka + MLflow
cd tui && go run .              # auto-spawns all 7 layers + frontend
```

See `tui/README.md` and `ARCHITECTURE.md` for the full layout.

### Option B — Manual start (one terminal per service)

#### Step 1 — Start the API server (port 8000)

```bash
cd server
npm install
node index.js
```

The server starts with an in-memory data store and Kafka simulation mode — **no additional services required for a working demo**.

#### Step 2 — Start the frontend (port 3000)

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin / admin123`.

#### Step 3 (recommended) — Start the bank data server (port 3001)

```bash
cd bank
npm install
npm run dev
```

#### Step 4 (recommended) — Start CHRONOS and the layer shims

```bash
cd chronos && poetry install && poetry run uvicorn api.main:app --host 0.0.0.0 --port 8001 &
cd ../pcop_layer2_argus && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8002 &
cd "../layer4 compass orchestration" && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8004 &
cd "../layer5 herald content generation" && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8005 &
cd "../layer6 verdict measurement" && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8006 &
cd "../layer7 oracle analytics" && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8007 &
```

#### Step 5 — Run the end-to-end pipeline test

```bash
python3 scripts/e2e_test.py --limit 5
```

Exits non-zero if any stage fails or returns a mock response.

#### Step 6 (optional) — Train models from scratch

```bash
cd chronos
poetry run python ml/datasets/download_public_datasets.py
poetry run python -m ml.generators.synthetic_sequences_from_bankchurners
poetry run python ml/training/genesis_train.py
poetry run python -m ml.training.tare_pretrain --epochs 10
poetry run python -m ml.training.tare_finetune \
  --pretrain-checkpoint ml/checkpoints/tare_pretrain_final.pt
poetry run python -m ml.training.export_onnx \
  --checkpoint ml/checkpoints/tare_finetune_final.pt \
  --output ml/checkpoints/tare_churn.onnx
poetry run python ml/training/habitat_train.py
poetry run python ml/register_all_models.py
```

---

## The Seven Layers

PCOP processes every customer through a sequential intelligence pipeline:

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 1 · DATA INGESTION                                           │
 │  bank/  →  CBS snapshots, transactions, CRM logs for 20 customers   │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 2 · ARGUS · Signal Detection                                 │
 │  pcop_layer2/  →  CUSUM, BOCPD, SPRT, SA-EWMA, BH-FDR              │
 │  Fires risk signals to Kafka topic: risk.signal_detections          │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 3 · CHRONOS · Precision Risk Engine                          │
 │  chronos/  →  5-model ensemble (TARE + HABITAT + GraphSAGE +        │
 │               DeepHit + GENESIS) fused via FusionXV2                │
 │  Output: churn score 0–1, survival curve, urgency horizon           │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 4 · COMPASS · Action Intelligence                            │
 │  layer4 compass orchestration/  →  LangGraph 7-node agent           │
 │  Output: next-best-offer, channel, timing, rationale                │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 5 · HERALD · Outreach Engine                                 │
 │  layer5 herald content generation/  →  NVIDIA DeepSeek V4 Pro       │
 │  Output: personalised email, SMS, push notification                 │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 6 · VERDICT · Measurement                                    │
 │  layer6 verdict measurement/  →  Doubly Robust causal uplift         │
 │  Output: incremental uplift E[Y(1)−Y(0)|X], campaign ROI            │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  Layer 7 · ORACLE · Analytics & Retraining                          │
 │  layer7 oracle analytics/  →  Portfolio insights + weight           │
 │                                recalibration via VERDICT feedback   │
 └─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
UnionBankIdeaHackathon/
│
├── README.md                           ← This file
├── PCOP_Technical_Walkthrough.ipynb    ← End-to-end system walkthrough
├── docker-compose.yml                  ← Postgres + Kafka + MLflow stack
│
├── bank/                               ← Layer 1: Demo CBS data server (port 3001)
│   └── src/
│
├── pcop_layer2/                        ← Layer 2: ARGUS Python implementation
├── pcop_layer2_argus/                  ← ARGUS algorithm library (CUSUM, BOCPD, SPRT)
│
├── chronos/                            ← Layer 3: Precision Risk Engine
│   ├── api/                            ← FastAPI scoring service (port 8001)
│   ├── ml/
│   │   ├── checkpoints/                ← Trained model artifacts (committed)
│   │   ├── training/                   ← TARE, HABITAT, GraphSAGE, DeepHit scripts
│   │   └── generators/                 ← Synthetic data generation
│   ├── services/scoring/               ← Inference + FusionXV2 ensemble
│   └── data/                           ← Pre-computed JSON outputs (scores, plans, content)
│
├── layer4 compass orchestration/       ← Layer 4: LangGraph action planning
├── layer5 herald content generation/   ← Layer 5: NVIDIA DeepSeek outreach
├── layer6 verdict measurement/         ← Layer 6: DR-Learner uplift measurement
├── layer7 oracle analytics/            ← Layer 7: Portfolio analytics + retraining
│
├── server/                             ← Express API gateway (port 8000)
│   ├── index.js
│   ├── middleware/auth.js              ← JWT + SSE token-query fallback
│   ├── routes/                         ← auth, portfolio, customers, analysis,
│   │                                     outreach, chronos, v2, kafka, reviews
│   └── services/
│       ├── kafkaService.js             ← Kafka consumer + 8s simulation fallback
│       ├── dataStore.js                ← In-memory customer + signal store
│       └── analysisService.js          ← NVIDIA DeepSeek integration
│
└── client/                             ← Next.js 16 frontend (port 3000)
    └── src/
        ├── app/
        │   ├── dashboard/              ← Portfolio overview + live Kafka feed
        │   ├── customers/[id]/         ← Full customer risk profile + AI outreach
        │   ├── analytics/              ← Statistical dashboards + model attribution
        │   ├── signals/                ← ARGUS alarm feed + coverage matrix
        │   ├── outreach/               ← Campaign hub
        │   └── pipeline/               ← Kafka stream inspector
        ├── components/
        │   ├── dashboard/              ← KnowledgeGraphCard, KafkaFeed, ChronosCards
        │   └── detail/                 ← SurvivalPanel, CompassPanel, OutreachPanel
        ├── hooks/                      ← usePortfolio, useCustomerDetail, useAuth
        └── lib/api.ts                  ← Typed API client (40+ endpoints)
```

---

## Dataset

All data used in this project is **100% synthetic** — no real customer PII was used at any stage.

**Demo dataset (`server/data/` and `chronos/data/`):**
- 20 synthetic retail banking customers (`C-00000001` – `C-00000020`)
- Fields: account balance, transaction history, NPS score, product holdings, life events, digital engagement score, segment, tenure
- 8 static JSON files (~314 KB total) served by the Express gateway
- Kafka simulation generates realistic live banking events every 8 seconds

**ML training datasets (public):**

| Dataset | Source | Used for |
|---------|--------|----------|
| Bank Customer Churn | Kaggle (10K rows) | HABITAT XGBoost training + GENESIS LR |
| UCI Bank Marketing | UCI ML Repository (45K rows) | GENESIS cold-start features |
| MBD-mini (Multimodal Banking Dataset) | HuggingFace (~50K rows) | TARE encoder pre-training (masked action prediction) |
| Synthetic action sequences | Generated from BankChurners (10K rows) | TARE fine-tuning |
| Synthetic survival records | Generated by `generate_demo_data.py` (20K rows) | DeepHit training |
| Customer–Product k-NN graph | Constructed from above (10,127 nodes) | GraphSAGE training |

---

## Model Performance (on Synthetic Test Set)

| Model | Role in Ensemble | Key Metric | Value | Training Time |
|-------|-----------------|------------|-------|---------------|
| **GraphSAGE** · Network Risk Intelligence | 20% weight | AUC | **0.93** | ~26s |
| **HABITAT** · XGBoost Tabular Scorer | 30% weight | AUC | **0.88** | ~2 min |
| **DeepHit** · Survival Analytics | 15% weight | Brier score | **< 0.25** | ~110s |
| **TARE** · Temporal Sequence Encoder (GRU) | 35% weight | Val loss | **0.0956** | ~30 min |
| **GENESIS** · Cold-Start LR | Fallback | CV AUC | **0.65+** | < 1 min |
| **FusionXV2** · Conformal Ensemble | Final output | ECE | **0.032** | — |

**ARGUS Signal Detection (Layer 2):**

| Detector | Method | Sensitivity |
|----------|--------|-------------|
| Drift Monitor | CUSUM | Detects 0.5σ sustained balance shifts over 7 days |
| Behavioural Shift | BOCPD (Bayesian) | Online, no window assumption |
| Sequential Alerter | SPRT | α = 0.01, β = 0.05 |
| Multi-Signal FDR | BH procedure | Controls false discovery at q = 0.05 across 18 signals |

---

## Known Limitations

- All ML models trained on synthetic/public data. Performance on real CBS data would require full retraining and regulatory validation.
- The Kafka layer currently runs in simulation mode (no live broker required) — real deployment needs a managed Kafka cluster.
- DeepHit and TARE training data is synthetic; survival curves are indicative, not calibrated on real churn outcomes.
- The demo covers 20 customers. Scaling to production volumes (100K+ customers) would require batch scoring infrastructure and vector database for GraphSAGE.
- HERALD content quality depends on NVIDIA API availability; the system falls back to pre-generated content if the API is unreachable.
- No real-time Core Banking System integration — all data is served from static JSON snapshots updated offline.

---

## Team

**Team MoneyLords** · IIT Guwahati

| Name | Role |
|------|------|
| **Isam Ahammed** | ARGUS signal detection + CHRONOS ensemble — statistical modelling and ML |
| **Atrijo Pal** | COMPASS, HERALD, VERDICT, ORACLE — agentic orchestration, personalisation, causal measurement |
| **Rudrajeet Pal** | REST API, database layer, full-stack dashboard — infrastructure and delivery |

---

## Demo Readiness Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | `GET /health` works on all 7 stage servers and the orchestrator | ✅ | `bank/`, `chronos/`, `argus/`, `compass/`, `herald/`, `verdict/`, `oracle/` shims all expose `/health` returning `{"status":"ok","stage":N,"stage_name":"..."}`. Orchestrator also exposes `/health` and `/health/stages` (probes all 7). |
| 2 | Pipeline run with a real Bank API input produces real output (no mocks) | ✅ | `scripts/e2e_test.py` walks the full Bank → ARGUS → CHRONOS → COMPASS → HERALD → VERDICT → ORACLE pipeline; refuses to run if any stage returns a mock-shaped response. |
| 3 | All inter-stage schemas agree (no field name mismatches) | ✅ | Shared `pcop_schemas/` package (Python + TypeScript) is the source of truth for `CustomerSnapshot`, `ChurnScore`, `SignalResult`, `ActionPlan`, `HeraldResponse`, `ObservationResult`, `AttributeResult`, `OracleCycleResult`. Each stage's FastAPI `response_model` is pinned to these. |
| 4 | `.env.example` covers every required variable | ✅ | Root `.env.example` lists every var for every service, grouped. |
| 5 | TUI starts, shows all services, streams logs in color | ✅ | `cd tui && go run .` — single binary, 2000-line ring buffer, per-service color, status dots polled every 2s. |
| 6 | TUI command `/chronos train` (and 26 others) runs the correct subprocess | ✅ | `tui/config/services.yaml` declares 27 commands; type `/` in the dashboard or browse the Commands page. |
| 7 | Scheduler page shows tasks, their last-run time, and allows re-running | ✅ | Page 2 reads `tui/data/task_history.db` (SQLite); `r` re-runs, `l` views the last output. Cron expressions evaluated by `github.com/robfig/cron/v3`. |
| 8 | `q` in TUI cleanly shuts down all spawned processes | ✅ | Bubbletea `Ctrl+C` / `q` → `mgr.StopAll()` → `SIGTERM` to the process group created with `Setpgid`; 2-second `SIGKILL` backstop. |
| 9 | `e2e_test.sh` / `scripts/e2e_test.py` passes end-to-end without mocked data | ✅ | Run from the TUI: Commands page → "pipeline run" → exits 0 when all stages return real data. The script actively rejects responses containing mock markers. |

---

## Contact

**Team MoneyLords**
Institute: Indian Institute of Technology Guwahati
Email: kensaraworks@gmail.com

**UnionBank iDEA 2.0 Phase 2 Submission**

---

## API Reference (Summary)

All routes except `/auth/*` require `Authorization: Bearer <JWT>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Get JWT token |
| GET | `/api/portfolio/stats` | Aggregate KPIs |
| GET | `/api/portfolio/top-at-risk` | Top customers by churn score |
| GET | `/api/customers` | All 20 customers (filterable) |
| GET | `/api/customers/:id/snapshot` | Full customer profile |
| GET | `/api/customers/:id/signals` | Active ARGUS signals |
| POST | `/api/analysis/analyze` | Trigger AI risk analysis |
| POST | `/api/outreach/generate` | Generate HERALD outreach content |
| GET | `/api/v2/scores` | Ensemble scores + survival horizons |
| GET | `/api/v2/action-plans` | COMPASS action plans |
| GET | `/api/v2/model-health` | Model health + ensemble config |
| GET | `/api/kafka/stream` | SSE live event stream |

Full API documentation is available in the technical walkthrough notebook.

---

## Port Map

| Service | Port | Command |
|---------|------|---------|
| Frontend (Next.js) | 3000 | `npm run dev` in `client/` |
| Express API gateway | 8000 | `node index.js` in `server/` |
| Bank data server | 3001 | `npm run dev` in `bank/` |
| CHRONOS FastAPI | 8001 | `uvicorn api.main:app` in `chronos/` |
| PostgreSQL | 5432 | Docker Compose |
| Kafka | 9092 | Docker Compose |
| MLflow UI | 5000 | Docker Compose |
