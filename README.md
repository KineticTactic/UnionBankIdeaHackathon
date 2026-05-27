# PCOP — Predictive Customer Outreach Platform

> **UnionBank IdeaHackathon 2026** · Full-stack banking intelligence system for proactive churn prevention

PCOP is a seven-layer AI platform that continuously predicts which customers are at risk of leaving, determines the optimal intervention, generates personalised outreach content, and measures the revenue impact — all in a production-grade, real-time pipeline built for retail banking.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [The Seven Layers](#3-the-seven-layers)
4. [Precision Risk Engine (ML Models)](#4-precision-risk-engine-ml-models)
5. [Live Data Pipeline (Kafka)](#5-live-data-pipeline-kafka)
6. [Frontend Application](#6-frontend-application)
7. [API Reference](#7-api-reference)
8. [Quick Start](#8-quick-start)
9. [Port Map](#9-port-map)
10. [Environment Variables](#10-environment-variables)
11. [Trained Model Checkpoints](#11-trained-model-checkpoints)
12. [Security & Secrets Policy](#12-security--secrets-policy)
13. [Project Structure](#13-project-structure)

---

## 1. System Overview

PCOP monitors 20 corporate banking customers in real time. For each customer it answers three questions:

| Question | System component | Output |
|----------|-----------------|--------|
| How likely is this customer to leave, and when? | Precision Risk Engine (ML) | Churn score 0–1, survival curve, urgency horizon |
| What should we do about it? | Action Intelligence (COMPASS) | Next-best-offer, channel, timing, rationale |
| What should we say? | Outreach Engine (HERALD) | Personalised message via Azure AI · DeepSeek |

Results flow through a measurement layer that tracks campaign uplift, then into an analytics layer that surfaces insights for relationship managers.

**Demo credentials:** `admin / admin123`

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Browser  (Next.js 16 · React 19 · Tailwind v4)       port 3000             │
│  Dashboard · Customer Detail · Analytics · Signals · Outreach Hub            │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ REST + SSE (JWT Bearer)
┌────────────────────────────▼─────────────────────────────────────────────────┐
│  Express API Gateway                                   port 8000             │
│  /auth  /api/portfolio  /api/customers  /api/analysis                        │
│  /api/outreach  /api/chronos  /api/v2  /api/kafka                            │
└──────┬──────────────────────────┬────────────────────────────────────────────┘
       │                          │
       │ dataStore.js             │ chronosClient.js
       │ (in-memory, kafka-live)  │
┌──────▼──────────┐    ┌──────────▼────────────────────────────────────────────┐
│  Bank API       │    │  CHRONOS FastAPI                        port 8001     │
│  (demo server)  │    │  Precision Risk Engine scoring service                │
│  port 3001      │    │  /scores  /model-health  /scores/{id}                 │
└─────────────────┘    └──────────────────────────────────────────────────────-┘
                                          ▲
                                          │ train + batch score
                              ┌───────────┴─────────────────────┐
                              │  Kafka Broker   port 9092        │
                              │  6 CBS/CRM/Risk topics           │
                              │  (simulation fallback if absent) │
                              └─────────────────────────────────-┘
```

---

## 3. The Seven Layers

PCOP is structured as seven sequential processing layers. Each layer's output feeds the next.

### Layer 1 — Data Ingestion
**Location:** `bank/`

The demo bank data server exposes the synthetic customer dataset over HTTP. It simulates a Core Banking System (CBS) data lake with account snapshots, transaction histories, CRM complaint records, and engagement logs for 20 customers (IDs `C-00000001` – `C-00000020`).

- Serves customer snapshots, transactions, CRM summaries, and enrichment data
- Backs the Express API gateway via `demoServerClient.js`
- Port: 3001

---

### Layer 2 — ARGUS · Signal Detection
**Location:** `pcop_layer2/`, `pcop_layer2_argus/`

ARGUS continuously scans each customer's behavioural stream for statistically significant anomalies using three detection methods:

| Method | Description | Banking indicator |
|--------|-------------|-------------------|
| **Drift Monitor** (CUSUM) | Cumulative sum control chart detects sustained shifts in transaction volume | Balance erosion, spend drop |
| **Behavioural Shift Detector** (BOCPD) | Bayesian change-point detection finds sudden behavioural transitions | Digital disengagement |
| **Alert Sequencer** (SPRT) | Sequential probability ratio test for compound signal patterns | Multi-signal churn precursors |
| **Intelligent Rule Engine** | Banking-domain rules for hard thresholds | Overdraft, complaint escalation |

ARGUS outputs risk signals (with CUSUM excess expressed in σ above threshold) to the `risk.signal_detections` Kafka topic and the in-memory signal store. The Signals page (`/signals`) displays all 18 active signals in three views: Active Alarms, Customer Risk Grid, and Signal Coverage Matrix.

---

### Layer 3 — Precision Risk Engine · ML Scoring
**Location:** `chronos/`

The core machine-learning layer. Trains and serves a 4-model ensemble that produces a fused churn probability, survival curve, and reason codes for every customer. See [Section 4](#4-precision-risk-engine-ml-models) for model details.

**Trained model checkpoints** (committed to `chronos/ml/checkpoints/`):

| File | Model | Metric |
|------|-------|--------|
| `tare_churn.onnx` | Temporal Action Recurrence Encoder | AUC 0.70+ |
| `habitat_pass1.json` | HABITAT XGBoost tabular scorer | AUC 0.88 |
| `genesis_lr.pkl` | GENESIS cold-start LR | CV AUC 0.65+ |
| `fusion_weights.json` | Ensemble fusion weights | ECE 0.032 |
| `deephit_net.pt` | DeepHit survival model | Brier < 0.25 |

FastAPI service exposes scores at port 8001. The Express gateway proxies `/api/chronos/*` and `/api/v2/*` to this service and caches JSON snapshots in `chronos/data/`.

---

### Layer 4 — COMPASS · Action Intelligence
**Location:** `layer4 compass orchestration/`

A LangGraph orchestration layer that determines the optimal intervention for each at-risk customer. It reads the churn score + survival horizon from Layer 3, then routes through a decision graph:

```
[intake] → [risk_gate] → [survival_check] → [offer_selector] → [channel_router] → [action_plan]
```

- Survival-driven routing: customers with a 7-day urgency horizon bypass standard nurture flows and go directly to priority escalation
- Outputs a structured `ActionPlan` with offer code, channel, timing, and AI rationale
- Action plans are persisted to `chronos/data/action_plans.json` and served via `GET /api/v2/action-plans`

COMPASS results are displayed in the **Action Intelligence · Next Best Offer** panel on each customer's detail page.

---

### Layer 5 — HERALD · Outreach Engine
**Location:** `layer5 herald content generation/`

Generates personalised outreach messages using **Azure AI · DeepSeek** (DeepSeek-V4-Pro-4 deployment on `kensara.services.ai.azure.com`).

HERALD receives a `GenerationBrief` from COMPASS containing:
- Customer segment, tenure, churn score, survival horizon
- Recommended offer code and channel
- Top-3 reason codes from the Precision Risk Engine

It produces channel-specific content (SMS, email, RM visit script, app push) with tone calibrated to the risk tier — empathetic for medium risk, urgent for critical. Content is saved to `chronos/data/herald_content.json`.

The **Outreach Intelligence · Personalised Engagement** panel (`/customers/[id]`) triggers HERALD in real time via `POST /api/analysis/analyze` + `POST /api/outreach/generate`.

---

### Layer 6 — VERDICT · Measurement
**Location:** `layer6 verdict measurement/`

Tracks campaign outcomes and computes uplift using a Doubly Robust (DR) Learner causal model:

- Observes delivery status, open rates, click-throughs, and product uptake
- Computes incremental uplift: `E[Y(1) - Y(0) | X]`
- Feeds back calibrated uplift estimates to FUSION-X for weight recalibration
- Campaigns and outreach records are managed via `/api/outreach/*` and displayed in the **Outreach Hub** (`/outreach`)

---

### Layer 7 — ORACLE · Analytics
**Location:** `layer7 oracle analytics/`

Portfolio-level analytics and insight generation:

- Aggregates risk scores, signal counts, and campaign performance across all 20 customers
- Retrains GraphSAGE, DeepHit, and Temporal Transformer on new labelled outcomes
- Recalibrates FusionXV2 ensemble weights using VERDICT uplift data
- Surfaces results in the **Analytics** page (`/analytics`): churn distribution histogram, risk tier breakdown, 30-day trend, signal-risk correlation, campaign uplift, customer risk register

---

## 4. Precision Risk Engine (ML Models)

The ensemble that powers risk scoring. All models are trained on public datasets — no real customer PII is used.

### Model 1 — TARE · Temporal Action Recurrence Encoder (35% weight)

A GRU-based sequence model that reads each customer's ordered action history (up to 180 banking events) and predicts churn probability.

| Property | Value |
|----------|-------|
| Architecture | Embedding(50→128) + TimeGapEncoding + BiGRU(128×2, 2 layers) + Bahdanau Attention + Dense(256→64→1) |
| Parameters | ~855K |
| Input | Token sequence (180 banking action types) + time gaps |
| Output | Churn probability + attention weights (reason codes) |
| Serving | ONNX Runtime (CPU), target < 50ms |
| Pre-training dataset | MBD-mini (HuggingFace, ~50K rows) — masked action prediction |
| Fine-tuning dataset | BankChurners synthetic sequences (10K rows) |
| Target metric | AUC > 0.70 |

**Training scripts:**
```bash
cd chronos
poetry run python ml/training/tare_pretrain.py --epochs 10
poetry run python ml/training/tare_finetune.py --pretrain-checkpoint ml/checkpoints/tare_pretrain_final.pt
poetry run python ml/training/export_onnx.py --checkpoint ml/checkpoints/tare_finetune_final.pt
```

---

### Model 2 — HABITAT · Hierarchical Adaptive Behaviour Tabular Scorer (30% weight)

XGBoost model scoring customers on 14 tabular behavioural features extracted from transaction and account data.

| Property | Value |
|----------|-------|
| Features (Pass 1) | `recency_days`, `monetary_avg`, `monetary_total`, `frequency_30d`, `frequency_90d`, `decline_rate_30d`, `support_contacts_90d`, `inactivity_streak_days`, `product_count`, `digital_ratio`, `avg_utilization`, `complaint_open_count`, `tenure_days`, `channel_diversity` |
| Pass 2 trigger | Score ≥ 0.35 AND life_events ≥ 1 (adds 9 life-event features) |
| Training dataset | Bank Customer Churn dataset (10K rows, Kaggle) |
| Validation dataset | PKDD'99 Czech Financial (~1M transactions) |
| Interpretability | SHAP values → top-3 reason codes |
| Target metric | AUC > 0.75 |

```bash
poetry run python ml/training/habitat_train.py
```

---

### Model 3 — GraphSAGE · Network Risk Intelligence (20% weight)

A 2-layer GraphSAGE model operating on a Customer–Product k-NN graph. Captures peer-network contagion: customers whose product neighbours have already churned receive elevated risk scores.

| Property | Value |
|----------|-------|
| Graph | Customer–Product k-NN graph, 10,127 nodes |
| Architecture | 2-layer GraphSAGE, Focal BCE loss |
| AUC | 0.93 |
| Training time | 25.6 seconds |
| Checkpoint | `graph_sage.pt` |
| Visualisation | **Network Risk Intelligence · Contagion Map** on dashboard |

---

### Model 4 — DeepHit · Survival Analytics (15% weight)

A competing-risks survival model that produces time-to-churn distributions rather than a single probability. Outputs survival probabilities at 7, 30, and 90-day horizons.

| Property | Value |
|----------|-------|
| Architecture | DeepHitSingle, 90 time bins, 360-day horizon |
| Training dataset | 20,127 synthetic customer records |
| Validation loss | 0.0931 (Brier < 0.25) |
| Training time | 109.8 seconds |
| Checkpoint | `deephit_net.pt` |
| Output | `survival_7d`, `survival_30d`, `survival_90d`, `urgency_horizon` |

Survival curves are displayed in the **Retention Intelligence · Departure Analytics** panel on each customer's detail page.

---

### Ensemble Fusion — FusionXV2

Combines the four model scores using conformal prediction for calibrated uncertainty estimates.

```
final_score = 0.35×TARE + 0.30×HABITAT + 0.20×GraphSAGE + 0.15×DeepHit
```

| Property | Value |
|----------|-------|
| Method | Split conformal prediction (α = 0.10) |
| Calibration | Daily Inverse-Brier weight recalibration |
| Confidence interval | 90% conformal prediction interval |
| ECE threshold | Warning > 0.08 · Critical > 0.15 |
| Avg model disagreement | 0.092 |

---

### Cold-Start — GENESIS (for new customers)

Logistic Regression scorer for customers with tenure < 90 days or fewer than 30 action tokens. Graduates customers to the full ensemble once both thresholds are crossed.

| Property | Value |
|----------|-------|
| Features | 7 (tenure, products, age_bucket, income_band, channel, credit_score_band, city_tier) |
| Training | Bank Customer Churn (10K) + UCI Bank Marketing (45K) |
| Graduation threshold | tenure_days ≥ 90 AND token_count ≥ 30 |

---

## 5. Live Data Pipeline (Kafka)

The Express server maintains a live Kafka connection (or simulation fallback) that streams banking events into the in-memory data store in real time.

### Topics consumed

| Topic | Source | Events |
|-------|--------|--------|
| `cbs.transactions` | Core Banking System | Payment events, card swipes, declines |
| `cbs.account_updates` | CBS | Balance changes, product activations |
| `crm.customer_events` | CRM | Complaints, resolutions, notes |
| `risk.signal_detections` | ARGUS (Layer 2) | CUSUM/BOCPD/SPRT alarm fires |
| `risk.score_updates` | Precision Risk Engine | ML score refreshes |
| `engagement.activity` | Digital channels | App logins, web sessions, clicks |

### Simulation fallback

If the Kafka broker at `localhost:9092` is unreachable, the server automatically switches to **Stream Simulation** mode. A `setInterval` tick fires every 8 seconds and rotates through 6 event types, generating realistic banking events with deterministic customer IDs. Score overrides are applied to `dataStore.CHURN_SCORES` in real time so the frontend reflects live changes.

### Live feed — frontend

The **Live Data Intelligence** card on the dashboard connects to `GET /api/kafka/stream` via Server-Sent Events (SSE). It displays:

- Connection mode badge (Kafka Connected / Stream Simulation / Connecting…)
- Total events ingested, score refreshes, signal updates, transactions, CRM events
- Live event feed (last 25 events with topic colour, customer ID, description, timestamp)

### Kafka API endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/kafka/status` | JWT | Current mode, broker list, message counts |
| `GET /api/kafka/stream` | JWT | SSE stream — emits one JSON event per banking event |
| `POST /api/kafka/publish` | JWT | Manually inject an event for testing |

### Environment variables (Kafka)

```env
KAFKA_BROKERS=localhost:9092       # comma-separated broker addresses
KAFKA_CLIENT_ID=pcop-intelligence-server
KAFKA_GROUP_ID=pcop-consumers
```

---

## 6. Frontend Application

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, and **Recharts**.

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Portfolio Snapshot | KPI cards, churn trend chart, risk distribution, network contagion map, live Kafka feed, risk engine performance |
| `/customers` | Customer List | Searchable, filterable table of all 20 customers with risk tier badges |
| `/customers/[id]` | Customer Detail | Full risk profile, signal panel, financial timeline, outreach generation, survival analytics, action plan, compliance |
| `/analytics` | Analytics | Churn score histogram, risk tier donut, 30-day trend, Precision Risk Engine attribution, signal-risk correlation, campaign uplift |
| `/signals` | Signal Intelligence | Active alarms (sorted by CUSUM σ excess), customer risk grid, signal coverage matrix |
| `/outreach` | Outreach Hub | Campaign performance, channel analytics, outreach record table with customer navigation |
| `/pipeline` | Data Pipeline | Kafka stream status and raw event inspector |

### Key components

| Component | Location | Purpose |
|-----------|----------|---------|
| `KafkaStreamCard` | `components/dashboard/` | SSE live event feed |
| `KnowledgeGraphCard` | `components/dashboard/` | GraphSAGE peer network visualisation |
| `ChronosDashboardCard` | `components/dashboard/` | Precision Risk Engine health metrics |
| `ChronosV2Card` | `components/dashboard/` | Ensemble model performance + portfolio survival |
| `SurvivalPanel` | `components/detail/` | DeepHit survival curves per customer |
| `CompassPanel` | `components/detail/` | COMPASS action plan display |
| `OutreachPanel` | `components/detail/` | HERALD outreach generation (real-time LLM call) |
| `CompliancePanel` | `components/detail/` | Regulatory eligibility checks |
| `TokenTimeline` | `components/detail/` | Customer action token visualisation |
| `AnalysisPanel` | `components/detail/` | On-demand AI risk analysis trigger |

### Authentication

JWT-based auth via `POST /auth/login`. The token is stored in localStorage and attached as `Authorization: Bearer <token>` to all API requests. `ProtectedRoute` wraps every page and redirects unauthenticated users to `/login`.

**Default credentials:** `admin / admin123`

---

## 7. API Reference

All routes (except `/auth/*`) require `Authorization: Bearer <JWT>`.

### Auth

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| POST | `/auth/login` | `{ username, password }` | `{ token, user }` |
| GET | `/auth/me` | — | `{ user }` |

### Portfolio

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/portfolio/stats` | Aggregate KPIs (total, critical, high, avg churn score) |
| GET | `/api/portfolio/risk-distribution` | Count by tier |
| GET | `/api/portfolio/churn-trend` | 30-day churn score time series |
| GET | `/api/portfolio/signal-breakdown` | Signal count by type |
| GET | `/api/portfolio/top-at-risk` | Top 5 customers by churn score |
| GET | `/api/portfolio/market-signals` | External market/competitor signals |

### Customers

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/customers` | All 20 customers (filterable by `tier`, `segment`) |
| GET | `/api/customers/:id/snapshot` | Full customer snapshot (accounts, CRM, enrichment) |
| GET | `/api/customers/:id/signals` | Active risk signals |
| GET | `/api/customers/:id/transactions` | 60-day transaction history |
| GET | `/api/customers/:id/insights` | Behavioural insight cards |

### Analysis & Outreach

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| POST | `/api/analysis/analyze` | `{ customer_id }` | AI risk analysis + recommended action |
| POST | `/api/outreach/generate` | `{ customer_id, analysis_result }` | HERALD-generated personalised message |
| GET | `/api/outreach` | — | Outreach records (filterable) |
| GET | `/api/outreach/campaigns` | — | Campaign list with stats |

### Precision Risk Engine (v2)

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/v2/scores` | All 20 ensemble scores with survival horizons |
| GET | `/api/v2/scores/:id` | Single customer ensemble score |
| GET | `/api/v2/action-plans` | All COMPASS action plans |
| GET | `/api/v2/action-plans/:id` | Single customer action plan |
| GET | `/api/v2/content` | All HERALD pre-generated content |
| GET | `/api/v2/content/:id` | Single customer generated content |
| GET | `/api/v2/model-health` | All 5 model health metrics + ensemble config |
| GET | `/api/v2/portfolio-survival` | Portfolio-level survival summary |

### Kafka

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/kafka/status` | Connection mode, broker list, event counts |
| GET | `/api/kafka/stream` | SSE stream (text/event-stream) |
| POST | `/api/kafka/publish` | Inject test event |

---

## 8. Quick Start

### Prerequisites

- Node.js ≥ 20
- npm (or pnpm: `npm i -g pnpm`)
- Python 3.11+ with Poetry (`pip install poetry`) — only needed for ML scoring
- Docker Desktop — only needed for full Kafka/PostgreSQL stack

---

### Step 1 — Start the Express API gateway (port 8000)

```bash
cd server
npm install
# Create .env (see Section 10 for variables)
node index.js
```

The server starts with an in-memory data store and Kafka simulation mode — no additional services required for a working demo.

---

### Step 2 — Start the frontend (port 3000)

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin / admin123`.

---

### Step 3 (optional) — Start the bank data server (port 3001)

```bash
cd bank
npm install
cp .env.example .env
npm run dev
```

The Express gateway will use this as the upstream data source when `BANK_API_BASE_URL=http://localhost:3001` is set.

---

### Step 4 (optional) — Run the ML scoring service (port 8001)

```bash
cd chronos
poetry install
cp .env.example .env

# Apply database migrations
poetry run alembic upgrade head

# Start scoring API
uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload
```

To run a full batch score of all 20 customers:

```bash
poetry run python -m services.scoring.serving.batch_scorer \
  --bank-api http://localhost:3001 --write-db
```

---

### Step 5 (optional) — Docker compose (Postgres, Kafka, MLflow)

```bash
cd chronos
docker compose up -d
```

| Service | Port |
|---------|------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| Kafka | 9092 |
| MLflow UI | 5000 |

---

### Step 6 (optional) — Train models from scratch

```bash
cd chronos

# 1. Download public training datasets
poetry run python ml/datasets/download_public_datasets.py

# 2. Generate synthetic action sequences
poetry run python ml/generators/synthetic_sequences_from_bankchurners.py

# 3. Train GENESIS (cold-start, < 1 minute)
poetry run python ml/training/genesis_train.py

# 4. Pre-train TARE encoder
poetry run python ml/training/tare_pretrain.py --epochs 10

# 5. Fine-tune TARE on churn labels
poetry run python ml/training/tare_finetune.py \
  --pretrain-checkpoint ml/checkpoints/tare_pretrain_final.pt

# 6. Export to ONNX for fast inference
poetry run python ml/training/export_onnx.py \
  --checkpoint ml/checkpoints/tare_finetune_final.pt

# 7. Train HABITAT XGBoost
poetry run python ml/training/habitat_train.py

# 8. Train CAUSAL-NET uplift model (optional)
poetry run python ml/training/causal_net_train.py --skip-criteo

# 9. Register all models in MLflow
poetry run python ml/register_all_models.py
```

---

## 9. Port Map

| Service | Port | Start command |
|---------|------|--------------|
| Frontend (Next.js) | 3000 | `npm run dev` in `client/` |
| Bank data API | 3001 | `npm run dev` in `bank/` |
| Express API gateway | 8000 | `node index.js` in `server/` |
| CHRONOS FastAPI | 8001 | `uvicorn api.main:app --port 8001` in `chronos/` |
| PostgreSQL | 5432 | Docker Compose |
| Redis | 6379 | Docker Compose |
| Kafka | 9092 | Docker Compose |
| MLflow UI | 5000 | Docker Compose |

---

## 10. Environment Variables

### server/.env

```env
PORT=8000
BANK_API_BASE_URL=http://localhost:3001
JWT_SECRET=change-this-in-production
CHRONOS_BASE_URL=http://localhost:8001

# Kafka (optional — simulation fallback if not set)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=pcop-intelligence-server
KAFKA_GROUP_ID=pcop-consumers

# Azure AI (for HERALD outreach generation)
AZURE_AI_ENDPOINT=https://<your-deployment>.services.ai.azure.com/models/chat/completions
AZURE_AI_API_KEY=<your-azure-api-key>
AZURE_AI_MODEL=DeepSeek-V4-Pro-4
AZURE_AI_API_VERSION=2024-05-01-preview
```

### chronos/.env

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/pcop
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
MLFLOW_TRACKING_URI=http://localhost:5000
```

---

## 11. Trained Model Checkpoints

The following model artifacts are committed to the repository under `chronos/ml/checkpoints/` and loaded at runtime — **no retraining is required for the demo**:

| File | Model | Size | Description |
|------|-------|------|-------------|
| `tare_churn.onnx` | TARE encoder | ~3MB | ONNX Runtime inference graph |
| `tare_churn.onnx.data` | TARE weights | ~3MB | External weight tensor file |
| `tare_pretrain_final.pt` | TARE pre-trained | ~3MB | PyTorch checkpoint before fine-tuning |
| `tare_finetune_best.pt` | TARE fine-tuned (best val) | ~3MB | Best validation epoch |
| `tare_finetune_final.pt` | TARE fine-tuned (final) | ~3MB | Final epoch with Platt scaling |
| `habitat_pass1.json` | HABITAT XGBoost | ~1MB | XGBoost JSON (not pickle) |
| `genesis_lr.pkl` | GENESIS LR | <1KB | Logistic Regression |
| `fusion_weights.json` | FusionXV2 weights | <1KB | Ensemble weights + ECE |
| `causal_net_treated.json` | CAUSAL-NET treated | ~500KB | T-Learner treated arm |
| `causal_net_control.json` | CAUSAL-NET control | ~500KB | T-Learner control arm |
| `causal_net_s_learner.json` | CAUSAL-NET S-Learner | ~500KB | Criteo pre-trained |
| `aegis_reference.json` | AEGIS reference | ~10KB | Training distribution stats for drift detection |

Pre-computed scoring outputs (no FastAPI required):

| File | Location | Description |
|------|----------|-------------|
| `scores_v2.json` | `chronos/data/` | All 20 customers — ensemble score + survival horizons |
| `action_plans.json` | `chronos/data/` | COMPASS action plan per customer |
| `herald_content.json` | `chronos/data/` | HERALD pre-generated outreach content |

---

## 12. Security & Secrets Policy

**The following files are in `.gitignore` and must NEVER be committed:**

| File | Contents |
|------|----------|
| `credentials.txt` | Kaggle / HuggingFace API tokens |
| `AZURE.txt` | Azure AI API key for HERALD |
| `p.txt` | GitHub PAT |
| `**/.env` | All environment files |
| `**/.env.*` | All env variants |
| `*.pem`, `*.key` | TLS certificates |
| `**/client/package-lock.json` | Lock file (unnecessary churn) |
| `**/server/package-lock.json` | Lock file |

**Principle:** All sensitive credentials are read from environment variables at runtime. The Azure AI key for HERALD is loaded via `process.env.AZURE_AI_API_KEY` in `server/services/analysisService.js`. No secrets appear in source code.

---

## 13. Project Structure

```
UnionBankIdeaHackathon/
│
├── README.md                    ← This file
├── implementation.md            ← Sprint implementation notes
│
├── bank/                        ← Layer 1: Demo bank data server (port 3001)
│   ├── src/
│   └── package.json
│
├── pcop_layer2/                 ← Layer 2: ARGUS signal detection (Python)
├── pcop_layer2_argus/           ← ARGUS detection algorithm implementations
│
├── chronos/                     ← Layer 3: Precision Risk Engine (FastAPI + ML)
│   ├── api/                     ← FastAPI application
│   │   ├── main.py
│   │   ├── models/
│   │   └── routers/
│   ├── ml/
│   │   ├── checkpoints/         ← Trained model artifacts (committed)
│   │   ├── datasets/            ← Dataset downloader + manifest
│   │   ├── features/            ← Feature extraction
│   │   ├── generators/          ← Synthetic data generation
│   │   └── training/            ← Model training scripts
│   ├── services/
│   │   └── scoring/             ← Model inference + fusion + guards
│   ├── data/                    ← Pre-computed JSON outputs
│   │   ├── scores_v2.json
│   │   ├── action_plans.json
│   │   └── herald_content.json
│   ├── docker-compose.yml
│   └── pyproject.toml
│
├── layer4 compass orchestration/ ← Layer 4: LangGraph action planning
├── layer5 herald content generation/ ← Layer 5: Azure AI · DeepSeek outreach
├── layer6 verdict measurement/  ← Layer 6: DR-Learner uplift measurement
├── layer7 oracle analytics/     ← Layer 7: Portfolio analytics + model retraining
│
├── server/                      ← Express API gateway (port 8000)
│   ├── index.js                 ← App entry point
│   ├── config.js
│   ├── middleware/
│   │   ├── auth.js              ← JWT verification
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── portfolio.js
│   │   ├── customers.js
│   │   ├── analysis.js          ← AI analysis + outreach generation
│   │   ├── outreach.js
│   │   ├── chronos.js           ← Proxy to CHRONOS FastAPI
│   │   ├── v2.js                ← Precision Risk Engine v2 endpoints
│   │   └── kafka.js             ← Kafka status + SSE stream
│   └── services/
│       ├── kafkaService.js      ← Kafka consumer + simulation fallback
│       ├── dataStore.js         ← In-memory customer/signal store
│       ├── analysisService.js   ← Claude / Azure AI integration
│       ├── claudeService.js     ← Anthropic Claude client
│       ├── chronosClient.js     ← CHRONOS FastAPI HTTP client
│       ├── demoServerClient.js  ← Bank API HTTP client
│       └── localData.js         ← Fallback static data
│
└── client/                      ← Next.js 16 frontend (port 3000)
    └── src/
        ├── app/
        │   ├── dashboard/       ← Portfolio overview
        │   ├── customers/       ← Customer list + [id] detail
        │   ├── analytics/       ← Statistical analysis dashboard
        │   ├── signals/         ← ARGUS alarm feed + coverage matrix
        │   ├── outreach/        ← Outreach hub + campaigns
        │   └── pipeline/        ← Kafka stream inspector
        ├── components/
        │   ├── dashboard/       ← Stat cards, charts, Kafka feed, KG map
        │   ├── detail/          ← Customer detail panels
        │   └── ui/              ← shadcn/ui primitives
        ├── hooks/               ← usePortfolio, useCustomerDetail, useV2CustomerData, useAuth
        ├── lib/
        │   └── api.ts           ← Typed API client
        └── types/
            └── index.ts         ← Shared TypeScript types
```

---

## Model Performance Summary

| Model | Metric | Value | Dataset |
|-------|--------|-------|---------|
| GraphSAGE (Network Risk Intelligence) | AUC | **0.93** | Customer–Product graph |
| HABITAT XGBoost | AUC | **0.88** | Bank Customer Churn (10K) |
| DeepHit Survival | Brier | **< 0.25** | 20K synthetic customers |
| Temporal Transformer (TARE) | Val loss | **0.0956** | Action sequences |
| FusionXV2 Ensemble | ECE | **0.032** | Portfolio calibration |

---

*Built for the UnionBank IdeaHackathon 2026. For questions or issues, open a GitHub issue on this repository.*
