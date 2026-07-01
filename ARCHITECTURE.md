# PCOP Architecture — Predictive Customer Outreach Platform

> UnionBank iDEA 2.0 Hackathon · Team MoneyLords · IIT Guwahati

This document is the source of truth for the PCOP system architecture after the
Phase-0 audit. It documents the **actual** data flow, the registry of every
service, the inter-stage contracts, and the issues that Phase 2 fixes.

---

## 1. Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1 · Bank API (Node/Express, :3001)                            │
│  bank/                                                             │
│  Live Core-Banking + CRM + App-Events + Card-Network + Enrichment  │
│  Loaded ONCE at startup from bank/data/*.json + *.csv               │
│  /health  GET /api/core-banking/...  GET /api/customers...         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Orchestrator · Express API Gateway (:8000)                          │
│  server/  — auth + portfolio + customers + v2 + chronos-proxy +     │
│            outreach + analysis + reviews + kafka + rights +         │
│            explainability + llm-usage                                │
│  /healthz, /readyz                                                  │
│  Calls chronosClient → :8001 (CHRONOS)                              │
│  Calls demoServerClient → :3001 (Bank)                              │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         ├─► Layer 2 · ARGUS (Python FastAPI, :8002)
         │    pcop_layer2_argus/services/detection/main.py
         │    Live signal-detection library (HERALD + NEXUS + ORACLE
         │    + WARDEN + ECHO). Per-customer in-process evaluation.
         │
          ├─► Layer 3 · CHRONOS (Python FastAPI, :8001)
          │    chronos/api/main.py
          │    5-model ensemble scoring (TARE + HABITAT + FUSIONX +
          │    CAUSAL-NET + GENESIS). Fetches from Bank :3001 live.
          │    APScheduler jobs: 6h batch + daily GENESIS + weekly
          │    MLflow retrain + monthly retrain.
          │    ├── NEXUS — graph-based product recommendation
          │    │   XGBoost baseline + GraphSAGE GNN. Trained on
          │    │   PKDD'99 (peer-adoption link prediction). Serves
          │    │   /recommendations/{customer_id} for COMPASS to pick
          │    │   the next best cross-sell offer (compliance-gated).
         │
         ├─► Layer 4 · COMPASS (Python FastAPI, :8004)
         │    layer4 compass orchestration/services/orchestration/main.py
         │    LangGraph 7-node action-intelligence agent. Consumes
         │    from Kafka topic risk.signal_detections; emits action
         │    plans.
         │
         ├─► Layer 5 · HERALD (Python FastAPI, :8005)
         │    layer5 herald content generation/services/content/main.py
         │    NVIDIA DeepSeek outreach generation. Consumes action
         │    plans; emits dispatched content. (No HTTP server by
         │    default — runs as a Kafka consumer; we add an HTTP shim.)
         │
         ├─► Layer 6 · VERDICT (Python script, no HTTP by default)
         │    layer6 verdict measurement/scripts/run_demo_verdict.py
         │    Doubly-Robust uplift attribution.  We add a thin HTTP
         │    wrapper at :8006 exposing POST /measure and /attribute.
         │
         └─► Layer 7 · ORACLE (Python script, no HTTP by default)
              layer7 oracle analytics/scripts/run_demo_oracle.py
              4 cycles: RETRAIN, REFINE, ROUTE, NARRATE. We add a thin
              HTTP wrapper at :8007 exposing POST /cycle/<name>.

                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Client · Next.js 16 (port 3000)                                    │
│  client/src/lib/api.ts — 40+ typed endpoints                         │
│  All calls routed through /api/* on the orchestrator                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Infrastructure (docker-compose.yml)

| Container       | Port | Image                        | Notes                      |
|-----------------|------|------------------------------|----------------------------|
| postgres        | 5432 | postgres:15-alpine           | DB for all services        |
| redis           | 6379 | redis:7-alpine               | BullMQ + event-bus         |
| zookeeper       | 2181 | confluentinc/cp-zookeeper    | Kafka dep                  |
| kafka           | 9092 | confluentinc/cp-kafka        | Event streaming            |
| mlflow          | 5000 | ghcr.io/mlflow/mlflow        | Experiment tracking        |
| bank            | 3001 | ./bank                       | Layer 1                    |
| server          | 8000 | ./server                     | Orchestrator               |
| client          | 3000 | ./client                     | Frontend                   |
| scoring         | 8001 | ./chronos                    | CHRONOS (port 8001→8003)   |

---

## 2. Stage Registry

| # | Stage (Code Name) | Service Name | Port | Entry Point | Role | Models / Artifacts | Docker Deps |
|---|-------------------|--------------|------|-------------|------|--------------------|-------------|
| 1 | Bank API          | bank         | 3001 | `bank/server.js` | Live core-banking, CRM, app-events, card-network, enrichment | n/a (loads JSON/CSVs at startup) | postgres (optional via DATABASE_URL) |
| 2 | ARGUS             | argus        | 8002 | `pcop_layer2_argus/services/detection/main.py` (FastAPI wrapper added) | Per-customer signal detection. CUSUM, BOCPD, SPRT, SA-EWMA, BH-FDR, NEXUS (joint), ORACLE (multivariate), WARDEN (FDR), ECHO (alarm publisher) | n/a (stateless lib) | kafka (optional) |
| 3 | CHRONOS           | chronos      | 8001 | `chronos/api/main.py` (FastAPI) | Risk scoring + survival. TARE ONNX encoder, HABITAT XGBoost, FUSIONX ensemble, CAUSAL-NET, GENESIS, AEGIS guard. APScheduler background jobs. | `ml/checkpoints/tare_churn.onnx`, `habitat_pass1.json`, `fusion_weights.json`, `causal_net_*.json`, `genesis_lr.pkl`, `aegis_reference.json` | postgres, redis, kafka, mlflow |
| 3a | NEXUS (CHRONOS sub-component) | nexus | 8001 | `chronos/api/routers/recommendations.py` (served by CHRONOS) | Graph-based product cross-sell. XGBoost baseline (`nexus-baseline`) trained on PKDD'99, GraphSAGE GNN for peer-adoption link prediction. Compliance-gated (no credit offers to high churn-risk). | `ml/checkpoints/nexus_baseline_metrics.json`, `ml/training/nexus_baseline_train.py` | postgres (catalog), inherits CHRONOS deps |
| 4 | COMPASS           | compass      | 8004 | `layer4 compass orchestration/services/orchestration/main.py` | Next-best-action agent (LangGraph 7 nodes). Consumes signal-detections, emits action plans. | NVIDIA DeepSeek V4 Pro for cognition + NBA | kafka |
| 5 | HERALD            | herald       | 8005 | `layer5 herald content generation/services/content/main.py` (HTTP shim added) | Content generation + compliance check (SENTINEL) + dispatch. | NVIDIA DeepSeek-V4 Pro, channel prompts, prohibited-phrases list | kafka |
| 6 | VERDICT           | verdict      | 8006 | `layer6 verdict measurement/scripts/run_demo_verdict.py` wrapped by `services/measurement/api.py` (added) | T+N outcome measurement + DR-Learner uplift attribution. | DR-Learner internals (numpy/scipy) | postgres, kafka |
| 7 | ORACLE            | oracle       | 8007 | `layer7 oracle analytics/scripts/run_demo_oracle.py` wrapped by `services/analytics/api.py` (added) | 4 cycles: RETRAIN, REFINE, ROUTE, NARRATE. | MLflow registry, prompt-bandit | postgres, mlflow, kafka |
| 0 | Orchestrator      | server       | 8000 | `server/index.js` (Express) | API gateway, JWT, SSE, Kafka producer/consumer, routes to all stages | n/a (proxy) | postgres, redis, kafka |
| 0 | Client            | client       | 3000 | `client/src/app/page.tsx` (Next.js) | Dashboard, customer detail, signals, outreach, reviews, models, pipeline | n/a (UI) | n/a |

### Inter-Stage Contract (Bank → Orchestrator → Stages → Client)

```
Layer 1  GET /api/core-banking/customers/:id
        GET /api/core-banking/transactions?customer_id=...
        GET /api/core-banking/transactions/summary?customer_id=...
        GET /api/core-banking/account-events?customer_id=...
        GET /api/core-banking/kyc-updates?customer_id=...
        GET /api/crm/notes?customer_id=...
        GET /api/crm/complaints/summary?customer_id=...
        GET /api/app-events?customer_id=...
        GET /api/app-events/login-series?customer_id=...
        GET /api/app-events/summary?customer_id=...
        GET /api/card-network/mcc-summary?customer_id=...
        GET /api/card-network/stress-indicators?customer_id=...
        GET /api/card-network/location-series?customer_id=...
        GET /api/enrichment/:customer_id
        GET /api/enrichment/market-signals

Orchestrator
   POST /api/analysis/analyze         body: { customer_id }
   GET  /api/customers?segment=&risk_tier=&city=&search=&sort=
   GET  /api/customers/:id             → full snapshot
   GET  /api/customers/:id/score
   GET  /api/customers/:id/signals
   GET  /api/customers/:id/survival
   GET  /api/customers/:id/plan
   GET  /api/customers/:id/herald
   GET  /api/portfolio/{summary,tier-distribution,churn-trend,signal-breakdown,
                         top-at-risk,model-health,uplift,bandit,full,stats}
   GET  /api/v2/scores[?tier=&anomaly_only=&page=&page_size=]
   GET  /api/v2/scores/:id
   GET  /api/v2/signals[?page=&limit=]
   GET  /api/v2/signals/:id
   GET  /api/v2/action-plans[?page=&limit=]
   GET  /api/v2/action-plans/:id
   GET  /api/v2/content[?page=&limit=]
   GET  /api/v2/content/:id
   GET  /api/v2/model-health
   GET  /api/v2/portfolio-survival
   GET  /api/chronos/{scores,scores/:id,health}
   GET  /api/chronos/scores           (proxy to CHRONOS)
   POST /api/outreach/generate        body: { customer_id }
   GET  /api/outreach/pending
   POST /api/outreach/approve/:approvalId
   POST /api/outreach/reject/:approvalId
   GET  /api/kafka/status
   GET  /api/reviews[?...]
   POST /api/reviews/:id/{approve,reject,action}
   GET  /api/rights/consent?customerId=...
   POST /api/rights/consent/{dpdpa,trai}
   POST /api/rights/{optout,erase}
   GET  /api/explain/{churn-score,signals,model-health}?customerId=...

Layer 2  POST /evaluate                body: ARGUSInput → ARGUSOutput
        GET  /health
        GET  /signals/:customer_id
        GET  /version

Layer 3  GET  /scores                  → ChurnScoreListResponse
         GET  /scores/:customer_id      → ChurnScoreResponse
         GET  /scores/:customer_id/token-sequence
         GET  /scores/:customer_id/reason-codes
         POST /scores/:customer_id/analyze → AnalyzeResponse
         GET  /model-health
         GET  /model-health/scheduler
         POST /bias-audit/run
         GET  /bias-audit/status
         GET  /health
         GET  /recommendations/health             — NEXUS model metadata + offline metrics
         POST /recommendations/score              body: { features, held_products[] }
         GET  /recommendations/{customer_id}      — ranked product propensities (top-offer)

Layer 4  POST /orchestrate             body: CompassState → CompassState
        GET  /health

Layer 5  POST /generate                body: HeraldRequest → HeraldResponse
        GET  /content/:customer_id
        GET  /health

Layer 6  POST /measure                 body: { window_days } → observe-results
        POST /attribute                body: { campaign_id, channel } → dr-uplift
        GET  /health

Layer 7  POST /cycle/:name             body: { params } → cycle-result
        GET  /cycles
        GET  /insights
        GET  /health
```

### Shared Schemas (new `schemas/` package)

We introduce `schemas/` at the repo root, importable by all Python
services via `PYTHONPATH`. Schemas live in Python (`pydantic`) for the
Python side and as a single source of truth, with a parallel TypeScript
re-export for the client.

```
schemas/
├── schemas/
│   ├── __init__.py
│   ├── customer.py       # CustomerRecord, CustomerSnapshot
│   ├── score.py          # ChurnScore, ReasonCode, Survival
│   ├── signal.py         # ARGUS SignalResult, AlarmPayload
│   ├── action_plan.py    # CompassState output schema
│   ├── content.py        # HeraldRequest / HeraldResponse
│   ├── measurement.py    # VERDICT result schemas
│   └── analytics.py      # ORACLE cycle-result schemas
```

A TypeScript mirror is provided at `schemas/ts/` for the client.

### Model Artifact Locations

| Component | Path (relative to repo root) | Notes |
|-----------|------------------------------|-------|
| TARE ONNX | `chronos/ml/checkpoints/tare_churn.onnx` (+ `.data`) | ONNX runtime at inference |
| TARE checkpoints | `chronos/ml/checkpoints/tare_pretrain_*.pt`, `tare_finetune_*.pt` | PyTorch checkpoints |
| HABITAT | `chronos/ml/checkpoints/habitat_pass1.json` | XGBoost JSON |
| Fusion weights | `chronos/ml/checkpoints/fusion_weights.json` | |
| CAUSAL-NET | `chronos/ml/checkpoints/causal_net_*.json` | S/T-learners + control |
| GENESIS | `chronos/ml/checkpoints/genesis_lr.pkl` | sklearn LR |
| AEGIS | `chronos/ml/checkpoints/aegis_reference.json` | drift reference |
| SHAP summary | `chronos/ml/checkpoints/habitat_shap_summary.png` | static asset |
| MLflow registry | `chronos/mlflow.db` + `mlruns/` (created at runtime) | |
| RAG corpus | `chronos/rag/corpus/*.json`, `*.md` | |
| NEXUS baseline | `chronos/ml/checkpoints/nexus_baseline_metrics.json` | XGBoost offline eval (PKDD'99) |
| NEXUS GraphSAGE | `chronos/ml/checkpoints/graphsage_churn.pt` | GNN link-prediction model (optional, in production) |

---

## 3. Issues Found (Phase 0)

The following numbered issues will be addressed in Phase 2. Each fix
preserves behaviour while removing the smell.

### Critical (block live demo)

1. **C-1. Mock analysis when NVIDIA key missing.** `server/routes/analysis.js:54-64`
   returns a hand-written `analysis` text when `NVIDIA_API_KEY` is empty.
   Rule A violation — even a degraded live response must come from a real
   model or a clear "model unavailable" error. Fix: return a structured
   error and require the operator to provide a real key (or a stub
   heuristic service in `schemas`).

2. **C-2. `server/services/localData.js` reads from `bank/data/*.json` at
   request time** (lines 14-25, 81-103). This bypasses the live Bank API
   and is Rule A. Fix: keep this as a *fallback only* when `BANK_API_BASE_URL`
   is unreachable, never the primary path.

3. **C-3. Static demo data in `chronos/api/main.py:46-74` (`bias-audit/run`)**.
   Generates a synthetic cohort when no records are provided. The
   `/bias-audit/run` endpoint should accept real customer records (e.g.
   from CHRONOS scores) or refuse. Fix: refuse with a 400 if no records
   supplied.

4. **C-4. `chronos/api/routers/risk_scores.py:150-157`** silently swallows
   enrichment fetch errors with `pass` (line 157). Violates Rule E.
   Fix: log the failure and return a structured 502 with the stage name.

5. **C-5. CHRONOS `risk_scores.py:32-44`** only raises `HTTPException(404)`;
   for bank API errors it raises 502 with no structured body. Violates
   Rule E. Fix: return `{error: True, stage: 3, stage_name: "chronos", message}`.

6. **C-6. `chronos/services/scoring/serving/bank_loader.py` and downstream
   `_score_single_debug` are called inside a request handler with on-the-fly
   model load fallback** (`risk_scores.py:175-181`). Each request calls
   `BatchScorer(...)` which loads models. Rule H violation. Fix: pre-load
   models at startup and reuse a singleton.

7. **C-7. `server/services/chronosClient.js:97-99`** calls
   `POST /scores/:id/rescore` — that endpoint does not exist in
   `chronos/api/routers/risk_scores.py`. Dead code. Fix: remove or alias
   to `/scores/:id/analyze`.

8. **C-8. `server/services/dataStore.js` loads `CUSTOMERS, SCORES, SIGNALS,
   …` from JSON at module-load** (lines 27-34). This is *not* request-time
   mock, but in `DEMO_MODE=true` every read goes through these pre-loaded
   in-memory maps. Fix: keep as a documented DEMO_MODE fallback and
   document the `DEMO_MODE=false` Postgres path explicitly in the
   `.env.example`; in non-demo mode, refuse to start if the DB is not
   reachable.

9. **C-9. `server/services/localData.js:176-181`** seeds
   `outreachRecords` that don't exist on `dataStore`; `dataStore`
   has no `outreachRecords` property (line 175 references
   `dataStore.outreachRecords` which is `undefined` — would throw at
   runtime). Fix: define `dataStore.OUTREACH_RECORDS` or remove the call.

10. **C-10. `layer4 compass orchestration/scripts/run_demo_compass.py:24-265`**,
    `layer5 herald content generation/scripts/run_demo_herald.py:25-399`**,
    `layer6 verdict measurement/scripts/run_demo_verdict.py:26-78`**,
    `layer7 oracle analytics/scripts/run_demo_oracle.py:111-160`** all
    hardcode `C-00000001 … C-00000020` customer profiles / outcomes /
    narrative cards. Rule A violation. Fix: these scripts are kept for
    reference but renamed to `*_legacy.py`; new `pipeline_run.py` scripts
    (added in Phase 2) fetch the customer list from `GET /api/customers`
    on the orchestrator and run the same logic live.

11. **C-11. `chronos/api/main.py:59-72`** uses Python `random` to build
    a "synthetic cohort" for bias-audit. Rule A violation. Fix: return 400.

12. **C-12. `layer4 compass orchestration/services/orchestration/main.py:32-34`**
    starts a Kafka consumer in demo mode by default. No live broker ⇒ 30s
    of retries on startup. Fix: respect `COMPASS_DEMO_MODE=false` to start
    in *in-process* mode (no broker) but still expose `/health` and
    `/orchestrate`.

13. **C-13. `server/config.js`** defines `claudeService` and `useClaudeFallback`
    but no Claude service file actually exists (`server/services/claudeService.js`
    exists but is dead). Fix: remove unused config keys.

### Major (data flow / contracts)

14. **M-1. `server/services/dataStore.js:38`** derives `CHURN_SCORES` from
    the `customers.json` `churn_score` field but the same field is then
    *overwritten* by `localData.js:90` using the chronos cache or
    `customers.json` defaults. The two code paths disagree. Fix: keep
    `dataStore` as the single source of `CUSTOMERS` shape; `localData`
    must be a thin proxy to the Bank API in production.

15. **M-2. `chronos/api/routers/risk_scores.py:283-299`** reads columns
    `customer_id, final_score, risk_tier, tare_score, habitat_score,
    treatability_score, action_score, scoring_pass, reason_codes,
    reason_codes_v2, anomaly_flag, model_version, scored_at, is_cold_start`
    from a table `churn_scores`. The schema for that table must be
    version-controlled. Fix: add a `chronos/infra/postgres/migrations/versions/004_churn_scores_table.py`
    to ensure schema parity.

16. **M-3. `chronos/api/routers/model_health.py:86-94`** hardcodes
    checkpoint paths via `Path(__file__).resolve().parents[2]`. This
    breaks when the module is loaded from a different cwd (e.g. inside
    Docker). Fix: use an env var `CHRONOS_CHECKPOINT_DIR` with sensible
    default relative to the project root.

17. **M-4. No `/api/v2/portfolio-survival` consistency check.** The route
    computes a live aggregate from `dataStore.SCORES` in DEMO_MODE but
    in production calls `scoreRepo.getPortfolioAggregates()`. The shape
    is consistent (`{avg_p7, avg_p30, avg_p90, urgent_7d, urgent_30d,
    urgent_90d}`) but the source is implicit. Fix: add a `PortfolioSurvival`
    Pydantic model to `schemas/`.

18. **M-5. `server/routes/customers.js:74-90`** POST /api/customers returns
    a fake customer with no DB write. Rule A violation. Fix: either
    forward to `localData.generateCustomerProfile()` (which DOES write
    to bank JSON files) or return 501. We choose the former.

19. **M-6. `server/services/localData.js:81-103`** hardcodes
    `dataStore.CHURN_SCORES`, `dataStore.SIGNALS`, `dataStore.LIFE_EVENTS`
    but `dataStore.js` only exports `CUSTOMERS, SCORES, SIGNALS,
    TRANSACTIONS, SURVIVAL, ACTION_PLANS, HERALD, PORTFOLIO`. The keys
    `CHURN_SCORES`, `LIFE_EVENTS` are not exported. Fix: export them as
    derived convenience accessors.

20. **M-7. `server/services/dataStore.js:38`** maps `CHURN_SCORES` from
    `customers.json` but `customers.json` does not have a `churn_score`
    field at the customer level — that field is on the per-customer
    `scores.json` entry. The map is wrong. Fix: use `SCORES_MAP[id].final_score`.

### Minor (polish, config, error paths)

21. **m-1. No `/health` on the bank, server, client, or argus FastAPI
    shim by default.** The `server/index.js` exposes `/healthz`, not
    `/health`. The orchestrator rule from the prompt expects `/health`
    on every stage. Fix: rename/alias `/healthz` → `/health` and add
    `/health` to argus, layer4, layer5, layer6, layer7 shims and the
    bank API (already has it).

22. **m-2. `chronos/api/main.py`** has CORS `allow_origins=["*"]`. The
    orchestrator already sets CORS — CHRONOS only needs to accept the
    orchestrator's origin. Fix: read from env
    `CHRONOS_CORS_ORIGINS` with `*` default.

23. **m-3. `server/config.js:5`** uses `parseInt(process.env.PORT || '8000')`
    but no `0.0.0.0` host binding. The Docker compose uses `8000:8000`
    which works only because Express defaults to all interfaces, but
    to be explicit add `HOST=0.0.0.0` in the config.

24. **m-4. `bank/server.js`** loads JSON at startup; no error handling
    if files missing. Already wrapped in try/catch in
    `initializeServer` — that part is fine. But `loaders/loadKycUpdates.js`
    hasn't been verified for missing-file tolerance. Fix: ensure all
    loaders return `{count, …}` even on empty input.

25. **m-5. `layer4 compass orchestration/services/orchestration/main.py:55-60`**
    hardcodes `port=8004`. Fix: read from env `COMPASS_PORT`.

26. **m-6. Missing `.env.example` files** in many services. Root cause:
    root repo has no single `.env.example`. Fix: add a comprehensive
    root `.env.example` (see Phase 2 output).

27. **m-7. `chronos/api/main.py:85-90` uses `on_event("startup")` (deprecated
    in newer FastAPI)**. Fix: migrate to `lifespan` context manager
    (Phase 2 — keep changes minimal, just fix critical pieces).

28. **m-8. `client/src/lib/api.ts:1-2`** uses `process.env.NEXT_PUBLIC_API_URL`
    directly. When the client is run via Next.js dev server it should
    use the local proxy (rewrites in `next.config.ts`). Fix: confirm
    the proxy or set `NEXT_PUBLIC_API_URL` in the client's env.

29. **m-9. `server/services/chronosClient.js`** does not have a timeout
    on the `fetch` body stream. Combined with `setTimeout(10s)` only
    on the request, a slow CHRONOS response will still hang the
    orchestrator route. Acceptable for a demo; documented.

30. **m-10. `server/data/*.json`** is checked in. We document these as
    *seed data* for DEMO_MODE only and recommend running with
    `DEMO_MODE=true BANK_API_BASE_URL=http://localhost:3001` so the
    bank API is the live source.

---

## 4. Production vs Demo Mode

| Service         | DEMO_MODE (default) | Production (`DEMO_MODE=false`) |
|-----------------|---------------------|--------------------------------|
| `server` (orch) | in-memory JSON store, Kafka simulation | Postgres (churn_scores, signals, audit_log), Redis Pub/Sub, real Kafka |
| CHRONOS         | Same code, in-memory fallback for tokens | Real Postgres, real Kafka producer, MLflow tracking |
| ARGUS, COMPASS, HERALD, VERDICT, ORACLE | In-process demo scripts / langgraph builders | Kafka consumer / producer + Postgres persistence |

For the **hackathon demo**, the intended path is:
- `bank` (port 3001) — live, always
- `server` (port 8000) with `DEMO_MODE=true` — uses bank live + static fallback for precomputed columns
- `chronos` (port 8001) — live, with Postgres optional
- `client` (port 3000) — always
- `argus/compass/herald/verdict/oracle` — wrapped in HTTP shims that proxy
  to the existing Python entry points and respect `DEMO_MODE` env var.

---

## 5. End-to-End Pipeline

The **canonical pipeline run** triggered by the TUI's `/pipeline run`
command:

1. `GET http://localhost:3001/health` — confirm Bank API live.
2. `GET http://localhost:3001/api/core-banking/customers?limit=20` — list customers.
3. For each customer `C-N`:
   1. `POST http://localhost:8002/evaluate` (ARGUS) → signal set
   2. `GET http://localhost:8001/scores/C-N` (CHRONOS) — latest score
   3. `POST http://localhost:8001/scores/C-N/analyze` if stale — live re-score
   4. `POST http://localhost:8004/orchestrate` (COMPASS) — action plan
   5. `POST http://localhost:8005/generate` (HERALD) — content draft
   6. `POST http://localhost:8000/api/outreach/generate` — RM approval gate
4. `POST http://localhost:8006/measure` (VERDICT) — for past customers
5. `POST http://localhost:8007/cycle/narrate` (ORACLE) — exec summary

The final aggregated response is written to `pipeline_runs/<timestamp>.json`.

The full implementation lives in `scripts/e2e_test.py` and is invoked
from the TUI's command palette and from CI.
