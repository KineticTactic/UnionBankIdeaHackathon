# Admin Portal — Detailed Design Specification

> **Scope:** the **Admin / Control-Tower** side of the two-portal PCOP UI — the counterpart to
> [RM_PORTAL_DESIGN.md](RM_PORTAL_DESIGN.md). Where the RM portal is a *book-of-business cockpit*,
> the Admin portal is the **bank-wide command center**: it governs RMs, watches every model live,
> owns approvals/escalations/compliance, and generates audit reports.
>
> **Design principle:** the RM answers "who needs *me* today?"; the Admin answers **"is the whole
> machine healthy, fair, compliant — and who's doing what?"** Three lenses run through every screen:
> **Oversee · Govern · Prove.**
>
> **Build-on-what-exists principle:** same as the RM doc — existing APIs/components are named with
> their path; new work is tagged **🆕 NEW**. The Admin portal **reuses the heavy dashboards that
> already exist** (`/models`, `/analytics`, `/pipeline`) and wraps them in a control-tower shell.
>
> **Demo principle (explicit):** this portal is the showpiece. Every page is built to *demo loud* —
> live-ticking numbers off the Kafka simulation, an animated architecture map, and a one-click
> "decision lineage replay." A scripted walkthrough is in §9.

---

## 0. Persona & Mental Model

The Admin is a **super-user wearing four hats**, often different people behind one elevated role:

| Hat | Cares about | Portal home |
|-----|-------------|-------------|
| **Operations lead** | Are RMs working the right customers? SLAs? workload balance? | RM Management, Escalations |
| **Model owner / data science** | Are the models accurate, calibrated, learning, not drifting? | Model Intelligence, Relearning, GraphSAGE |
| **Compliance / risk officer** | Consent, fairness, RBI governance, audit trail, DSARs | Compliance & Governance, Audit Reports |
| **Executive** | Is churn down? Is retention ROI positive? One screen. | Command Center |

Auth roles already exist (`analyst · risk · rm · manager · admin`). The Admin portal is for
**`admin`**, with **`manager`/`risk`** seeing scoped subsets (e.g. risk sees compliance + approvals
but not RBAC/RM provisioning). The reviews route already gates approve/reject to `['manager','admin']`
— we extend that pattern, not replace it.

---

## 1. Access Control — the inverse of the RM portal

The RM portal's #1 rule was **book scoping**. The Admin portal is the **opposite**: a deliberate,
audited **god-view**. That power is itself a compliance object.

- **Full visibility, fully logged.** Admin sees every customer, every RM, every model. But viewing a
  specific customer's record from the god-view still emits an audit event
  (`DATA_ACCESS_REQUEST { actor, customer_id, basis:'admin_oversight' }`) — DPDPA §8 accountability.
- **RBAC tiers (🆕):** `admin` = everything incl. RBAC + RM provisioning + policy/thresholds.
  `manager` = ops + approvals + RM performance, **no** model-governance writes or RBAC. `risk` =
  compliance + approvals + audit reports, **read-only** elsewhere. Enforced server-side via the
  existing `requireRole(...)` middleware, not just UI hiding.
- **Break-glass note:** any action that overrides a model decision or a consent block is double-logged
  (`HUMAN_OVERRIDE`) with a mandatory reason — RBI AI Governance 2024 human-accountability.

---

## 2. Information Architecture — Admin Portal Pages

| # | Route | Page | Purpose | Status |
|---|-------|------|---------|--------|
| 1 | `/admin` | **Command Center** | Bank-wide live KPIs — the hero/exec screen | 🆕 NEW (assembles existing cards) |
| 2 | `/admin/rms` | **RM Management** | All RMs: books, performance, workload; add/edit RM | 🆕 NEW |
| 3 | `/admin/rms/[id]` | **RM Activity Tracker** | One RM: what they did per customer, calls, outcomes; send notes | 🆕 NEW |
| 4 | `/admin/customers` + `/[id]` | **Customer 360 (god-view)** | Any customer, un-scoped + full decision lineage | ♻️ REUSE `/customers/[id]` un-scoped |
| 5 | `/admin/models` | **Model Intelligence** | CHRONOS statistical + ML models live, AUC, calibration | ♻️ REUSE `/models` |
| 6 | `/admin/graphsage` | **GraphSAGE Explorer** | Peer-similarity graph viz + per-node attribution | 🆕 NEW (uses `graph_score` + attributions) |
| 7 | `/admin/relearning` | **Relearning / ORACLE** | 4 learning cycles, DR uplift, bandits, A/B, retrain gate | ♻️ EXTEND `/analytics` |
| 8 | `/admin/verdict` | **Uplift / VERDICT** | Causal measurement, Qini, DR-ATE | ♻️ REUSE `/analytics` |
| 9 | `/admin/approvals` | **Approval Queue** | HERALD human-in-loop approvals | ✅ EXISTS (`ApprovalQueuePanel`) |
| 10 | `/admin/escalations` | **Escalations & Reviews** | Escalation queue, incidents, review cases | ♻️ EXTEND `/reviews` |
| 11 | `/admin/pipeline` | **Live Pipeline & Health** | Kafka stream + per-service health probes | ♻️ EXTEND `/pipeline` + `/health/stages` |
| 12 | `/admin/architecture` | **Architecture Map** | Interactive 7-layer diagram, live data flow | 🆕 NEW (the showpiece) |
| 13 | `/admin/compliance` | **Compliance & Governance** | Consent ledger, DSAR/erasure queue, bias audits, model approvals | ♻️ ASSEMBLE existing compliance components |
| 14 | `/admin/audit` | **Audit Reports** | Generate reports (LLM or templated) for regulators | 🆕 NEW |
| 15 | `/admin/llm-usage` | **LLM Usage & Cost** | Token/call counters by node, cost governance | ✅ EXISTS (`/api/llm-usage`) |
| 16 | `/admin/settings` | **Policy & RBAC** | Risk thresholds, fatigue limits, roles, system config | 🆕 NEW |
| — | (global) | **Broadcast / Notify** | Push notes & alerts to RMs | 🆕 NEW |

Navigation: reuse `components/layout/Sidebar.tsx` with an Admin group set, grouped by the four hats
(Operations · Models · Compliance · System).

---

## 3. Page-by-Page Specification

### 3.1 Command Center — `/admin`  🆕 (the hero screen)

**Intent:** one glance = state of the whole bank. Built to *demo loud* — numbers tick live off the
Kafka simulation that's already running (`kafkaService` emits an event every 8s).

**Layout:**
1. **Live KPI strip** (`StatCard` ×6): total customers · avg churn score · PRIORITY+ESCALATE count ·
   active signals (live) · outreach dispatched today · retention saves (MTD). Source:
   `GET /api/portfolio/summary` + a live delta from `GET /api/kafka/status`.
2. **Risk distribution donut** (`RiskDistributionChart`) + **churn trend** (`ChurnTrendChart`) —
   `GET /api/portfolio/tier-distribution`, `/churn-trend`.
3. **Model health glance** (`ChronosV2Card`) — fusion AUC/ECE, last retrain, ensemble weights
   (incl. **GraphSAGE 0.20**) from `GET /api/portfolio/model-health`.
4. **Live event ticker** (`KafkaStreamCard` / `KafkaFeed`) — signals firing in real time across the
   whole bank (not book-scoped). This is the "it's alive" moment for the demo.
5. **Attention rail:** pending approvals count, open escalations, overdue DSARs, drift alerts — each
   a deep-link to its page.

**Audit:** read-only.
**Compliance:** aggregate only on this screen — no individual PII in the exec view (data minimisation
by default; drill-down is where access gets logged).

---

### 3.2 RM Management — `/admin/rms`  🆕

**Intent:** "control all the RMs." The roster + performance + workload, and the place to **add/edit
RMs** and **rebalance books**.

**Layout:**
- **RM roster table:** name, book size, at-risk count in book, conversion rate, retention saves, SLA
  (% follow-ups on time), last-active. Sortable → instant leaderboard.
- **Workload heatmap (🆕):** book size × avg risk per RM → spot the overloaded RM with 11 high-risk
  customers vs the one with 2. Our seed data is uneven (Aditya Sharma 11, Priya Menon 2) — this
  visualises that.
- **Add RM (🆕):** `POST /api/admin/rms { name, username, email, role:'rm' }` → creates the login
  (extends the `USERS` list in `auth.js` / a new `rms.json`) and an empty book. **Audited**
  (`RM_PROVISIONED`).
- **Reassign book (🆕):** move a customer (or a slice of a departing RM's book) to another RM →
  `POST /api/admin/rms/reassign { customer_ids[], from_rm, to_rm }`. **Audited** (`BOOK_REASSIGNED`)
  — this changes who can lawfully see a customer (DPDPA §6), so it's a first-class audited action.

**Compliance:** adding an RM = access provisioning → audit + RBAC. Reassignment changes lawful-access
scope → audit. Performance metrics are about staff, not new customer-PII processing.

---

### 3.3 RM Activity Tracker — `/admin/rms/[id]`  🆕

**Intent:** the literal ask — "for each RM see what it did for each customer, send notes." A full
activity ledger for one RM.

**Layout:**
- **RM scorecard header:** the §3.2 metrics for this RM.
- **Activity timeline (the core):** every action this RM took, reconstructed from the **audit log**
  (`auditLogService.getEventsByType` filtered by `actor=rm`): outreach generated/sent, calls logged
  (`CALL_ANALYZED`), outcomes recorded, scores disputed, approvals requested. Each entry links to the
  customer + the artifact (the call summary, the sent content hash, the outcome).
- **Per-customer rollup:** group the timeline by customer → "what did this RM do for CUST-014?" with
  the predict→act→result triple (COMPASS plan → HERALD content → RM outcome).
- **Send note to RM (🆕):** `POST /api/admin/rms/:id/notes { text }` → appears in the RM's portal
  (a notification + on `/rm/today`). For coaching, nudges, "follow up on this escalation." **Audited**
  (`ADMIN_NOTE_SENT`). Note text is internal staff comms, not customer PII — but still stored, not
  logged verbatim.

**Compliance:** this is staff oversight built **from the audit log that already exists** — which is
exactly what the audit log is for (RBI accountability). Admin viewing a customer record *through* the
tracker still logs `DATA_ACCESS_REQUEST`.

---

### 3.4 Customer 360 (god-view) — `/admin/customers/[id]`  ♻️

Reuse the RM Customer 360 **un-scoped** (any customer). Adds two admin-only affordances:

- **Decision Lineage Replay (🆕, demo gold):** a single timeline that stitches the full pipeline for
  this customer — ARGUS signal fired → CHRONOS score (with GraphSAGE/TARE/HABITAT contributions) →
  COMPASS action plan → HERALD content → dispatch → VERDICT outcome. Built from `getCustomerSnapshot`
  + the audit log. "Replay" animates it step by step. This is the single most convincing artifact for
  a technical judge — it proves the 7 layers actually connect.
- **Override controls (🆕):** admin can override a tier or unblock/justify a suppressed outreach —
  each writes `HUMAN_OVERRIDE` with a mandatory reason.

---

### 3.5 Model Intelligence — `/admin/models`  ♻️ REUSE `/models`

The existing **CHRONOS Model Intelligence** page already renders `GET /api/portfolio/model-health`
(`ChronosDashboardCard`/`ChronosV2Card`): ensemble weights, per-model AUCs, fusion AUC/ECE,
calibration curve, feature importance, last-retrained. **Statistical models *and* ML models, live.**

**Admin additions (🆕):**
- **Per-model cards:** TARE (GRU), HABITAT (XGBoost), GENESIS (cold-start LR), **GraphSAGE (GNN)**,
  FusionX — each with its AUC, weight, and "last trained" + a link to its model card.
- **Champion/challenger (🆕):** show the live FusionX weights (`fusion_weights.json`:
  tare .35 / habitat .30 / graphsage .20 / genesis .15) and what a recalibration *would* change —
  gated behind the retraining gate (§3.13).
- **Calibration + reliability** diagram and **drift status** (AEGIS reference) per model.

**Compliance:** **explainability surface** — RBI AI Governance 2024 requires model transparency. This
page is the bank's model-card hub; keep feature-importance and calibration one click away.

---

### 3.6 GraphSAGE Explorer — `/admin/graphsage`  🆕 (visual showpiece)

**Intent:** you asked for a "GraphSAGE view." This makes the GNN tangible.

**Layout:**
- **Force-directed peer graph:** nodes = customers, edges = the peer-similarity links the model was
  trained on (Geography + Age±5 + Balance-decile). Node colour = risk tier, size = churn score.
  Built from `chronos/data/scores_v2.json` (`graph_score` per customer) + the graph-construction
  logic in `graphsage_train.py`. Click a node → its neighbours light up + its **input-gradient×input
  attribution** (top features) from `graphsage_node_attr.json`.
- **"Why this score" panel:** for a selected customer, show the GraphSAGE `graph_score`, its top-3
  attributed features, and how it blends into the final FusionX score.
- **Training facts strip:** test AUC, avg degree, n-nodes — from the checkpoint metadata.

> Use a client-side force layout (e.g. lightweight d3-force or `react-force-graph`) seeded from the
> 20–50 demo customers. With the Kafka sim nudging scores live, nodes re-colour in real time — a
> strong visual.

**Compliance:** the graph shows customer nodes → it's PII. Admin-only, logged on open
(`GRAPH_VIEW_ACCESSED`); label with neutral risk language (no "blacklist").

---

### 3.7 Relearning / ORACLE — `/admin/relearning`  ♻️ EXTEND `/analytics`

**Intent:** make the learning loop visible (ties to the relearning explanation already produced).

**Layout (extends the existing VERDICT & ORACLE analytics page):**
- **The 4 cycles** (NARRATE · REFINE · ROUTE · RETRAIN) as live cards: last run, next scheduled, what
  changed. Source: ORACLE (demo-mode logs) + `GET /api/portfolio/bandit`, `/uplift`.
- **Thompson bandit state** (`BanditState`): arms, posteriors, regret reduction — the REFINE cycle.
- **Channel policy table** (ROUTE): best channel per segment×tier cell.
- **DR-uplift attribution** (the heart): raw outcome vs DR-adjusted — the "did the outreach *cause*
  the save?" view that prevents naturally-recovering customers from looking like wins.
- **Retraining-gate status (🆕, RBI §8):** is the next retrain *allowed*? Shows the gate from
  `retraining_gate.py`: bias-audit freshness + result, committee approval, blockers. A red/green
  "deploy allowed?" badge.

**Compliance:** this *is* the model-risk-management surface (RBI §8). The gate must visibly block
recalibration without a fresh PASS bias audit + committee approval.

---

### 3.8 Approval Queue — `/admin/approvals`  ✅ EXISTS

`ApprovalQueuePanel` + `GET /api/outreach/pending` already implement the HERALD human-in-loop gate.
Approve/reject (`POST /api/outreach/approve|reject/:id`, gated to `manager`/`admin`) run the **final**
consent + DND + DLT checks and emit `OUTREACH_SENT`/`OUTREACH_BLOCKED` per channel. Admin view shows
**all** RMs' submissions (not book-scoped). Add bulk-approve with a per-item compliance check and a
reason on reject.

**Compliance:** this is the RBI "human before adverse/promotional AI action" control — already built;
the Admin portal just gives the bank-wide view.

---

### 3.9 Escalations & Reviews — `/admin/escalations`  ♻️ EXTEND `/reviews`

**Intent:** "if there is any escalation it can be shown." The reviews subsystem already models cases.

**Layout:** reuse `ReviewQueueTable`, `ReviewActionPanel`, `ReviewTimeline`, `CustomerSnapshot`
(`GET /api/reviews`, `/reviews/stats`, `/reviews/:id`). Case types already include `score_alert`,
`compliance_flag`, `outreach_approval`, `manual`; statuses `pending→in_review→approved/rejected/
escalated`; priority `low→critical`.

**Admin additions (🆕):**
- **Escalation rules engine (🆕):** "auto-escalate if churn_score > 0.92 AND no outreach in 7d" →
  creates a `score_alert` case. Configurable thresholds (ties to §3.16 settings, e.g.
  `COMPASS_RESCUE_THRESHOLD=0.92`).
- **Assign/route** an escalation to a specific RM (+ note via §3.3), with SLA timers.
- **Incident view:** model drift / consent breach / failed-send spikes surfaced as system incidents.

**Compliance:** `compliance_flag` cases (e.g. the call `compliance_flags` from RM_PORTAL §3.10) land
here for governance resolution — closing the loop on RM self-flags.

---

### 3.10 Live Pipeline & Health — `/admin/pipeline`  ♻️ EXTEND `/pipeline`

The existing **Data Pipeline** page renders `GET /api/kafka/status` (mode, connected, messages,
recent events). Admin extends with **per-service health** via the existing
`GET /health/stages` probe (bank/chronos/argus/compass/herald/verdict/oracle reachability + status),
shown as a live status board. The Kafka topic flow (`pcop.alarms.v1 → action_plans → dispatched →
measurements`) animates as events pass.

**Compliance:** operational; no PII.

---

### 3.11 Architecture Map — `/admin/architecture`  🆕 (the showpiece page)

**Intent:** your explicit ask — "a page which will show the entire architecture." Make it *live*, not
a static PNG.

**Layout:** an interactive 7-layer diagram (data from `ARCHITECTURE.md`'s stage registry + `config.stages`):

```
L1 Bank API → L2 ARGUS (signals) → L3 CHRONOS (scores: TARE·HABITAT·GENESIS·GraphSAGE·FusionX)
   → L4 COMPASS (NBA + Copilot) → L5 HERALD (content) → L6 VERDICT (uplift) → L7 ORACLE (relearning)
                                   ↑__________________ feedback loop __________________↓
```

- **Nodes** = layers; click → that layer's live stats + a deep-link to its admin page (CHRONOS→Models,
  ORACLE→Relearning, etc.).
- **Animated flow:** pulse a packet along the Kafka topic edges each time `GET /api/kafka/status`
  shows a new event — the architecture *breathes*.
- **Health dots:** each node green/amber/red from `/health/stages`.
- **The feedback arrow** (VERDICT→ORACLE→CHRONOS) is highlighted as the relearning loop — pairs with
  the §3.7 page and the relearning narrative.

This is the page that makes judges go "oh, it's actually one connected system." Pair it with the §3.4
Decision Lineage Replay for a customer-level version of the same story.

---

### 3.12 Compliance & Governance — `/admin/compliance`  ♻️ ASSEMBLE

**Intent:** the DPDPA/TRAI/RBI control panel. Assembles existing compliance components into one hub.

**Tabs:**
1. **Consent ledger** — `ConsentStatusBadge` + `GET /api/rights/consent` across the book; counts of
   DPDPA/TRAI granted/revoked/opt-out. Source: `consentService` + `consentAuditLog.json`.
2. **Data rights / DSAR queue (🆕 surface, existing APIs):** export (`/api/rights/export`),
   correction (`/api/rights/correct`), **erasure** (`/api/rights/erase` + `erasureList.json`,
   `/erasure-status`) — a worklist of pending data-subject requests with SLA timers (DPDPA §12).
3. **Bias & fairness** — `BiasAuditCard` + `bias_audit_results.json`: latest audit, subgroup metrics,
   PASS/FAIL. Drives the retraining gate.
4. **Model approvals** — `modelApprovals.json` via `retraining_gate.record_model_approval`: the model
   risk committee's approve/revoke log (RBI §8).
5. **Audit log explorer (🆕):** searchable view over `auditLogService` (by customer, actor, event
   type, date) with the `getAuditSummary` rollup. The append-only, hash-not-PII trail.

**Compliance:** this page *is* the compliance evidence. Everything here is read from the existing
append-only logs — the portal proves the bank can answer a regulator.

---

### 3.13 Audit Reports — `/admin/audit`  🆕 (LLM + templated)

**Intent:** your ask — "generate various audit reports … by LLM or normal." Turn the raw audit/consent
logs into regulator-ready documents.

**Report types:**
- **DPDPA processing report** — consents granted/revoked, DSARs fulfilled, erasures, purpose log.
- **TRAI communication report** — outreach by type (140/160), DND blocks, DLT metadata.
- **RBI model-governance report** — model versions, bias audits, approvals, override log, retrain
  history.
- **RM activity report** — what each RM did, outcomes, SLA (from §3.3).

**Two generation modes:**
- **Templated (deterministic):** server aggregates the relevant logs into a fixed schema → CSV/PDF.
  Numbers are exact, reproducible, defensible. **Default for anything a regulator sees.**
- **LLM narrative (🆕):** feed the **aggregated, de-identified** numbers (never raw PII) to NVIDIA
  DeepSeek (`llmClient.js`) to produce an executive narrative ("Over the period, 1,204 outreaches
  dispatched, 98.7% consent-verified, 3 DSARs fulfilled within SLA…"). The LLM **summarises
  pre-computed facts; it does not compute them** — this avoids hallucinated compliance numbers.

```
🆕 POST /api/admin/reports { type, period, mode:'templated'|'llm' }
   → { report_id, format, url|content, generated_by, source_hashes[] }
```

**Compliance (critical):** an LLM-written audit report is itself an audit risk if it fabricates. Rule:
**LLM narrates; templated layer computes.** Every report stores the **hashes of the source log
ranges** it was built from (provenance) and is itself an audit event (`AUDIT_REPORT_GENERATED`). A
human signs off before anything leaves the building.

---

### 3.14 LLM Usage & Cost — `/admin/llm-usage`  ✅ EXISTS

`GET /api/llm-usage` already returns per-node call counters (`pcop:llm_calls:*` from Redis; zeros in
demo). Admin view: calls by node (COMPASS cognition/NBA, copilot, HERALD scribe, ORACLE narrate,
analysis), trend, and a **cost estimate** (🆕 calls × model price). Cost governance for an
LLM-heavy platform.

---

### 3.15 Broadcast / Notify — global  🆕

Push a note or alert to one RM, a group, or all — "new compliance policy," "month-end push on
PRIORITY customers." Lands in the RM portal (`/rm/today`). `POST /api/admin/broadcast { audience, message }`,
audited (`BROADCAST_SENT`). Ties to §3.3 per-RM notes.

---

### 3.16 Policy & RBAC — `/admin/settings`  🆕

**Intent:** the knobs that change system behaviour — and who can turn them.

- **Risk policy:** tier thresholds, `COMPASS_RESCUE_THRESHOLD`, `COMPASS_FATIGUE_LIMIT_30D`, outreach
  fatigue caps. Changing a threshold is **audited** (`POLICY_CHANGED`) — it alters who gets contacted.
- **RBAC / roles:** manage `admin/manager/risk/rm` assignments; the source of the access tiers in §1.
- **Channel/DLT config:** DLT entity id, number-series mapping (feeds `traiComplianceService`).
- **Feature flags:** demo-mode toggles, which services are live.

**Compliance:** every policy change is an audited governance event; threshold changes especially
(they change customer treatment → RBI fair-treatment + DPDPA purpose).

---

## 4. Audit Coverage Matrix (admin actions)

New/used event types (append-only via `auditLogService`, hash-not-PII rule):

| Admin action | Event type | New? |
|--------------|-----------|------|
| Open any customer (god-view) | `DATA_ACCESS_REQUEST` (basis: admin) | exists |
| Override tier / unblock outreach | `HUMAN_OVERRIDE` | 🆕 |
| Add / edit RM | `RM_PROVISIONED` | 🆕 |
| Reassign book | `BOOK_REASSIGNED` | 🆕 |
| Send note to RM | `ADMIN_NOTE_SENT` | 🆕 |
| Approve / reject outreach | `OUTREACH_SENT`/`OUTREACH_BLOCKED`/`HUMAN_APPROVAL`/`HUMAN_REJECTION` | exists |
| Escalate / assign case | `CASE_ESCALATED` | 🆕 |
| Record model approval | `MODEL_APPROVED`/`MODEL_REVOKED` | 🆕 (via `retraining_gate`) |
| View GraphSAGE / graph | `GRAPH_VIEW_ACCESSED` | 🆕 |
| Generate audit report | `AUDIT_REPORT_GENERATED` | 🆕 (stores source hashes) |
| Change policy / threshold | `POLICY_CHANGED` | 🆕 |
| Broadcast to RMs | `BROADCAST_SENT` | 🆕 |
| Change RBAC role | `ROLE_CHANGED` | 🆕 |

---

## 5. Compliance & Governance Register

| # | Risk | Regulation | Mitigation |
|---|------|-----------|------------|
| A1 | God-view = unbounded PII access | DPDPA §6/§8 | Every drill-down logged; RBAC tiers; break-glass `HUMAN_OVERRIDE` with reason |
| A2 | LLM audit report fabricates compliance facts | DPDPA/RBI accountability | **Templated layer computes; LLM only narrates**; source-hash provenance; human sign-off |
| A3 | Recalibrating a model without governance | RBI AI Gov 2024 §8 | Retraining gate (bias audit PASS + committee approval) visibly blocks (§3.7/3.12) |
| A4 | Admin overrides a consent/DND block | DPDPA §7; TRAI | Override allowed only with reason + `HUMAN_OVERRIDE` audit; some blocks (DND) are hard, non-overridable |
| A5 | Book reassignment leaks a customer to wrong RM | DPDPA §6 | `BOOK_REASSIGNED` audit; reassignment updates lawful-access scope atomically |
| A6 | GraphSAGE/graph view exposes peer PII | DPDPA §8 | Admin-only, logged, neutral risk labels, no raw identifiers in node labels by default |
| A7 | Threshold change silently changes who's targeted | RBI fair-treatment; DPDPA purpose | `POLICY_CHANGED` audit with before/after; manager+ only |
| A8 | RM activity tracking = employee surveillance | labour/privacy norms | Scope to work-product (audit-log actions), not keystroke/behavioural monitoring; transparent to RMs |

---

## 6. New Backend Surface (summary of 🆕 endpoints)

```
GET   /api/admin/rms                       RM roster + performance (aggregates audit log + outcomes)
POST  /api/admin/rms                       provision a new RM (RM_PROVISIONED)
GET   /api/admin/rms/:id/activity          one RM's action ledger (from auditLogService by actor)
POST  /api/admin/rms/:id/notes             coaching note → RM portal (ADMIN_NOTE_SENT)
POST  /api/admin/rms/reassign              move customers between books (BOOK_REASSIGNED)
GET   /api/admin/lineage/:customerId       full decision lineage (signal→score→plan→content→outcome)
POST  /api/admin/override                  tier/consent override with reason (HUMAN_OVERRIDE)
GET   /api/admin/escalation-rules          list escalation rules
POST  /api/admin/escalation-rules          create/update a rule
POST  /api/admin/reports                   generate audit report (templated | llm) + provenance hashes
GET   /api/admin/graph                     GraphSAGE node/edge graph + per-node attributions
POST  /api/admin/broadcast                 push note/alert to RMs (BROADCAST_SENT)
GET   /api/admin/policy  ·  PUT /api/admin/policy     read/update thresholds (POLICY_CHANGED)
PUT   /api/admin/roles/:userId             RBAC change (ROLE_CHANGED)
# reuse as-is:
GET   /api/portfolio/* · /api/v2/* · /api/explain/* · /api/reviews/* · /api/rights/* ·
GET   /api/kafka/status · /health/stages · /api/llm-usage · /api/outreach/pending
```

New services: `adminService.js` (roster + lineage assembly from existing stores), `reportService.js`
(templated aggregation + LLM narration via `llmClient.js`), `escalationRulesService.js`,
`policyService.js`. New data: `server/data/rms.json`, `escalationRules.json`, `policy.json`,
`adminNotes.json`. New audit types added to `auditLogService.VALID_EVENT_TYPES` (§4).

---

## 7. What's reused vs new (honesty ledger)

- **Reuse as-is:** `/models` (model health), `/analytics` (VERDICT+ORACLE bandit/uplift), `/pipeline`
  (Kafka), `ApprovalQueuePanel`, `/reviews` stack, all `compliance/*` components, `/api/llm-usage`,
  `/health/stages`, the audit/consent/TRAI services, GraphSAGE scores + attributions.
- **Net-new:** Command Center shell, RM Management + Activity Tracker, Architecture Map, GraphSAGE
  Explorer, Audit Report generator, Escalation rules engine, Policy/RBAC, Broadcast, Decision Lineage
  Replay, the admin backend surface (§6).
- **Same caveats as RM portal:** ORACLE/VERDICT numbers are demo-mode (real orchestration, stubbed
  training); the COMPASS copilot needs the runbook fix; CRM notes still need a data source.

---

## 8. Build Sequence

1. **Admin shell + RBAC** (§1, §3.16 roles) — the access spine; reuse `requireRole`.
2. **Command Center** (§3.1) — assemble existing cards; instant visual win.
3. **Architecture Map** (§3.11) + **Decision Lineage Replay** (§3.4) — the demo showpieces.
4. **RM Management + Activity Tracker** (§3.2, §3.3) — built from the audit log.
5. **Model Intelligence + GraphSAGE Explorer + Relearning** (§3.5–3.7) — reuse + the graph viz.
6. **Compliance hub + Audit Reports** (§3.12, §3.13) — assemble compliance components + report gen.
7. **Escalations, Approvals, Pipeline, LLM-usage, Broadcast, Policy** (§3.8–3.16) — operational rest.
8. **Audit + governance pass** — every admin action emits its event (§4); LLM-report provenance (A2);
   retraining gate blocks (A3).

---

## 9. The "Show-Stopper" Demo Script  🎬

A 5-minute scripted walkthrough that lands every wow-moment, all on the live Kafka sim:

1. **Command Center** — numbers tick live; "this is the whole bank, right now." Active-signals counter
   increments as ARGUS fires.
2. **Architecture Map** — packets pulse L1→L7; click CHRONOS → live AUCs; highlight the VERDICT→ORACLE
   **feedback loop**: "the system learns from every outcome."
3. **GraphSAGE Explorer** — force graph; click a PRIORITY customer → peers light up, attribution panel
   shows top features. "This is the GNN that scored them, and *why*."
4. **Decision Lineage Replay** (one customer) — animate signal→score→plan→content→outcome. "Seven
   layers, one customer, one story — fully auditable."
5. **RM Activity Tracker** — "here's exactly what RM Priya did for this customer," send a coaching note.
6. **Approval Queue** — approve an outreach; watch the consent + DND + DLT checks run and the
   `OUTREACH_SENT` audit appear.
7. **Relearning** — show the DR-uplift (causal vs raw) and the **retraining gate**: "we can't even
   retrain without a passing bias audit — RBI-grade governance."
8. **Audit Reports** — one click → LLM-narrated DPDPA report from the live logs. "Regulator-ready, in
   seconds, with provenance hashes."

End on the Command Center: "RM portal works the customers; this portal governs the whole machine — and
proves it's fair, compliant, and learning."

---

*The Admin portal is intentionally the mirror of the RM portal: where the RM is scoped, the Admin is
global; where the RM acts, the Admin oversees, governs, and proves. It leans hard on what already
exists — the model dashboards, the compliance components, the audit/consent spine, the GraphSAGE
scores — and adds the control-tower surfaces (RM management, architecture map, lineage replay, audit
reporting, governance gates) that turn a working demo into a defensible, board-ready platform.*
