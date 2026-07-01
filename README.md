# PCOP — Predictive Customer Outreach Platform

> **UnionBank iDEA 2.0 Hackathon 2026** · Team MoneyLords · Indian Institute of Technology Guwahati

<div align="center">
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/tailwind_css.png" alt="Tailwind CSS" title="Tailwind CSS"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/typescript.png" alt="TypeScript" title="TypeScript"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/node_js.png" alt="Node.js" title="Node.js"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/next_js.png" alt="Next.js" title="Next.js"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/python.png" alt="Python" title="Python"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/go.png" alt="Go" title="Go"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/docker.png" alt="Docker" title="Docker"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/kafka.png" alt="kafka" title="kafka"/></code>
</div>

PCOP is a seven-layer intelligence platform that detects retail banking customers approaching a churn decision **weeks before any explicit disengagement signal**, and autonomously orchestrates hyper-personalised, compliance-gated retention outreach through the optimal channel — all while the bank is still well within the intervention window.

---

## Table of Contents

1. [The Problem We Solve](#1-the-problem-we-solve)
2. [What PCOP Delivers](#2-what-pcop-delivers)
3. [Live Demo and Submission Links](#3-live-demo-and-submission-links)
4. [System Architecture](#4-system-architecture)
5. [How to Run Locally](#5-how-to-run-locally)
6. [Project Structure](#6-project-structure)
7. [Datasets and Model Performance](#7-datasets-and-model-performance)
8. [Demo Readiness Checklist](#8-demo-readiness-checklist)
9. [API Reference](#9-api-reference)
10. [Known Limitations](#10-known-limitations)
11. [Team and Contact](#11-team-and-contact)

---

## 1. The Problem We Solve

### Why this matters

- Acquiring a new customer costs **5–7× more** than retaining an existing one
- Traditional batch-scoring churn models have **2–7 day latency** — the intervention window has already closed
- Generic outreach templates produce **less than 3%** response rates vs **12–18%** for personalised content
- Churn typically takes 60–90 days to manifest in account closure data, by which point the customer is already lost

### How PCOP addresses it

PCOP combines a streaming statistical detection layer (ARGUS), a 5-model ML ensemble (CHRONOS), an agentic orchestration layer that decides _what to do_ (COMPASS), and a personalisation layer that decides _exactly what to say_ (HERALD) — all gated by causal measurement (VERDICT) and continuous learning (ORACLE).

The result is a fully agentic pipeline that **identifies risk, decides on the optimal next-best-action, generates content, dispatches outreach, measures incrementality, and retrains itself** — without any human in the loop.

---

## 2. What PCOP Delivers

| Capability                       | Outcome                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| Signal-to-outreach latency       | under 4 hours end-to-end                                               |
| Churn prediction AUC (GraphSAGE) | 0.93 on a 10K-node customer graph                                      |
| False-alarm reduction            | 37% naive FWER to 5% with Benjamini-Hochberg FDR control               |
| Production scale target          | 5 million retail customers                                             |
| Models in the ensemble           | 5 (Logistic Regression + XGBoost + Transformer + GraphSAGE + Survival) |
| Outreach channels orchestrated   | email · SMS · push · phone · RM visit                                  |
| Compliance gating                | automated pre-dispatch (FCA + RBI)                                     |
| Operator interface               | web dashboard + 27-command Bubbletea TUI                               |

---

## 3. Live Demo and Submission Links

| Resource                       | Link                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Live application               | [unionbankideahackathon-production-6810.up.railway.app](https://unionbankideahackathon-production-6810.up.railway.app)                                     |
| Demo video                     | [Watch on YouTube](https://www.youtube.com/watch?v=VnABCvFw94U)                                               |
| Technical walkthrough notebook | [Open in Google Colab](https://colab.research.google.com/drive/1tOCU-VWpDs-SW6dNmlDM_rAdbpCsEbit?usp=sharing) |
| Architecture and contracts     | [ARCHITECTURE.md](ARCHITECTURE.md)                                                                            |
| Compliance and fairness        | [COMPLIANCE.md](COMPLIANCE.md)                                                                                |
| Scaling strategy               | [SCALING.md](SCALING.md)                                                                                      |
| Deployment guide               | [DEPLOYMENT.md](DEPLOYMENT.md)                                                                                |
| Bubbletea Dev Console          | [tui/README.md](tui/README.md)                                                                                |

### Demo credentials

| Role                 | Username    | Password   |
| -------------------- | ----------- | ---------- |
| Administrator        | `admin`     | `admin123` |
| Relationship Manager | `rm_user`   | `rm123`    |
| Risk Officer         | `risk_user` | `risk123`  |

### Five-minute TUI-driven walkthrough (ARGUS layer)

The entire ARGUS demo runs from the TUI command palette — no manual scripting required.

1. **Start services** — open the TUI, press `S` (or type `/open client dashboard`)
2. **Open the client** — type `open client dashboard`
3. **Bulk-evaluate ARGUS** — type `DEMO · bulk-eval + open critical customer`
4. **Watch the client** — the browser opens `/dashboard` and `/customers/CUST-043`; the Signals tab shows 10 detected signals, refreshing every 5 seconds
5. **Add a single signal** — type `argus evaluate CUST-001 (orchestrator bridge)`
6. **Open that customer** — type `open client customer CUST-001`
7. **Browse to Signals** — click the Signals tab to see the live ARGUS output

All commands are exposed in the TUI command palette (key `3`) and the dashboard command input (`/`). The client auto-polls every 5 seconds, so a fresh ARGUS evaluation appears in the UI within about 5 seconds of triggering.

---

## 4. System Architecture

PCOP processes every customer through a sequential intelligence pipeline:

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L1  DATA INGESTION                                                  │
 │  bank/  →  CBS snapshots, transactions, CRM logs for 20 customers    │
 └───────────────────────────────┬─────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L2  ARGUS  ·  Signal Detection                                     │
 │  L2_ARGUS/  →  CUSUM · BOCPD · SPRT · SA-EWMA · BH-FDR              │
 │  Fires risk signals to Kafka topic: risk.signal_detections          │
 └───────────────────────────────┬─────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L3  CHRONOS  ·  Precision Risk Engine                              │
 │  L3_CHRONOS/  →  5-model ensemble                                   │
 │                  (TARE + HABITAT + GraphSAGE + DeepHit + GENESIS)    │
 │                  fused via FusionXV2                                 │
 │  Output: churn score 0–1 · survival curve · urgency horizon         │
 └───────────────────────────────┬─────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L4  COMPASS  ·  Action Intelligence                                │
 │  L4_COMPASS/  →  LangGraph 7-node agent                             │
 │  Output: next-best-offer · channel · timing · rationale             │
 └───────────────────────────────┬─────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L5  HERALD  ·  Outreach Engine                                     │
 │  L5_HERALD/  →  NVIDIA-hosted LLM                                   │
 │  Output: personalised email · SMS · push notification · RM briefing │
 └───────────────────────────────┬─────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L6  VERDICT  ·  Measurement                                        │
 │  L6_VERDICT/  →  Doubly-Robust causal uplift                        │
 │  Output: incremental uplift E[Y(1)−Y(0)|X] · campaign ROI           │
 └───────────────────────────────┬─────────────────────────────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L7  ORACLE  ·  Analytics and Retraining                            │
 │  L7_ORACLE/  →  Portfolio insights + weight recalibration           │
 │                  via VERDICT feedback                               │
 └─────────────────────────────────────────────────────────────────────┘
```

Data flows top-to-bottom. Feedback flows bottom-to-top: L7 retrains L3 weekly, optimises L5 prompts daily, and updates L4 channel policy in real time.

The full stage registry, inter-stage Pydantic contracts, and model artifact locations are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

### The five-model ensemble (CHRONOS, L3)

| Model     | Role                                                           | Weight   | Training data                  |
| --------- | -------------------------------------------------------------- | -------- | ------------------------------ |
| GraphSAGE | Network risk intelligence over the customer–product k-NN graph | 20%      | 10,127-node synthetic graph    |
| HABITAT   | XGBoost tabular scorer on 14 engineered behavioural features   | 30%      | BankChurners 10K               |
| TARE      | GRU-based temporal sequence encoder                            | 35%      | BankChurners 10K sequences     |
| DeepHit   | Survival modelling with 3-horizon probability                  | 15%      | 20K synthetic survival records |
| GENESIS   | Cold-start logistic regression fallback                        | fallback | Bank Churn 10K + UCI 45K       |
| FusionXV2 | Conformal-ensemble meta-learner                                | final    | All model outputs              |

### ARGUS sub-components (L2)

| Component  | Role                                 | Statistical basis                                                                     |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| **HERALD** | Per-stream adaptive change detection | Shiryaev-Roberts (gradual drift), two-sided CUSUM (sudden shift), SPRT (rare events)  |
| **NEXUS**  | Correlation structure monitor        | Graphical lasso precision matrix per segment; flags changes in signal co-movement     |
| **ORACLE** | Multivariate joint arbiter           | G-BOCPD (Bayesian online changepoint detection)                                       |
| **WARDEN** | Multiple testing controller          | Benjamini-Hochberg FDR at α = 0.05 across 18 signals; reduces naive FWER of 37% to 5% |
| **TEMPO**  | Adaptive baseline manager            | Kalman filter for drift-resistant μ₀ estimation                                       |
| **ECHO**   | Signal expiry and TTL                | 72-hour TTL prevents stale signals contaminating ORACLE                               |

### NEXUS — Cross-Sell Recommendation Engine

Sitting between CHRONOS and COMPASS, NEXUS is the recommendation layer that turns churn intelligence into portfolio growth. For every customer, NEXUS surfaces ranked, explainable product pitches by combining:

- A live **peer-adoption heuristic** — the fraction of demographically similar customers (same segment, same city) who already hold each product. Computed live over the 50-customer book.
- A trained **NEXUS-Baseline** XGBoost model (trained on the PKDD'99 bank marketing dataset, batch-produced by CHRONOS) for the five label-backed products. Quantile-bridged onto the demo book and loaded as `server/data/nexus_model_scores.json`.
- A **segment affinity prior** from `productCatalog.js` that captures prior cross-sell likelihood by customer segment.
- A **life-event boost** layer that elevates pitches for products that historically match a detected life event (e.g. retirement → fixed deposit, relocation → home loan, wedding → life and health insurance).

The composite fit score is

```
fit(product) = 0.35 · segment_affinity
             + 0.45 · peer_adoption_rate
             + 0.20 · life_event_match
```

Every surfaced recommendation is then passed through `services/eligibility.js` — a compliance and churn-deferral gate that suppresses:

- products the customer already holds
- products outside their segment's risk profile
- cross-sells for customers with active high-risk churn signals (deferred until retention is resolved)
- offers that conflict with DPDPA / RBI / FCA disclosure rules

NEXUS exposes six API endpoints (see the [API Reference](#9-api-reference)), powers the operator console at `/admin/nexus` (a force-directed graph of customers and their recommended products with per-product fit breakdowns), and hands off to COMPASS for the final pitch decision. Every surfaced pitch and every COMPASS handoff is written to the DPDPA-compliant audit log.

---

## 5. How to Run Locally

### Prerequisites

| Tool           | Version       | Required for                                     |
| -------------- | ------------- | ------------------------------------------------ |
| Node.js        | 20 or newer   | Frontend, orchestrator, bank data server         |
| Python         | 3.11 or newer | CHRONOS, ARGUS, COMPASS, HERALD, VERDICT, ORACLE |
| Poetry         | latest        | Python dependency manager for the ML layer       |
| Go             | 1.22 or newer | The Bubbletea Dev Console TUI                    |
| Docker Desktop | latest        | Postgres + Kafka + MLflow local stack            |

### Option A — One-command demo (Bubbletea TUI, recommended)

The recommended way to run the entire system is the **PCOP Dev Console** — a single Go binary that starts every service, streams their logs in colour, monitors health, and exposes a 27-command palette plus a cron scheduler.

```bash
cp .env.example .env
docker compose up -d            # Postgres + Redis + Kafka + MLflow
cd tui && go run .             # auto-spawns all 7 layers + frontend
```

The TUI auto-detects the repo root, loads `tui/config/services.yaml`, spawns every app service, starts the background health poller, and opens the Dashboard view with per-service status dots and a colour-coded log panel. See [tui/README.md](tui/README.md) for the full layout.

### Option B — Manual start (one terminal per service)

**Step 1 — Start the API server (port 8000)**

```bash
cd server
npm install
node index.js
```

The server starts with an in-memory data store and Kafka simulation mode — no additional services are required for a working demo.

**Step 2 — Start the frontend (port 3000)**

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin / admin123`.

**Step 3 (recommended) — Start the bank data server (port 3001)**

```bash
cd bank
npm install
npm run dev
```

**Step 4 (recommended) — Start CHRONOS and the layer services**

```bash
cd L3_CHRONOS                  && poetry install && poetry run uvicorn api.main:app --host 0.0.0.0 --port 8001 &
cd ../L2_ARGUS                 && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8002 &
cd ../L4_COMPASS               && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8004 &
cd ../L5_HERALD                && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8005 &
cd ../L6_VERDICT               && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8006 &
cd ../L7_ORACLE                && PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8007 &
```

**Step 5 — Run the end-to-end pipeline test**

```bash
python3 scripts/e2e_test.py --limit 5
```

Exits non-zero if any stage fails or returns a mock response.

**Step 6 (optional) — Train models from scratch**

```bash
cd L3_CHRONOS
poetry run python ml/datasets/download_public_datasets.py
poetry run python -m ml.generators.synthetic_sequences_from_bankchurners
poetry run python ml/training/genesis_train.py
poetry run python -m ml.training.tare_pretrain --epochs 10
poetry run python -m ml.training.tare_finetune \
  --pretrain-checkpoint ml/checkpoints/tare_pretrain_final.pt
poetry run python -m ml/training/export_onnx \
  --checkpoint ml/checkpoints/tare_finetune_final.pt \
  --output ml/checkpoints/tare_churn.onnx
poetry run python ml/training/habitat_train.py
poetry run python ml/register_all_models.py
```

**Step 7 (optional) — Simulate live events**

The server has a built-in 8-second simulation tick, but for a demo-friendly pace, use the standalone simulator:

```bash
# Burst 50 events as fast as possible (great for screenshots)
python3 scripts/simulate_events.py --burst 50

# Continuous stream at 2 events per second for 60 seconds
python3 scripts/simulate_events.py --rate 2 --duration 60

# Pre-built demo scenario: 3 signals + score spike + complaint on one customer
python3 scripts/simulate_events.py --scenario critical_cascade --customer CUST-001

# Live ARGUS evaluation: fetch Bank data, run 9 HERALD agents, write
# detected signals back to the orchestrator's in-memory store
python3 scripts/simulate_events.py --argus CUST-001
```

**Step 7b (optional) — Live ARGUS evaluation via the API**

ARGUS (L2) runs the full agent suite — HERALD detectors, NEXUS correlation monitor, ORACLE joint arbiter, and WARDEN FDR controller — for a single customer. The orchestrator exposes a bridge route that fetches Bank data, transforms it into the `herald_data` shape ARGUS expects, calls the Python service, persists the updated agent state, and writes the detected signals back into the customer's profile so they appear in the client's Signals tab.

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://localhost:8000/api/argus/evaluate-customer/CUST-001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
```

The response includes a `signals` array (one entry per agent) with `signal_type`, `detected`, `confidence`, `cusum_value`, `alarm_threshold`, `method`, and `days_active` — the exact shape the client's Signals tab expects. The WARDEN severity (CRITICAL / HIGH / MEDIUM / LOW / NONE) is included in `warden.severity`.

Events flow through `POST /api/kafka/publish` → orchestrator SSE (`/api/kafka/stream`) → Next.js `KafkaFeed` component → live dashboard. The TUI shows them under the `orchestrator` tab and exposes all five simulator commands on the Commands page.

---

## 6. Project Structure

```
UnionBankIdeaHackathon/
│
├── README.md                           ← This file
├── ARCHITECTURE.md                     ← Stage registry, contracts, model artifacts
├── COMPLIANCE.md                       ← FCA + RBI compliance and fairness audit
├── SCALING.md                          ← 100K → 5M customer scaling strategy
├── DEPLOYMENT.md                       ← Azure VM + Container Apps deployment
├── docker-compose.yml                  ← Postgres + Redis + Kafka + MLflow
│
├── bank/                               ← L1: Demo CBS data server (port 3001)
│
├── L2_ARGUS/                           ← L2: ARGUS statistical signal detection
├── L3_CHRONOS/                         ← L3: 5-model ensemble + FusionXV2
│   ├── api/                            ← FastAPI scoring service (port 8001)
│   ├── ml/
│   │   ├── checkpoints/                ← Trained model artifacts
│   │   ├── training/                   ← TARE, HABITAT, GraphSAGE, DeepHit
│   │   └── generators/                 ← Synthetic data generation
│   ├── services/scoring/               ← Inference + FusionXV2 ensemble
│   └── data/                           ← Pre-computed JSON outputs
├── L4_COMPASS/                         ← L4: LangGraph action planning
├── L5_HERALD/                          ← L5: NVIDIA-hosted LLM outreach
├── L6_VERDICT/                         ← L6: Doubly-Robust causal uplift
├── L7_ORACLE/                          ← L7: Portfolio analytics + retraining
│
├── schemas/                            ← Shared inter-stage contracts (Pydantic + TS)
│
├── server/                             ← Express API gateway (port 8000)
│   ├── index.js
│   ├── middleware/auth.js              ← JWT + SSE token-query fallback
│   ├── routes/                         ← auth, portfolio, customers, analysis,
│   │                                     outreach, chronos, v2, kafka, reviews
│   └── services/
│       ├── kafkaService.js             ← Kafka consumer + 8s simulation fallback
│       ├── dataStore.js                ← In-memory customer + signal store
│       ├── analysisService.js          ← NVIDIA LLM integration
│       ├── nexus.js                    ← NEXUS cross-sell scoring (peer-adoption heuristic + trained XGBoost)
│       ├── eligibility.js              ← Compliance + churn-deferral gate for NEXUS recommendations
│       ├── productCatalog.js           ← NEXUS product taxonomy + segment affinity priors
│       └── auditLogService.js          ← DPDPA-compliant audit log writer
│
├── client/                             ← Next.js 16 frontend (port 3000)
│   └── src/
│       ├── app/
│       │   ├── dashboard/              ← Portfolio overview + live Kafka feed
│       │   ├── customers/[id]/         ← Full customer risk profile + outreach
│       │   ├── analytics/              ← Statistical dashboards + attribution
│       │   ├── signals/                ← ARGUS alarm feed + coverage matrix
│       │   ├── pipeline/               ← Kafka stream inspector
│       │   ├── models/                 ← Model health and ensemble config
│       │   ├── admin/                  ← Operator console
│       │   │   ├── argus/              ← Signal inspection
│       │   │   ├── nexus/              ← Recommendation graph
│       │   │   ├── audit/              ← Audit trail
│       │   │   ├── compliance/         ← Compliance review
│       │   │   ├── escalations/        ← Escalation queue
│       │   │   ├── graphsage/          ← GraphSAGE model view
│       │   │   ├── architecture/       ← Layer topology view
│       │   │   ├── pipeline/           ← Pipeline monitor
│       │   │   ├── relearning/         ← Continuous-learning controls
│       │   │   ├── rms/                ← RM performance
│       │   │   ├── onboarding/         ← RM assignment and segmentation
│       │   │   └── settings/           ← Operator settings
│       │   ├── rm/                     ← Relationship Manager workspace
│       │   │   ├── today/              ← Daily task list
│       │   │   ├── book/               ← Customer book
│       │   │   ├── calls/              ← Call briefings
│       │   │   ├── compose/            ← Outreach composer
│       │   │   ├── customers/          ← RM customer view
│       │   │   ├── outreach/           ← Campaign hub
│       │   │   ├── outcomes/           ← Outcome tracking
│       │   │   ├── performance/        ← RM performance dashboard
│       │   │   └── tasks/              ← Task queue
│       │   └── login/                  ← Authentication
│       ├── components/                 ← Shared UI primitives
│       ├── hooks/                      ← React data hooks
│       └── lib/api.ts                  ← Typed API client (40+ endpoints)
│
├── tui/                                ← Bubbletea Dev Console (Go)
│   ├── main.go
│   ├── config/services.yaml            ← Service registry + command palette
│   └── internal/                       ← Manager, runner, log broker, scheduler
│
├── infra/                              ← Azure deployment scripts
│   ├── cloud-init.yml
│   ├── deploy-aca.sh
│   └── deploy-azure-vm.sh
│
├── scripts/                            ← CLI utilities
│   ├── e2e_test.py
│   └── simulate_events.py
│
└── gen_nb.py                           ← Builds PCOP_Technical_Walkthrough.ipynb
└── generate_demo_data.py               ← Generates 50-customer synthetic dataset
```

---

## 7. Datasets and Model Performance

All data used in this project is **100% synthetic** — no real customer PII was used at any stage.

### Demo dataset (`server/data/` and `L3_CHRONOS/data/`)

- 20 synthetic retail banking customers (`C-00000001` – `C-00000020`)
- Fields: account balance, transaction history, NPS score, product holdings, life events, digital engagement score, segment, tenure
- 8 static JSON files served by the Express gateway
- Kafka simulation generates realistic live banking events every 8 seconds

### ML training datasets (public)

| Dataset                               | Source                                          | Used for                                             |
| ------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Bank Customer Churn                   | Kaggle (10K rows)                               | HABITAT XGBoost training + GENESIS LR                |
| UCI Bank Marketing                    | UCI ML Repository (45K rows)                    | GENESIS cold-start features                          |
| MBD-mini (Multimodal Banking Dataset) | HuggingFace (50K rows)                          | TARE encoder pre-training (masked action prediction) |
| Synthetic action sequences            | Generated from BankChurners (10K rows)          | TARE fine-tuning                                     |
| Synthetic survival records            | Generated by `generate_demo_data.py` (20K rows) | DeepHit training                                     |
| Customer–Product k-NN graph           | Constructed from the above (10,127 nodes)       | GraphSAGE training                                   |

### Model performance on the synthetic test set

| Model     | Role in ensemble                | Key metric                 | Value          | Training time             |
| --------- | ------------------------------- | -------------------------- | -------------- | ------------------------- |
| GraphSAGE | Network risk intelligence       | AUC                        | 0.93           | approximately 26 seconds  |
| HABITAT   | XGBoost tabular scorer          | AUC                        | 0.88           | approximately 2 minutes   |
| DeepHit   | Survival analytics              | Brier score                | under 0.25     | approximately 110 seconds |
| TARE      | Temporal sequence encoder (GRU) | Validation loss            | 0.0956         | approximately 30 minutes  |
| GENESIS   | Cold-start logistic regression  | Cross-validated AUC        | 0.65 or higher | under 1 minute            |
| FusionXV2 | Conformal ensemble meta-learner | Expected Calibration Error | 0.032          | —                         |

---

## 8. Demo Readiness Checklist

| #   | Item                                                                    | Status | Notes                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `GET /health` works on all 7 stage servers and the orchestrator         | DONE   | `bank/`, `L2_ARGUS/`, `L3_CHRONOS/`, `L4_COMPASS/`, `L5_HERALD/`, `L6_VERDICT/`, `L7_ORACLE/` shims all expose `/health` returning `{"status":"ok","stage":N,"stage_name":"..."}`. Orchestrator also exposes `/health` and `/health/stages` (probes all 7).                         |
| 2   | Pipeline run with a real Bank API input produces real output (no mocks) | DONE   | `scripts/e2e_test.py` walks the full Bank → ARGUS → CHRONOS → COMPASS → HERALD → VERDICT → ORACLE pipeline; refuses to run if any stage returns a mock-shaped response.                                                                                                             |
| 3   | All inter-stage schemas agree (no field name mismatches)                | DONE   | Shared `schemas/` package (Python + TypeScript) is the source of truth for `CustomerSnapshot`, `ChurnScore`, `SignalResult`, `ActionPlan`, `HeraldResponse`, `ObservationResult`, `AttributeResult`, `OracleCycleResult`. Each stage's FastAPI `response_model` is pinned to these. |
| 4   | `.env.example` covers every required variable                           | DONE   | Root `.env.example` lists every variable for every service, grouped.                                                                                                                                                                                                                |
| 5   | TUI starts, shows all services, streams logs in colour                  | DONE   | `cd tui && go run .` — single binary, 2000-line ring buffer, per-service colour, status dots polled every 2 seconds.                                                                                                                                                                |
| 6   | TUI command palette has 27 operational commands                         | DONE   | `tui/config/services.yaml` declares 27 commands; type `/` in the dashboard or browse the Commands page.                                                                                                                                                                             |
| 7   | Scheduler page shows tasks, their last-run time, and allows re-running  | DONE   | Page 2 reads `tui/data/task_history.db` (SQLite); `r` re-runs, `l` views the last output. Cron expressions evaluated by `github.com/robfig/cron/v3`.                                                                                                                                |
| 8   | `q` in the TUI cleanly shuts down all spawned processes                 | DONE   | Bubbletea `Ctrl+C` or `q` triggers `mgr.StopAll()` → `SIGTERM` to the process group created with `Setpgid`; 2-second `SIGKILL` backstop.                                                                                                                                            |
| 9   | End-to-end test passes without mocked data                              | DONE   | Run from the TUI: Commands page → "pipeline run" → exits 0 when all stages return real data. The script actively rejects responses containing mock markers.                                                                                                                         |

---

## 9. API Reference

All routes except `/auth/*` require `Authorization: Bearer <JWT>`.

| Method | Endpoint                         | Description                                                                   |
| ------ | -------------------------------- | ----------------------------------------------------------------------------- |
| POST   | `/auth/login`                    | Get JWT token                                                                 |
| GET    | `/api/portfolio/stats`           | Aggregate KPIs                                                                |
| GET    | `/api/portfolio/top-at-risk`     | Top customers by churn score                                                  |
| GET    | `/api/customers`                 | All 20 customers (filterable)                                                 |
| GET    | `/api/customers/:id/snapshot`    | Full customer profile                                                         |
| GET    | `/api/customers/:id/signals`     | Active ARGUS signals                                                          |
| POST   | `/api/analysis/analyze`          | Trigger AI risk analysis                                                      |
| POST   | `/api/outreach/generate`         | Generate HERALD outreach content                                              |
| GET    | `/api/v2/scores`                 | Ensemble scores + survival horizons                                           |
| GET    | `/api/v2/action-plans`           | COMPASS action plans                                                          |
| GET    | `/api/v2/model-health`           | Model health + ensemble config                                                |
| GET    | `/api/kafka/stream`              | Server-Sent Events live event stream                                          |
| GET    | `/api/nexus/overview`            | Portfolio cross-sell intelligence (KPIs, catalog adoption, top opportunities) |
| GET    | `/api/nexus/customer/:id`        | Per-customer ranked recommendations + eligibility + COMPASS offer             |
| GET    | `/api/nexus/graph`               | Force-directed customer–product graph for the operator console                |
| GET    | `/api/nexus/handoffs`            | Recent NEXUS-to-COMPASS handoffs                                              |
| POST   | `/api/nexus/send-to-compass/:id` | Push top NEXUS recommendation to COMPASS for action plan                      |
| POST   | `/api/nexus/pitch/:id`           | Generate a pitch for a single NEXUS recommendation                            |

Full API documentation is available in the technical walkthrough notebook.

### Port map

| Service             | Port | Command                                          |
| ------------------- | ---- | ------------------------------------------------ |
| Frontend (Next.js)  | 3000 | `npm run dev` in `client/`                       |
| Express API gateway | 8000 | `node index.js` in `server/`                     |
| Bank data server    | 3001 | `npm run dev` in `bank/`                         |
| CHRONOS FastAPI     | 8001 | `uvicorn api.main:app` in `L3_CHRONOS/`          |
| ARGUS               | 8002 | `uvicorn services.api.main:app` in `L2_ARGUS/`   |
| COMPASS             | 8004 | `uvicorn services.api.main:app` in `L4_COMPASS/` |
| HERALD              | 8005 | `uvicorn services.api.main:app` in `L5_HERALD/`  |
| VERDICT             | 8006 | `uvicorn services.api.main:app` in `L6_VERDICT/` |
| ORACLE              | 8007 | `uvicorn services.api.main:app` in `L7_ORACLE/`  |
| PostgreSQL          | 5432 | Docker Compose                                   |
| Kafka               | 9092 | Docker Compose                                   |
| MLflow UI           | 5000 | Docker Compose                                   |

### Tech stack

| Layer               | Stack                                                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend            | Next.js 16.2.1 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui · Recharts v3 · Lucide React                                                                                                                                          |
| API gateway         | Node.js · Express 5 · JWT (HS256, 8-hour expiry) · KafkaJS · Server-Sent Events for real-time streaming                                                                                                                                                   |
| AI and LLM          | NVIDIA-hosted `mistralai/mistral-small-4-119b-2603` via `integrate.api.nvidia.com/v1` (HERALD outreach generation) · LangGraph (agentic orchestration in COMPASS)                                                                                         |
| ML and data science | Python 3.11 · FastAPI · PyTorch 2.2 · ONNX Runtime · XGBoost 2.0 · scikit-learn · scikit-uplift · GraphSAGE (PyTorch Geometric) · DeepHit survival modelling · SHAP (explainability) · Pandas · NumPy                                                     |
| Infrastructure      | Railway (production deployment — two services: server + client) · Apache Kafka (real-time event streaming; simulation fallback if broker absent) · Docker Compose (local Postgres + Kafka + MLflow stack) · MLflow (experiment tracking + model registry) |
| Operator console    | Go 1.22+ · Bubbletea · Lipgloss · Bubbles                                                                                                                                                                                                                 |

---

## 10. Known Limitations

- All ML models were trained on synthetic and public data. Performance on real CBS data would require full retraining and regulatory validation.
- The Kafka layer currently runs in simulation mode (no live broker required) — real deployment needs a managed Kafka cluster.
- DeepHit and TARE training data is synthetic; survival curves are indicative, not calibrated on real churn outcomes.
- The demo covers 20 customers. Scaling to production volumes (100K or more customers) would require batch scoring infrastructure and a vector database for GraphSAGE. See [SCALING.md](SCALING.md) for the full plan.
- HERALD content quality depends on NVIDIA API availability; the system falls back to pre-generated content if the API is unreachable.
- No real-time Core Banking System integration — all data is served from static JSON snapshots updated offline.

---

## 11. Team and Contact

**Team MoneyLords** · Indian Institute of Technology Guwahati

| Name          | Role                                                       | Layers                                          |
| ------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| Isam Ahammed  | Statistical modelling and ML engineering                   | L2 ARGUS · L3 CHRONOS                           |
| Atrijo Pal    | Agentic orchestration, personalisation, causal measurement | L4 COMPASS · L5 HERALD · L6 VERDICT · L7 ORACLE |
| Rudrajeet Pal | REST API, database layer, full-stack dashboard             | Server · Client · TUI                           |

- Institute: Indian Institute of Technology Guwahati
- Submission: UnionBank iDEA 2.0, 2026
