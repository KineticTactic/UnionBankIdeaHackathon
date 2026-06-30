# RM Portal — Detailed Design Specification

> **Scope of this document:** the **Relationship Manager (RM)** side of the new two-portal
> PCOP UI. The Admin side is referenced only where the two intersect (audit, approvals,
> model governance) and will get its own spec later.
>
> **Design principle:** the RM portal is a *book-of-business cockpit*. Every screen answers one
> of three questions a real bank RM asks: **"Who needs me today?"**, **"What do I do about this
> person?"**, **"Did it work?"**. Everything else is supporting detail.
>
> **Build-on-what-exists principle:** this is a revamp, not a rewrite. Wherever an API, service,
> or component already exists it is named explicitly with its path. New work is tagged **🆕 NEW**.

---

## 0. The RM Persona & Mental Model

Our seed data already assigns every customer a `relationship_manager` (e.g. *Priya Menon*).
An RM owns a **book** — the subset of customers assigned to them — and is measured on
**retention saves**, **conversion on offers**, and **SLA on follow-ups**.

A real RM's day:

1. **Morning triage** — "Which of *my* customers got worse overnight? What's due today?"
2. **Deep dive** — open one customer, understand *why* they're at risk, decide the play.
3. **Act** — reach out: the right offer, the right channel, **in the customer's own language**,
   within consent + TRAI rules, through a human-approved gate.
4. **Close the loop** — after the call/visit/reply, **record what actually happened** so the
   system learns (this is the RAG feedback loop).
5. **Review** — track personal performance and pending work.

The portal is structured as exactly these five movements.

---

## 1. Role Scoping & Access Control

### 1.1 What changes from today

Today every authenticated role sees **all** customers (`GET /api/customers` returns the full
list). For the RM portal this is a **DPDPA §6 purpose-limitation / access-control problem** — an
RM should only see the book assigned to them.

**🆕 NEW — book scoping.** When `req.user.role === 'rm'`, the customer list, dashboard stats, and
all `/customers/:id` reads must be filtered to `customer.relationship_manager === req.user.name`
(or a dedicated `rm_id`). A `manager`/`admin` keeps the full view.

```
GET /api/customers            → if role=rm, server-side filter to own book
GET /api/customers/:id         → if role=rm and customer not in book → 403 + audit DATA_ACCESS_DENIED
GET /api/portfolio/summary     → 🆕 add ?scope=book for RM-only aggregates
```

> **Audit:** every cross-book access *attempt* (even denied) is logged via
> `auditLogService.logEvent({ eventType:'DATA_ACCESS_REQUEST'|'DATA_ACCESS_DENIED', ... })`.
> **Compliance:** without this scoping the portal would let an RM browse customers outside their
> lawful purpose → **DPDPA §6/§8 violation**. This is the single most important new guardrail.

### 1.2 Auth source of truth

`server/routes/auth.js` already issues the JWT with `{ id, username, role, name }`. The `rm_user`
demo account (`role: 'rm'`, `name: 'Relationship Manager'`) is the login. For book scoping to work
on real data we must **map the JWT identity to a `relationship_manager` value**. For the demo,
seed `rm_user.name` to match a populated RM in the customer data (e.g. map `rm_user` → *Priya
Menon*) so the book is non-empty.

---

## 2. Information Architecture — RM Portal Pages

| # | Route | Page | Purpose | Status |
|---|-------|------|---------|--------|
| 1 | `/rm` (or `/rm/today`) | **My Day** | Triage cockpit: book KPIs, priority queue, tasks, alerts | 🆕 NEW (assembles existing cards) |
| 2 | `/rm/book` | **My Book** | Filterable list of *my* customers only | 🆕 NEW (scoped variant of `/customers`) |
| 3 | `/rm/customers/[id]` | **Customer 360** | Deep dive + analysis + copilot + outreach + outcome | ♻️ REVAMP of `/customers/[id]` |
| 4 | `/rm/compose/[id]` | **Outreach Composer** | Generate → translate → consent-check → send/queue | 🆕 NEW (wraps HERALD + new translate) |
| 5 | `/rm/outreach` | **Outreach Tracker** | My sent items, statuses, pending approvals | ♻️ REVAMP of `/outreach` |
| 6 | `/rm/outcomes` | **Outcome Log** | Report what happened → indexed to RAG | 🆕 NEW |
| 7 | `/rm/performance` | **My Performance** | Personal KPIs, conversion, saves, SLA | 🆕 NEW (scoped analytics) |
| 8 | `/rm/tasks` | **Follow-ups** | Scheduled callbacks / reminders | 🆕 NEW |
| 9 | `/rm/customers/[id]` → **Call** modal | **Call & Meeting Capture** | Pre-call script → record → transcribe → LLM analysis → learning | 🆕 NEW |
| 10 | `/rm/calls` | **Call Log** | All my calls across the book — review, filter, reopen | 🆕 NEW |
| — | (global) | **RM Copilot** | Persistent FAB on every page | ✅ EXISTS (`RMCopilotPanel.tsx`) |

A left sidebar (reuse `components/layout/Sidebar.tsx`, new RM group) drives navigation. The Copilot
is a floating action button present on every page, pre-scoped to whichever customer is in context.

---

## 3. Page-by-Page Specification

### 3.1 My Day — `/rm/today`

**Intent:** the first screen every morning. Answers "who needs me today?"

**Layout (top → bottom):**

1. **Greeting + book health strip** — "Good morning, Priya. 3 customers crossed into PRIORITY
   overnight." Four `StatCard`s (`components/dashboard/StatCard.tsx`):
   - Book size (my customers)
   - At-risk count (ESCALATE + PRIORITY in my book)
   - Outreach pending my action (drafts + approvals waiting)
   - Follow-ups due today
2. **Priority Queue** (the heart of the page) — a ranked table of *my* customers needing action,
   sorted by `final_score × recency-of-new-signal`. Reuse `TopAtRiskTable.tsx`, scoped to book.
   Each row: name, segment, tier badge (`RiskBadge`), top signal, "last touched" date, and a
   one-click **Act** button → opens Customer 360.
3. **New Signals feed** — scoped slice of `KafkaStreamCard.tsx` / `KafkaFeed.tsx`, filtered to my
   book, so the RM sees live ARGUS alarms on their customers only.
4. **Tasks due** — compact list from `/rm/tasks` (callbacks I scheduled).

**Data sources (all existing, add `?scope=book`):**
`GET /api/portfolio/summary`, `GET /api/portfolio/top-at-risk`, `GET /api/portfolio/signal-breakdown`,
`GET /api/kafka/status`.

**Audit:** page load logs nothing (read-only dashboard). Clicking **Act** logs nothing until an
actual action is taken on the detail page.

**Compliance notes:** the live signal feed shows behavioural inferences (churn risk). Under
**RBI AI Governance 2024** these are decision-support, not automated decisions — the UI must never
present them as final ("flagged"/"blacklisted" language is banned, mirroring the HERALD content
rules in `heraldPrompt.js`). Use neutral phrasing: "needs attention", "engagement declining".

---

### 3.2 My Book — `/rm/book`

**Intent:** the full searchable list of my customers.

**Layout:** reuse `components/customers/CustomerTable.tsx` with:
- Filters: tier, segment, has-active-signal, consent-status, "untouched > N days".
- Columns: name, segment, tier, churn score (`ScoreBar`), preferred channel, **consent chip**
  (`ConsentStatusBadge.tsx`), last outreach date, last outcome.
- Row click → Customer 360.

**Data:** `GET /api/customers?scope=book` (scoped). Consent chip uses
`GET /api/rights/consent?customerId=…` (existing).

**Audit:** none on listing. The consent chip is read-only and reflects `consentService.getConsent`.

**Compliance:** the consent chip is a *proactive* signal so the RM never even attempts a
non-compliant outreach. Showing it here prevents wasted work and reduces TRAI/DPDPA breach risk
at the point of decision.

---

### 3.3 Customer 360 — `/rm/customers/[id]`  ♻️ REVAMP

This is the existing `/customers/[id]` page, reorganised for the RM workflow. It already has the
right tabs and panels — we restructure into **three zones** and add the outcome loop.

**Zone A — Header (always visible):** `CustomerHeader.tsx` + `RiskScoreCard.tsx`.
Name, segment, tenure, RM owner, tier badge, churn score with CI, **consent status badges**
(`ConsentStatusBadge`), and a **language indicator** (🆕 customer's preferred language — see §6).
Primary actions live here: **Run Analysis**, **Compose Outreach**, **Log Outcome**.

**Zone B — Understand (tabbed):** existing tabs, kept as-is:

| Tab | Component | Source API |
|-----|-----------|------------|
| Overview | `InsightCard`, `StatBox` | `GET /api/customers/:id` |
| Risk Score | `RiskScoreCard`, `ScoreBar` | `GET /api/v2/scores/:id` |
| Signals | `SignalPanel.tsx`, `TokenTimeline.tsx` | `GET /api/customers/:id/signals` |
| Transactions | `TransactionChart.tsx` | `GET /api/customers/:id/transactions` |
| Action Plan | `CompassPanel.tsx` | `GET /api/customers/:id/plan` |
| Survival | `SurvivalPanel.tsx` | `GET /api/customers/:id/survival` |
| **Explain** | `ExplainabilityPanel.tsx` | `GET /api/explain/churn-score` |
| CRM History | `CrmNotesPanel.tsx` | CRM notes |
| Data Rights | `DataRightsPanel.tsx` | `/api/rights/*` |

**Zone C — Act (the RM's decision surface):**

- **AI Analysis** (`AnalysisPanel.tsx`) — calls `POST /api/analysis/analyze` (NVIDIA DeepSeek).
  Returns a 180-word risk assessment. **Audit:** 🆕 should log `EXPLAINABILITY_ACCESSED` so we have
  a record that AI decision-support was viewed (RBI traceability).
- **Compose Outreach** → routes to `/rm/compose/[id]` (§3.4).
- **Log Outcome** → opens the outcome modal (§3.6).
- **RM Copilot FAB** (`RMCopilotPanel.tsx`) — already wired to `POST /copilot/ask`, pre-scoped to
  this `customerId`. The copilot has 15 read tools + RAG playbook retrieval (`rag_tool.py`).

**Compliance — the Explain tab is mandatory, not optional.** Under **RBI AI Governance 2024**
(model explainability) and **DPDPA §11 (right to information about automated processing)**, the RM
must be able to see *why* a score was produced before acting on it. The Explain tab
(`ExplainabilityPanel`) surfaces the GraphSAGE/TARE/HABITAT attributions — keep it one click away.

---

### 3.4 Outreach Composer — `/rm/compose/[id]`  🆕 NEW

**Intent:** the single most important new screen. Turns "I want to reach out" into a compliant,
personalised, multilingual, human-approved send.

**The five-step composer (left-to-right wizard or stacked steps):**

```
[1 Generate] → [2 Translate] → [3 Compliance Check] → [4 Review] → [5 Send / Queue]
```

**Step 1 — Generate.** Calls the existing async HERALD pipeline:
`POST /api/outreach/generate { customer_id }` → 202 + `jobId` → poll `GET /api/outreach/job/:jobId`
(this exact flow already exists in `lib/api.ts → generateOutreach`). Returns `{ email, sms, push }`
drafts built from the customer snapshot + COMPASS offer + active signals
(`heraldPrompt.js`). HERALD's hard rules already strip banned words (churn/risk/flagged) and ban
rate promises.

**Step 2 — Translate (🆕 multilingual).** This is a **new capability**. The RM picks the customer's
mother tongue (defaulted from the new `preferred_language` field — see §6). A new endpoint
re-runs the LLM as a translator/transcreator (not literal translation — *transcreation* preserves
tone and offer):

```
🆕 POST /api/outreach/translate
   body: { customer_id, content: {email,sms,push}, target_language: "ta" }
   → { translated: {email,sms,push}, source_language:"en", target_language:"ta",
       backtranslation: {…} }   // back-translation shown to RM for trust
```

Implementation reuses `services/llmClient.js` (NVIDIA) with a transcreation system prompt that
**re-applies the same HERALD content rules in the target language**. A back-translation to English
is returned so the RM (who may not read the target script) can verify meaning before sending.

**Step 3 — Compliance Check (automatic, blocking).** Before the send button is enabled, the
composer calls the consent + TRAI gate and shows a **traffic-light panel per channel**:

| Check | Service (exists) | Blocks send? |
|-------|------------------|--------------|
| DPDPA consent for purpose `retention_outreach` | `consentService.canSendOutreach` → `NO_DPDPA_CONSENT` | ✅ hard block |
| TRAI channel consent (DCA) | same → `NO_TRAI_CONSENT` | ✅ hard block |
| Opt-out list | same → `OPT_OUT` | ✅ hard block |
| DND registry (SMS) | `traiComplianceService.checkDndRegistry` | ✅ hard block |
| DLT registration | `traiComplianceService.validateDltRegistration` | ✅ hard block |
| Number series (140 promo / 160 txn) | `traiComplianceService.getRequiredNumberSeries` | ⚠️ auto-selected, shown |
| **🆕 Re-classify translated content** | `traiComplianceService.classifyOutreachType` on **translated** text | ⚠️ may flip promo/txn |

> **Compliance — the translation/classification trap.** TRAI classification
> (`classifyOutreachType`) keys off promotional keywords. If we classify the *English* draft but
> send the *translated* text, the classification may be wrong → **wrong number series → TRAI
> TCCCPR 2025 violation**. The design **must re-run `classifyOutreachType` on the translated
> string** (or on a back-translation). This is called out explicitly because it is the easiest
> compliance bug to introduce when adding multilingual support.

**Step 4 — Review.** Side-by-side: original + translated + back-translation, the auto-selected
number series, the consent verdicts, the COMPASS rationale. RM can edit the draft inline (edits
are re-scanned in Step 3).

**Step 5 — Send / Queue.** RM cannot send directly to the customer without the **human-approval
gate** — this is by design and already built:

- RM clicks **Submit for approval** → `POST /api/outreach/generate` already created the approval
  via `approvalService.createApprovalRequest`. A manager/risk officer approves via
  `POST /api/outreach/approve/:approvalId`, which runs the *final* consent + DND + DLT checks and
  emits `OUTREACH_SENT` / `OUTREACH_BLOCKED` audit events per channel.
- **🆕 RM self-send for low-risk channels?** A real bank may let an RM send a *transactional*,
  consented message directly. If we allow it, the same `/approve` checks must run inline and the
  RM's own identity is the `reviewedBy`. **Recommendation:** keep the manager gate for PROMOTIONAL,
  allow RM self-send only for TRANSACTIONAL + fully-consented. This matches **RBI AI Governance
  2024**: a human (the RM) is in the loop, and adverse/promotional actions get a second human.

**Audit (every step):**
`OUTREACH_QUEUED` (on generate), 🆕 `OUTREACH_TRANSLATED` (new event type — add to
`auditLogService.VALID_EVENT_TYPES`), `OUTREACH_PENDING_APPROVAL`, then `OUTREACH_SENT` /
`OUTREACH_BLOCKED` on approval. Content is **hashed (SHA-256), never stored raw** in the audit log
— the existing `/approve` route already does `crypto.createHash('sha256')`. The translated content
must be hashed the same way.

---

### 3.5 Outreach Tracker — `/rm/outreach`  ♻️ REVAMP

**Intent:** "what have I sent, what's pending, what bounced?"

**Layout — three tabs:**
1. **Sent** — `GET /api/outreach?customer_id=…` scoped to my book; status pills
   (sent/delivered/opened/clicked/failed) from the existing `outreachLog`.
2. **Pending approval** — `GET /api/outreach/pending`; shows my submissions awaiting a
   manager/risk decision (reuse `ApprovalQueuePanel.tsx`).
3. **Blocked** — items the compliance gate rejected, with the reason code
   (`NO_DPDPA_CONSENT`, `DND_REGISTRY`, …) so the RM knows the remediation (e.g. "ask customer to
   re-consent"). Sourced from `OUTREACH_BLOCKED` audit events.

**Audit:** read-only. Approve/reject happen on the manager side but are visible here for the RM's
own submissions.

---

### 3.6 Outcome Log — `/rm/outcomes`  🆕 NEW  *(the RAG feedback loop)*

**Intent:** this is the feature the user specifically asked for — *"report what happened after each
customer so it gets indexed in RAG… to determine what he actually did, did it happen."*

**Why it matters:** the RAG corpus already contains
`chronos/rag/corpus/past_outreach_outcomes.json` — segment/signal/channel/offer → outcome records
that the Copilot retrieves via `rag_tool.py` to recommend plays. Today that file is **static seed
data**. The Outcome Log makes it **living**: every real RM disposition becomes a new retrievable
record, so the next recommendation is grounded in what actually worked *here*.

**The disposition modal** (opened from Customer 360 → "Log Outcome", or standalone here):

```
🆕 POST /api/outcomes
   body: {
     customer_id,
     related_outreach_id?  // links to a tracked send, optional
     action_taken: "call" | "branch_visit" | "email_reply" | "sms" | "no_contact",
     contacted: true|false,
     outcome: "converted" | "retained" | "neutral" | "declined" | "unreachable" | "churned",
     offer_presented?: string,
     offer_accepted?: boolean,
     channel: string,
     language_used?: string,           // ties to multilingual
     rm_notes: string,                  // free text — the RM's own words
     follow_up_date?: ISODate           // creates a task in /rm/tasks
   }
```

**Server pipeline (the important part):**

1. **Persist** the raw disposition to `server/data/outcomes.json` (full record, RM-attributable).
2. **Audit** — 🆕 `OUTCOME_RECORDED` event (new type) with the outcome + a **hash** of `rm_notes`
   (not the raw note, to keep PII out of the audit log).
3. **De-identify → RAG.** Build an *anonymised, aggregatable* record matching the existing corpus
   schema (`segment`, `signals[]`, `channel`, `offer`, `outcome`, `notes`) — **strip customer_id,
   name, and any PII from `rm_notes`** before appending. Then re-run
   `python -m chronos.rag.build_index` (or an incremental add) so `retriever.py` serves it.
4. The Copilot's `retrieve_playbook_tool` now returns the RM's real outcomes alongside seed data.

> **Compliance — RAG is a PII landmine.** A vector index is hard to "unindex" and is effectively a
> new copy of personal data. **DPDPA §8(7) (data minimisation)** and the **right to erasure
> (§12)** mean we must **never index raw PII**. The pipeline therefore: (a) stores the
> attributable record in `outcomes.json` (which *is* covered by erasure — see the existing
> `erasureList.json` flow), and (b) indexes only a **de-identified, generalised** version
> (segment-level, no names, scrubbed notes). When a customer requests erasure, only the
> `outcomes.json` row is personal; the de-identified RAG chunk is non-personal by construction.
> This must be stated in the privacy notice and enforced by the de-identifier — flag any
> `rm_notes` that still contains a name/phone/email and block the RAG write until scrubbed.

**Why this also satisfies the "did it actually happen" ask:** because every outcome links
(optionally) to a `related_outreach_id` and carries `contacted`/`outcome`, the system can reconcile
**intended action (COMPASS plan) → sent content (HERALD) → real result (RM outcome)**. That triple
is exactly what Layer 6 VERDICT needs to measure uplift, and what closes the loop the user
described.

**Audit:** `OUTCOME_RECORDED` (new), plus `DATA_CORRECTION` if the RM edits a prior outcome.

---

### 3.7 My Performance — `/rm/performance`  🆕 NEW

**Intent:** the RM's personal scorecard. Scoped to their book only.

**Cards/charts (reuse existing chart components, scoped):**
- Retention saves this month (customers who were ESCALATE/PRIORITY and are now stable after my
  outreach) — derived from the outcome log.
- Conversion rate on offers presented (`offer_accepted / offer_presented`).
- Outreach funnel: generated → sent → opened → converted (from `outreachLog` + outcomes).
- Channel effectiveness for *my* book (which channel converts) — mirrors the RAG outcome data but
  personal.
- SLA: % of follow-ups completed on time.

**Data:** scoped `GET /api/portfolio/uplift`, `GET /api/outreach`, 🆕 `GET /api/outcomes?scope=book`.

**Compliance:** performance metrics are aggregate and about the *RM*, not new processing of
customer PII — low risk. Keep it that way: do not surface individual customer PII in ranking
leaderboards visible to other RMs.

---

### 3.8 Follow-ups — `/rm/tasks`  🆕 NEW

**Intent:** the RM's to-do list. Tasks are created from outcome `follow_up_date`, from "needs
attention" queue snoozes, and manually.

```
🆕 GET  /api/tasks?scope=book
🆕 POST /api/tasks { customer_id, due_date, note, type }
🆕 PUT  /api/tasks/:id { status:"done"|"snoozed", ... }
```

**Audit:** task create/complete are low-sensitivity but still logged (`TASK_CREATED`,
`TASK_COMPLETED`) for SLA traceability.

---

### 3.9 RM Copilot — global FAB  ✅ EXISTS (enhance)

`components/copilot/RMCopilotPanel.tsx` already implements a floating chat that posts to
`POST {COMPASS}/copilot/ask` with `{ session_id, rm_user_id, customer_id, message }`. The COMPASS
copilot (`layer4 .../copilot/router.py`) has 15 read tools + RAG retrieval and Postgres-backed
session memory, capped at `MAX_TOOL_ROUNDS=4` and `[LLM:1 per turn]`.

**Enhancements (🆕):**
- Pass the **real `rm_user_id`** from the JWT (today it defaults to `'rm-demo'`).
- **Scope guard:** the copilot's read tools must respect book scoping — an RM must not be able to
  ask about a customer outside their book. Enforce in the tool layer, not just the UI.
- Surface `tools_used` chips (already rendered) so the RM sees *which* data the answer used →
  explainability.

**Runtime reality (important):** the panel is real code, but `/copilot/ask` is served by the **COMPASS
Python service on :8004**, which the default two-Node-services demo does **not** run. Two fixes were
needed and are documented in **`layer4 compass orchestration/COPILOT_RUNBOOK.md`**:
- **Router mount (done):** `services/api/main.py` only exposed `/health`/`/version`/`/orchestrate` —
  the copilot router was never mounted, so `/copilot/ask` 404'd even with COMPASS up. Now mounted
  (guarded).
- **Tool demo-fallback (guideline):** the 15 read-tools query Postgres with no fallback. The runbook
  gives a `DEMO_MODE` pattern so they read the same demo JSON the Node server uses — full copilot,
  **no Postgres**. Session memory already skips Postgres in demo mode.

So: ✅ panel + agent **exist**; **run COMPASS (real)** per the runbook, or **fake mode** (`DEMO_MODE=true`
+ tool fallback) for the demo. The `/copilot/ask` **contract is fixed**, so demo↔real is env-only —
the frontend never changes.

**Compliance:** the copilot reads consent flags, CRM notes, transactions — all personal data. Two
rules: (1) **purpose-bound** (retention support only), (2) **book-scoped** (no fishing outside the
assigned book). Both are DPDPA §6 obligations. Every copilot turn is already `[LLM:1]` cost-tracked;
🆕 also log a lightweight `COPILOT_QUERY` audit event with the customer_id and tools_used (not the
raw message, to avoid logging free-text PII).

---

### 3.10 Call & Meeting Capture — the RM's richest learning signal  🆕 NEW

**Intent:** a phone call or branch meeting is the single most information-dense thing an RM does —
and today **all of it is lost** the moment the call ends. This surface captures the call, transcribes
it, has the LLM mine it for *structured learning signals*, and feeds those back into the model stack.
It is the **human-sensor** counterpart to the automated ARGUS/CHRONOS signals.

**The full workflow (Customer 360 → "Start Call"):**

```
[1 Pre-call script] → [2 Talk + record] → [3 Transcribe] → [4 LLM analysis]
                                                              → [5 RM confirms] → [6 Commit → learning]
```

**Step 1 — Pre-call script (the "call script" / talking points).** Before dialling, the RM gets a
**HERALD-generated** brief so the call is on-strategy. This is part of the HERALD pipeline —
same NVIDIA DeepSeek model, same banned-word rules, same `heraldPrompt.js` approach — just a
different prompt template aimed at *preparing* the RM rather than *contacting* the customer:

```
🆕 GET /api/outreach/call-script/:customerId
   → { talking_points[], recommended_offer, top_risk_drivers[],
       likely_objections[], rebuttals[]  // RAG playbook passages injected into prompt
       suggested_language,              // customer's mother tongue (§6)
       herald_job_id }                  // for audit trail — same as outreach generation
```

HERALD fetches the customer snapshot + COMPASS action plan, retrieves relevant playbook passages
via `rag_tool.py` (objection/rebuttal pairs from past calls), and generates a structured brief.
The same content rules apply — no guaranteed-return language, no flagging/blacklisting phrasing.
This is itself grounded in prior learning — `rebuttals[]` and `likely_objections[]` come from
the RAG corpus that earlier calls populated. The script gets better every time an RM logs a call.

**Step 2 — Talk + record.** RM clicks **Start Call** → **consent-to-record is captured first**
(`POST /api/calls/start { customer_id, consent_to_record:true }` → `CALL_STARTED` audit). Audio can
be (a) live-recorded, (b) uploaded after the call, or (c) skipped entirely if the RM just pastes
notes. **No recording is created without `consent_to_record`.**

**Step 3 — Transcribe.** `🆕 scripts/transcribe_call.py` — a pluggable speech-to-text script
(faster-whisper → openai-whisper → passthrough for a pasted transcript). It returns:
```
{ transcript, segments:[{start,end,text}], detected_language, duration_sec, backend }
```
Whisper is **multilingual** — it auto-detects Hindi/Tamil/Bengali/etc., which ties directly to the
multilingual outreach pipeline (§6): we learn the language the customer *actually* speaks, not just
the one on file.

**Step 4 — LLM analysis (NVIDIA DeepSeek).** `🆕 server/services/callAnalysisService.js` sends the
transcript + customer snapshot to the LLM and gets back a **structured `CallAnalysis`** — this is
where one call becomes *many* learning signals:
```jsonc
{
  "summary": "3-sentence neutral summary",
  "detected_language": "ta",
  "sentiment": "negative|neutral|positive",
  "sentiment_score": -0.4,
  "contacted": true,
  "outcome": "converted|retained|neutral|declined|unreachable|churned",
  "offer_presented": "premium_fd_rate_bump",
  "offer_accepted": false,
  "objections": ["rate lower than ICICI", "app too slow"],
  "rebuttals_that_worked": ["waived locker fee for 1yr"],
  "commitments": ["RM to call back Fri with credit-card pre-approval"],
  "life_events_mentioned": ["daughter starting college — needs education loan"],
  "competitor_mentions": ["ICICI 7.5% FD"],
  "channel_timing_preference": "call after 6pm, prefers WhatsApp",
  "risk_drivers_voiced": ["fees too high", "salary now credited elsewhere"],
  "follow_up_required": true,
  "follow_up_date": "2026-07-03",
  "compliance_flags": ["RM implied a guaranteed return — review"],
  "rm_action_items": ["send education-loan brochure"]
}
```

**Step 5 — RM confirms (human-in-the-loop).** The extraction is shown to the RM to **confirm or
edit** before anything is committed. The LLM is *decision-support*, not an automated decision — the
RM is the human gate (RBI AI Governance 2024). Edits are themselves a learning signal (they tell us
where extraction is weak).

**Step 6 — Commit → the learning fan-out.** This is why the call is "a learning thing": one confirmed
`CallAnalysis` is decomposed and routed to **every** part of the learning stack:

| Extracted from the call | Becomes | Feeds which learning loop | Speed |
|--------------------------|---------|---------------------------|-------|
| `outcome` (+ `related_outreach_id`) | ground-truth label — *did the predicted churn actually happen?* | **CHRONOS weekly RETRAIN**, DR-weighted (§ relearning) | weekly, gated |
| `objections` + `rebuttals_that_worked` | playbook passages | **RAG corpus** → Copilot + pre-call scripts | **instant** |
| `offer_accepted` vs `offer_presented` | offer effectiveness | **ORACLE REFINE** bandit (content/offer) | daily |
| `channel_timing_preference` | channel/timing prior | **ORACLE ROUTE** policy + customer profile | hourly |
| `life_events_mentioned` | confirmed life event | **COGNITION** life_events → risk adjustment (ARGUS) | next score |
| `competitor_mentions` | `competitor_risk` signal | **ARGUS** signal stream + market intel | next score |
| `sentiment_score` | satisfaction ground truth | calibration of NPS/engagement features | weekly |
| `compliance_flags` | governance signal | RM coaching + bias/compliance audit (Admin side) | immediate |

So a single call can: correct a churn label, enrich the playbook, update the channel policy, add a
life event, raise a competitor signal, and flag a compliance issue — all auditable, all feeding a
different learning cadence. **This is the human-in-the-loop relearning channel** that complements the
automated VERDICT→ORACLE loop.

**Backend (🆕):**
```
GET  /api/calls/script/:customerId   pre-call COMPASS talking points (RAG-grounded)
POST /api/calls/start                consent-to-record + CALL_STARTED audit → callId
POST /api/calls/transcribe           spawn transcribe_call.py → transcript JSON
POST /api/calls/analyze              LLM → CallAnalysis (uncommitted, for RM review)
POST /api/calls/commit               RM-confirmed → outcomes + signal writes + de-id RAG + audit
```
New service `callAnalysisService.js`, new script `scripts/transcribe_call.py`, new data file
`server/data/calls.json` (attributable, **erasable**), audio stored separately under a retention
policy. New audit types: `CALL_STARTED`, `CALL_TRANSCRIBED`, `CALL_ANALYZED`.

**Compliance — calls are the most sensitive surface in the whole portal:**

| # | Risk | Regulation | Mitigation |
|---|------|-----------|------------|
| C1 | Recording without consent | DPDPA §6; lawful-recording norms | `consent_to_record` mandatory before `CALL_STARTED`; no consent → no audio |
| C2 | Transcript is verbatim sensitive PII (financial, health, family) | DPDPA §8 security, §12 erasure | Store in `calls.json` (erasable) + audio encrypted, retention-capped; **only a de-identified, scrubbed summary** enters RAG (worse version of R6) |
| C3 | LLM mis-extraction drives a wrong action | RBI AI Gov 2024 | RM confirms every `CallAnalysis` before commit (Step 5) |
| C4 | RM said something non-compliant on the call | RBI fair-treatment / mis-selling | LLM emits `compliance_flags`; routed to Admin compliance audit, not hidden |
| C5 | Raw transcript hashed-but-leaked into audit | DPDPA Rule 4 | Audit stores transcript **hash + summary**, never the verbatim text |

---

### 3.11 What the RM Feeds Back — the Human-Sensor Catalogue

Calls are the richest input, but the RM contributes ground truth the models structurally **cannot
observe** across the whole portal. This catalogue is the answer to "what more is the RM doing?" —
every row is a deliberate learning input, not just data entry.

| RM contributes | Where it's captured | Why the models need it (they can't see it) | Learning target |
|----------------|---------------------|---------------------------------------------|-----------------|
| **Outcome / disposition** (did it work) | Outcome Log §3.6, Call §3.10 | closes the predict→act→result loop; the only source of real labels | CHRONOS retrain (DR-weighted) |
| **Call/meeting transcript** | §3.10 | the densest signal — objections, intent, life events, competitors | RAG + ORACLE + ARGUS |
| **Score disagreement** ("not actually at risk — they just travel 3 months/yr") | 🆕 "Flag this score" on Customer 360 | hard-negative mining; corrects systematic false positives | CHRONOS label correction + AEGIS drift |
| **Confirmed / new life event** | Call extraction + 🆕 manual add | RM often learns life events *before* any transaction signal fires | COGNITION life_events → ARGUS risk adj. |
| **Competitor intelligence** | Call extraction + 🆕 quick-tag | "ICICI offered 7.5%" is invisible to internal data | `competitor_risk` signal + market intel |
| **Offer preference** (what they *actually* wanted) | Outcome + call | COMPASS recommended FD; customer wanted CC limit — corrects NBA | ORACLE REFINE / offer policy |
| **Channel / timing / language preference** | Call + outcome | "WhatsApp after 6pm in Tamil" beats the on-file default | ORACLE ROUTE + profile + multilingual (§6) |
| **Relationship / household context** | 🆕 notes (referrals, family banking) | household churn risk & cross-sell the per-customer model misses | enrichment features |
| **Sentiment / NPS ground truth** | Call sentiment + outcome | RM's read vs computed NPS calibrates the proxy | feature calibration |
| **Objection → rebuttal that worked** | Call extraction | builds the institutional playbook from real wins | RAG (instant) → pre-call scripts |
| **Commitments / promises made** | Call + tasks | obligation tracking & "did we keep our word" SLA | Tasks §3.8 + audit |
| **Compliance self-flag / observed issue** | Call `compliance_flags` + 🆕 report | surfaces mis-selling / fairness issues for governance | Admin bias/compliance audit |

**Two speeds of learning (why this matters):** the RM's inputs hit the stack at three cadences —
**RAG (instant:** the next Copilot answer or call script already reflects it**)**, **ORACLE bandits
(daily/hourly:** offer & channel policy**)**, and **CHRONOS retrain (weekly, bias-gated:** model
weights**)**. So an RM logging one good call improves the *advice* the same day and the *models* by
the weekend — without ever bypassing the RBI retraining gate.

---

### 3.12 Call Log — `/rm/calls`  🆕 NEW

**Intent:** the capture flow (§3.10) lives *inside* a customer, but the RM also needs the
cross-customer view — "show me every call I logged this week, which ones still need follow-up, and
where did a compliance flag come up?" This is that page. It is a **list/review** surface, not a
capture surface — you never start a call here, you start it from Customer 360.

**Layout (top → bottom):**

1. **Summary strip** (`StatCard` ×4, scoped to book): calls this week · avg sentiment · conversion
   from calls (`offer_accepted / calls with an offer`) · open follow-ups originating from calls.
   A fifth **alert chip** if any call carries an unresolved `compliance_flag`.
2. **Filters:** date range, outcome, detected language, "has compliance flag", "follow-up overdue",
   customer search.
3. **Call table** — one row per call:

   | Column | Source field |
   |--------|--------------|
   | Date / time | `CALL_STARTED` timestamp |
   | Customer (links to 360) | `customer_id` → name |
   | Duration | `duration_sec` |
   | Language | `detected_language` (🌐 chip) |
   | Sentiment | `sentiment_score` (dot, same scale as `CrmNotesPanel`) |
   | Outcome | `outcome` (tier-style badge) |
   | Offer | `offer_presented` / accepted ✓✗ |
   | Follow-up | due date + status from Tasks (§3.8) |
   | ⚑ | red flag icon if `compliance_flags` non-empty |

4. **Row click → reopens the call** in the Customer 360 **Call modal in read-only mode**: summary,
   full `CallAnalysis`, and (on explicit expand) the transcript. Reopening keeps the customer context
   the whole reason the capture flow is a modal in the first place (§3.10).

**Data:** `🆕 GET /api/calls?scope=book` (list of `CallAnalysis` headers, **not** full transcripts —
those are fetched only when a row is expanded, so the list view never ships verbatim PII to the
browser in bulk).

**Audit:** the list is read-only metadata. **Opening a full transcript** is a privileged read of
sensitive personal data, so it logs `🆕 CALL_TRANSCRIPT_VIEWED { callId, customer_id, actor }` — this
gives a who-read-what trail over recordings (DPDPA §8 security obligation; mirrors how
`EXPLAINABILITY_ACCESSED` is logged on the analysis view).

**Compliance:**
- The list shows **summaries and metadata, never verbatim transcript text** — minimisation by default.
- A manager/admin viewing this page must still be **book-scoped or explicitly authorised**; an RM
  sees only their own calls (DPDPA §6). Cross-book access on the Admin side is a separate, logged
  privilege.
- `compliance_flags` surfaced here are also routed to the Admin compliance audit — the RM seeing
  their own flags supports self-correction, but governance owns resolution (RBI fair-treatment).

> **Admin-side mirror:** the Admin portal will have its own `/admin/calls` that is *not* book-scoped,
> used for compliance review and QA sampling — same data, different lawful basis and access controls.
> Out of scope here, noted so the API (`GET /api/calls`) is designed scope-aware from day one.

---

## 4. Cross-Cutting: Audit Coverage Matrix

Every RM action maps to an append-only audit event via `auditLogService.logEvent`
(RBI AI Governance 2024 + DPDPA Rule 4, 7-year retention). New event types to add to
`VALID_EVENT_TYPES`:

| RM action | Event type | New? | PII handling |
|-----------|-----------|------|--------------|
| View customer outside book (denied) | `DATA_ACCESS_DENIED` | 🆕 | customer_id only |
| Run AI analysis | `EXPLAINABILITY_ACCESSED` | exists | no content |
| Generate outreach | `OUTREACH_QUEUED` | exists | — |
| Translate outreach | `OUTREACH_TRANSLATED` | 🆕 | target_language, content **hash** |
| Submit for approval | `OUTREACH_PENDING_APPROVAL` | exists | — |
| Send (post-approval) | `OUTREACH_SENT` | exists | content **hash**, number series |
| Blocked by gate | `OUTREACH_BLOCKED` | exists | reason code |
| Log outcome | `OUTCOME_RECORDED` | 🆕 | outcome enum, notes **hash** |
| Edit outcome | `DATA_CORRECTION` | exists | — |
| Start call (consent-to-record) | `CALL_STARTED` | 🆕 | consent flag, customer_id |
| Transcribe call | `CALL_TRANSCRIBED` | 🆕 | language, duration, transcript **hash** |
| Analyse call | `CALL_ANALYZED` | 🆕 | outcome enum, summary **hash** |
| Open a call transcript (Call Log) | `CALL_TRANSCRIPT_VIEWED` | 🆕 | callId, customer_id |
| Flag a churn score (disagree) | `SCORE_DISPUTED` | 🆕 | reason enum |
| Copilot query | `COPILOT_QUERY` | 🆕 | tools_used, no raw text |
| Consent change | `CONSENT_GRANTED`/`REVOKED` | exists | — |
| Task create/complete | `TASK_CREATED`/`TASK_COMPLETED` | 🆕 | — |

**Rule (already followed in code):** logs store **hashes, masked numbers, and enums — never raw
content or PII**. Any new endpoint must follow this. The audit log is itself non-erasable
(legal-obligation basis), which is why raw PII must never enter it.

---

## 5. Compliance Risk Register (DPDPA 2023 · TRAI TCCCPR 2025 · RBI AI Gov 2024)

| # | Risk introduced by the RM portal | Regulation | Mitigation in this design |
|---|----------------------------------|-----------|---------------------------|
| R1 | RM browses customers outside their book | DPDPA §6 purpose limitation, §8 access control | Server-side book scoping (§1.1) + `DATA_ACCESS_DENIED` audit |
| R2 | Outreach sent without valid consent | DPDPA §7; TRAI DCA | `canSendOutreach` hard-blocks send (§3.4 step 3) — already built |
| R3 | Promotional SMS to DND number | TRAI TCCCPR | `checkDndRegistry` hard-block — already built |
| R4 | Wrong number series after translation | TRAI TCCCPR 2025 | **Re-classify translated text** (§3.4) — explicit new requirement |
| R5 | Translated content drops compliance rules | TRAI; RBI fair-treatment | Transcreation prompt re-applies HERALD banned-word rules in target language; back-translation shown to RM |
| R6 | Raw PII indexed into RAG (un-erasable) | DPDPA §8(7) minimisation, §12 erasure | De-identify before indexing; scrub notes; only `outcomes.json` is personal & erasable (§3.6) |
| R7 | AI score treated as automated decision | RBI AI Gov 2024; DPDPA §11 | Human-in-loop (RM + manager approval); Explain tab mandatory & one click away |
| R8 | Direct RM send bypasses second human | RBI AI Gov 2024 | RM self-send limited to TRANSACTIONAL + fully-consented; PROMOTIONAL keeps manager gate |
| R9 | Free-text RM notes leak PII into logs | DPDPA Rule 4 | Audit stores **hash** of notes, not text |
| R10 | Copilot answers about non-book customer | DPDPA §6 | Tool-layer scope guard, not just UI |
| R11 | Storing customer mother-tongue | DPDPA §8(7) | `preferred_language` is minimal, purpose-linked (better service); document in privacy notice |
| R12 | Call recording & transcripts (most sensitive surface) | DPDPA §6/§8/§12; RBI | Consent-to-record gate, encrypted+retention-capped storage, de-identified-only RAG, RM-confirmed analysis — see the **C1–C5 table in §3.10** |

> Every row that says "already built" is a reason to revamp rather than rewrite — the compliance
> spine exists; the RM portal must **route through it**, never around it.

---

## 6. Multilingual Outreach — Design Detail

The user's explicit ask: send in the customer's **mother tongue**.

**Data model (🆕):** add `preferred_language` to the customer record (ISO 639-1: `en`, `hi`, `ta`,
`bn`, `te`, `mr`, `ml`, `kn`, `gu`, `pa`). Default `en`. For the demo, derive a plausible value
from `city`/`city_tier` so records are populated (e.g. Kochi → `ml`).

**Pipeline:** HERALD generates in English (its rules are tuned in English) → **Translate step**
(§3.4) transcreates to `preferred_language` → **re-classify** for TRAI → render in the composer with
**back-translation** for RM verification → on send, the **translated** body is what's hashed,
classified, and dispatched.

**Why transcreation, not translation:** literal MT of a retention offer can sound robotic or
accidentally make a rate promise. The transcreation prompt instructs the model to *preserve intent,
warmth, and the offer; never introduce numbers/promises; keep the banned-word rules*. The
back-translation is the RM's trust mechanism.

**Audit:** `OUTREACH_TRANSLATED { customer_id, source:'en', target, contentHash }`.

**Compliance:** see R4, R5, R11 above. The single biggest trap is classifying English but sending
translated — the design forbids it.

---

## 7. New Backend Surface (summary of 🆕 endpoints)

```
POST  /api/outreach/translate         transcreate {email,sms,push} → target language + backtranslation
POST  /api/outcomes                   record RM disposition → outcomes.json + de-identified RAG append
GET   /api/outcomes?scope=book        list my outcomes (for performance + tracker)
PUT   /api/outcomes/:id               correct an outcome (DATA_CORRECTION)
GET   /api/tasks?scope=book           my follow-ups
POST  /api/tasks                      create follow-up
PUT   /api/tasks/:id                  complete / snooze
GET   /api/outreach/call-script/:customerId  pre-call HERALD brief (NVIDIA + RAG playbook, same pipeline as outreach generation)
POST  /api/calls/start                consent-to-record + CALL_STARTED → callId
POST  /api/calls/transcribe           spawn transcribe_call.py → transcript JSON
POST  /api/calls/analyze              LLM → CallAnalysis (uncommitted, for RM review)
POST  /api/calls/commit               RM-confirmed → outcomes + signal writes + de-id RAG + audit
GET   /api/calls?scope=book           Call Log list — metadata/summaries only (no bulk transcripts)
# pre-call script lives under outreach (HERALD pipeline):
GET   /api/outreach/call-script/:id   HERALD brief — talking_points, offer, objections, rebuttals (RAG-injected)
GET   /api/calls/:id                  one call — full CallAnalysis + transcript (CALL_TRANSCRIPT_VIEWED)
POST  /api/scores/:id/dispute         RM disagrees with a churn score (SCORE_DISPUTED)
# scoping additions (no new routes, new behaviour):
GET   /api/customers?scope=book       filter to req.user's book when role=rm
GET   /api/portfolio/*?scope=book     book-level aggregates
```

New services: `outcomeService.js` (persist + de-identify + trigger RAG re-index),
`translationService.js` (NVIDIA transcreation, reuses `llmClient.js`), `taskService.js`,
`callAnalysisService.js` (transcript → structured CallAnalysis via NVIDIA, + de-identify).
The pre-call script (`GET /api/outreach/call-script/:customerId`) is handled by the **HERALD
service** — same `heraldQueue.js` worker, new prompt template in `heraldPrompt.js`, RAG passages
injected from `rag_tool.py` before the LLM call.
New script: `scripts/transcribe_call.py` (pluggable Whisper STT, multilingual).
New audit event types added to `auditLogService.VALID_EVENT_TYPES`:
`OUTREACH_TRANSLATED`, `OUTCOME_RECORDED`, `DATA_ACCESS_DENIED`, `COPILOT_QUERY`,
`TASK_CREATED`, `TASK_COMPLETED`, `CALL_STARTED`, `CALL_TRANSCRIBED`, `CALL_ANALYZED`,
`CALL_TRANSCRIPT_VIEWED`, `SCORE_DISPUTED`.

New data files: `server/data/outcomes.json`, `server/data/tasks.json`,
`server/data/calls.json` (attributable, erasable).
RAG: extend `chronos/rag/build_index.py` to ingest the de-identified outcome **and call** stream.

---

## 8. Build Sequence (suggested)

1. **Book scoping** (§1.1) — the foundational guardrail; everything else assumes it.
2. **My Day + My Book** (§3.1, §3.2) — assemble from existing scoped cards.
3. **Customer 360 revamp** (§3.3) — reorganise existing page; wire real `rm_user_id` to copilot.
4. **Outreach Composer** (§3.4) incl. **translate** (§6) — the headline feature.
5. **Outcome Log + RAG loop** (§3.6) — the learning loop the user emphasised.
6. **Call capture + transcription + learning fan-out** (§3.10) — the richest human-sensor signal;
   `transcribe_call.py` + `callAnalysisService.js`, feeding RAG/ORACLE/ARGUS.
7. **Outreach Tracker, Performance, Tasks** (§3.5, §3.7, §3.8) — supporting surfaces.
8. **Audit + compliance pass** (§4, §5) — verify every new action emits the right event with no
   raw PII, the translated-classification trap (R4) is closed, and call recording is consent-gated
   (C1) with only de-identified transcripts reaching RAG (C2).

---

*This spec deliberately leans on what already exists — HERALD, the consent/TRAI services, the audit
log, the COMPASS copilot, and the FAISS RAG retriever — and adds only what the RM workflow genuinely
needs: book scoping, a compliant multilingual composer, a living outcome→RAG feedback loop, and a
call-capture surface that turns every conversation into structured learning. The through-line is that
the **RM is a human sensor**: their outcomes, calls, score-disputes, life-event confirmations, and
competitor intel are ground truth the models can't observe, fanned out across three learning cadences
(RAG instant · ORACLE daily · CHRONOS weekly, bias-gated). Every new action is auditable and every
new data flow — especially call recordings — is checked against DPDPA, TRAI, and RBI obligations.*
