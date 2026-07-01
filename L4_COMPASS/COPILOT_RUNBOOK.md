# RM Copilot — Runbook (real mode + fake/demo mode)

The RM Copilot is the floating chat in the frontend (`client/.../copilot/RMCopilotPanel.tsx`). It
calls **`POST /copilot/ask`**, which is served by **COMPASS (Layer 4)** — a FastAPI + LangGraph
service on port **8004**. This runbook is how you stand it up for real, and how to fake it for a demo.

> **Decision:** we use the **real COMPASS copilot**. It can also run in a **demo/fake mode** that
> needs no Postgres (and, if you want, no LLM). Both are documented below.

---

## 0. Contract (don't change this — frontend + prod both depend on it)

```
POST /copilot/ask
  body:  { session_id?: string, rm_user_id: string, customer_id: string, message: string }
  reply: { reply: string, tools_used: string[], session_id: string }
```

The agent: NVIDIA DeepSeek LLM + 15 read-tools + a FAISS retention-playbook retriever, capped at
`MAX_TOOL_ROUNDS=4`, `[LLM:1 per turn]`, with Postgres-backed session memory.

---

## 1. What it actually needs (reality check)

| Dependency | Real mode | Fake/demo mode | Notes |
|------------|-----------|----------------|-------|
| Router mounted in `api/main.py` | ✅ required | ✅ required | **Now fixed** — was missing; `/copilot/ask` used to 404 even with COMPASS up |
| `NVIDIA_API_KEY` | ✅ required | optional (see §3, fake-LLM) | same key as the rest of PCOP |
| Postgres (`DATABASE_URL`) | ✅ required | ❌ not needed | session memory **and** the 15 read-tools query it |
| RAG index built | ✅ for playbook tool | ✅ for playbook tool | `python -m chronos.rag.build_index` (FAISS/sklearn, no DB) |
| Poetry env (Python 3.11) | ✅ | ✅ | `langchain`, `langgraph`, `fastapi`, `asyncpg` |

**Two gaps that were in the way (read before you start):**

1. **Router mount (fixed).** `services/api/main.py` only exposed `/health`, `/version`,
   `/orchestrate`. It now also mounts `copilot.router` (guarded). Without that fix the endpoint the
   frontend calls does not exist.
2. **Tools have no demo fallback (still true).** Every tool in `services/orchestration/tools/
   db_reads.py` calls `get_db_session()` (Postgres) with no fallback. In demo mode the session-memory
   helpers (`_load_history`/`_persist_turn`) already skip Postgres, but the **tools** will raise →
   each error is caught and returned to the LLM as `{"error": ...}`. So "demo mode with no Postgres"
   currently yields a copilot that can chat but whose data lookups fail. §3 gives the fix.

---

## 2. Real mode (full agent)

```bash
cd "layer4 compass orchestration"

# 2.1 deps
poetry install            # Python 3.11

# 2.2 env (NVIDIA + Postgres) — see .env.example, now NVIDIA-named
export NVIDIA_ENDPOINT="https://integrate.api.nvidia.com/v1"
export NVIDIA_API_KEY="nvapi-…"
export COMPASS_MODEL="deepseek-ai/deepseek-v4-pro"
export DATABASE_URL="postgresql://pcop:pcop_dev@localhost:5432/pcop"
export DEMO_MODE="false"          # turns ON Postgres session memory + tool reads

# 2.3 schema — copilot_messages + the tables the read-tools query
#     (migrations live under services/orchestration/db/migrations/)
alembic upgrade head              # or psql -f the 002_copilot_messages.sql + read-table migrations

# 2.4 RAG playbook index (no DB; used by retrieve_playbook_tool)
cd ../.. && python -m chronos.rag.build_index && cd "layer4 compass orchestration"

# 2.5 run
poetry run uvicorn services.api.main:app --host 0.0.0.0 --port 8004

# 2.6 smoke test
curl -s localhost:8004/health
curl -s -X POST localhost:8004/copilot/ask \
  -H 'Content-Type: application/json' \
  -d '{"rm_user_id":"rm_user","customer_id":"CUST-001","message":"Why is this customer at risk?"}'
```

On boot you should see `RM Copilot router mounted at /copilot`. If you see `NOT mounted`, a Python
dep is missing — run `poetry install`.

---

## 3. Fake / demo mode (no Postgres — the hackathon path)

Goal: a working copilot from the **two-Node-services demo** with **no Postgres** and (optionally) no
real LLM. Two sub-options, cheapest first.

### 3a. Thin fake — chat only, no live data  *(zero code)*

```bash
export DEMO_MODE="true"        # session memory off; tools will error → ignored by LLM
export NVIDIA_API_KEY="nvapi-…"
poetry run uvicorn services.api.main:app --port 8004
```

The LLM answers from its system prompt + the RAG playbook (if the index is built) + the user's
message. Customer-specific lookups return errors, so answers are generic. Fine for a "the copilot
talks" demo; weak for "the copilot knows this customer."

### 3b. Good fake — tools read the demo JSON instead of Postgres  *(recommended)*

Give the read-tools a demo fallback that reads the **same JSON the Node demo uses**
(`server/data/*.json` / `chronos/data/*.json`). Pattern — add to each tool in `db_reads.py`:

```python
import os, json, functools
from pathlib import Path

_DEMO = os.environ.get("DEMO_MODE", "true").lower() != "false"
_DATA = Path(__file__).resolve().parents[5] / "server" / "data"   # reuse Node demo data

def _demo_json(name: str):
    try:    return json.loads((_DATA / name).read_text(encoding="utf-8"))
    except Exception: return []

# Example: churn score tool with a demo branch
async def get_churn_score_tool(customer_id: str) -> dict:
    if _DEMO:
        rec = next((s for s in _demo_json("scores.json") if s.get("customer_id") == customer_id), None)
        return rec or {"final_score": 0.0, "risk_tier": "low"}
    async with get_db_session() as session:
        ...   # existing Postgres path unchanged
```

Apply the same `if _DEMO: …` head to the other tools (`get_signal_results_tool` → `signals.json`,
`get_transactions_tool` → `transactions.json`, `get_consent_flags_raw` → `consents.json`,
`get_offer_eligibility_tool` → `action_plans.json`, etc.). The RAG tool already needs no DB.

Result: the full 15-tool copilot answers grounded in real per-customer demo data, **no Postgres**.

### 3c. Fake the LLM too (offline / no API key)

If you also lack an NVIDIA key, point `nvidia_client.get_langchain_copilot_llm()` at a local Ollama
model (`langchain_openai.ChatOpenAI(base_url="http://localhost:11434/v1", api_key="ollama", model="llama3.2")`)
or have `/copilot/ask` short-circuit to a canned reply when `NVIDIA_API_KEY` is empty. Keep the
contract identical so the frontend never changes.

---

## 4. Wiring the frontend

`RMCopilotPanel.tsx` calls `COMPASS_BASE` (`NEXT_PUBLIC_COMPASS_URL` || `http://localhost:8004`).
Two ways to connect:

- **Direct (simplest local):** set `NEXT_PUBLIC_COMPASS_URL=http://localhost:8004`.
- **Proxied (matches the rest of the app):** add a Next rewrite so the browser hits a same-origin
  path and avoids CORS:
  ```ts
  // client/next.config.ts → rewrites()
  { source: "/copilot/:path*", destination: `${process.env.COMPASS_BACKEND_URL || "http://localhost:8004"}/copilot/:path*` }
  ```
  then change `COMPASS_BASE` to `""` (relative). Mirrors how `/api` and `/auth` already proxy.

**Also wire (per RM_PORTAL_DESIGN §3.9):** pass the real `rm_user_id` from the JWT (today defaults to
`'rm-demo'`), and enforce **book scoping in the tool layer** so the copilot can't be asked about a
customer outside the RM's book.

---

## 5. Compliance & audit (don't skip)

- The copilot reads consent flags, CRM notes, transactions — **personal data**. Two hard rules:
  **purpose-bound** (retention support only) and **book-scoped** (no fishing outside the assigned
  book) — DPDPA §6. Enforce scoping in the tools, not just the UI.
- Every turn is already `[LLM:1]` cost-tracked via `track_llm_call("copilot")` (exposed at
  `GET /api/llm-usage`).
- **Audit (🆕):** log a lightweight `COPILOT_QUERY { customer_id, tools_used }` per turn — **never the
  raw message** (free-text PII). The Node server owns the audit log, so the simplest path is to have
  the frontend/Node proxy emit the audit event when it relays the turn.
- The system prompt already forbids fabricating data and recommending opted-out products — keep those
  lines; they are the model-side compliance guardrail.

---

## 6. TL;DR

- **Bug fixed:** copilot router is now mounted in `api/main.py` (it wasn't).
- **Real mode:** NVIDIA key + Postgres (migrations) + RAG index + `DEMO_MODE=false`, run uvicorn 8004.
- **Demo mode:** `DEMO_MODE=true` + the §3b tool fallback to JSON = full copilot, no Postgres.
- **Contract is fixed** (`/copilot/ask`), so demo↔real is just env + the tool fallback — frontend never changes.
