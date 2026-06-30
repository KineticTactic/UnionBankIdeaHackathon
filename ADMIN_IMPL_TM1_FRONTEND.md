# Admin Portal — Team Member 1: Frontend Implementation Plan

> **Role:** Build every admin UI page, component, and layout.
> Backend API routes will be provided by TM2. All data flows through `client/src/lib/api.ts` —
> add your admin API calls there as you go.
>
> **Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript · Lucide icons
> **Auth:** `getToken()` from `@/lib/api` — JWT contains `role` field. Admin pages guard on `role === 'admin'`.
> **Design language:** Navy `#0f2d5c` · same risk tier colors as RM portal · same `StatCard`, `RiskBadge`, `ScoreBar` components.

---

## Your File Scope

```
client/src/
├── app/admin/
│   ├── layout.tsx                  ← Admin shell + nav (YOU OWN)
│   ├── page.tsx                    ← Command Center
│   ├── rms/
│   │   ├── page.tsx                ← RM Management table
│   │   └── [id]/page.tsx           ← RM Activity Tracker
│   ├── customers/
│   │   └── [id]/page.tsx           ← God-view Customer 360 (extend existing)
│   ├── graphsage/page.tsx          ← GraphSAGE Explorer
│   ├── architecture/page.tsx       ← Architecture Map (demo showpiece)
│   ├── compliance/page.tsx         ← Compliance & Governance hub
│   ├── audit/page.tsx              ← Audit Reports generator
│   ├── escalations/page.tsx        ← Escalations & Review queue
│   └── settings/page.tsx           ← Policy & RBAC config
└── components/admin/
    ├── AdminSidebar.tsx            ← Admin nav sidebar
    ├── LivePulse.tsx               ← Animated live-tick dot component
    ├── KpiTicker.tsx               ← Animated number counter
    └── LayerCard.tsx               ← Architecture map layer card
```

Pages that **reuse existing routes** (no new file needed, just link to them from admin nav):
- `/models` → Model Intelligence (already built)
- `/pipeline` → Live Pipeline & Health (already built)
- `/analytics` → VERDICT / Relearning (already built)
- `/admin/approvals` → reuse `ApprovalQueuePanel` component

---

## Part 1 — Admin Layout & Navigation

**File:** `client/src/app/admin/layout.tsx`

Build the admin shell — same structure as the existing main layout but with an **Admin sidebar**.

### Admin Sidebar sections

```
COMMAND
  ├── Command Center        /admin
  └── Live Pipeline         /pipeline   (external link)

OPERATIONS
  ├── RM Management         /admin/rms
  ├── All Customers         /customers  (existing god-view list)
  └── Escalations           /admin/escalations

MODELS & AI
  ├── Model Intelligence    /models     (external link)
  ├── GraphSAGE Explorer    /admin/graphsage
  ├── ORACLE Relearning     /analytics  (external link)
  └── Architecture Map      /admin/architecture

COMPLIANCE
  ├── Compliance Hub        /admin/compliance
  ├── Audit Reports         /admin/audit
  └── LLM Usage             /llm-usage  (external link)

SYSTEM
  ├── Approvals Queue       /approvals  (external link)
  └── Policy & RBAC         /admin/settings
```

**Role guard in layout:**
```tsx
// In layout.tsx, after token check:
const { user } = useAuth();
if (user && !['admin','manager','risk'].includes(user.role)) {
  redirect('/dashboard'); // bounce non-admins
}
```

---

## Part 2 — Command Center  `/admin`

**The executive hero screen. This is the first thing a judge/demo sees.**

### Layout (3 rows)

**Row 1 — Live KPI bar (6 cards, full width)**

| Card | Value | Source API |
|------|-------|-----------|
| Total Customers | count | `GET /api/admin/stats` |
| Active Signals Today | count (live tick) | same |
| Saves This Month | count | same |
| At-Risk Customers | count | same |
| Outreach Sent (24h) | count | same |
| Avg Churn Score | % | same |

Each card animates its number on load (count-up effect). At-risk card uses red accent if > threshold.

**Row 2 — 3-column grid**

- **Col 1 (lg:col-span-2):** Risk tier distribution bar — horizontal stacked bar showing PRIORITY / ESCALATE / STANDARD / MONITOR / NONE counts. Click a tier → navigates to `/customers?tier=PRIORITY`.
- **Col 2:** System health panel — 5 rows: `[●] L2 ARGUS`, `[●] L3 CHRONOS`, `[●] L4 COMPASS`, `[●] L5 HERALD`, `[●] Kafka`. Each row: name + status badge (LIVE / DEGRADED / DOWN) + latency ms. Pulls from TM2's `/api/admin/health` — poll every 10s.

**Row 3 — 2-column grid**

- **Left:** Top 10 at-risk customers table — columns: Name, ID, Tier badge, Churn %, RM name, Action button → `/admin/customers/[id]`
- **Right:** RM leaderboard — columns: RM name, Saves, Calls, Completion rate, Risk rank. Sorted by saves desc.

**Live pulse animation:** small green/amber dot on the header pulsing every 8s (matching Kafka simulation interval) — signals the system is live. Use this `LivePulse` component across all admin pages.

```tsx
// components/admin/LivePulse.tsx
export function LivePulse({ color = 'emerald' }: { color?: 'emerald' | 'amber' | 'red' }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${color}-400 opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 bg-${color}-500`} />
    </span>
  );
}
```

---

## Part 3 — RM Management  `/admin/rms`

### Page layout

**Header:** "RM Management" · count badge · search input · "Add RM" button (→ modal, TM2 provides POST endpoint)

**Table (full width):**

| Column | Content |
|--------|---------|
| RM Name | Avatar initials + name |
| Username | monospace |
| Book Size | count |
| At-Risk in Book | count (red if > 3) |
| Saves This Month | count |
| Calls This Week | count |
| Task Completion | % progress bar |
| Status | Active / Inactive badge |
| Actions | View · Edit · Deactivate |

Click row → `/admin/rms/[id]`

**Add RM modal** — fields: Full Name, Username, Email, Temp Password, Assigned Region. POST to `/api/admin/users` (TM2).

---

## Part 4 — RM Activity Tracker  `/admin/rms/[id]`

### Layout: 2-column (left 65% / right 35%)

**Left — Tab panel:**

- **Activity Feed** — chronological list of all actions by this RM: calls logged, outcomes, outreach sent, tasks created. Each item: timestamp + customer name + action + outcome badge.
- **Customer Book** — table of their assigned customers (same as `/rm/book` but read-only admin view with full churn scores visible)
- **Performance** — reuse performance stats from `/api/rm/performance` but admin-scoped to this RM's ID

**Right — Sidebar:**
- RM profile card: name, username, region, created date, last active
- Book stats: book size, avg churn score, at-risk count
- This month: saves, calls, tasks done
- "Send Note" button → textarea modal → POST `/api/admin/rms/[id]/notify`

---

## Part 5 — GraphSAGE Explorer  `/admin/graphsage`

**Purpose:** Visualise the knowledge graph peer-similarity layer used by the GraphSAGE model.

### Layout

**Top:** explanation banner — "GraphSAGE scores customers by their similarity to known churners in a peer network. Nodes = customers. Edges = shared employer / location / product tier."

**Main (2-col):**

**Left — Peer Network Panel:**
- Customer search/select (typeahead from existing customer list)
- On select: shows selected customer's GraphSAGE score + top 5 peer-similar customers
- Each peer: name, ID, graph score, shared attributes (employer / city / segment)
- Visual: simple list-based "constellation" — selected customer in center box, 5 peers listed below with similarity % and shared-trait badges

**Right — Score Distribution:**
- Histogram of all GraphSAGE scores (0–1) in 10 buckets — bar chart using Recharts BarChart
- Overlay: vertical line at current customer's score
- Below: percentile rank — "This customer's graph score is higher than X% of the portfolio"

**Bottom:** Score attribution table — top 5 features driving this customer's graph score (pull from `/api/explain/[id]`, filter to `graph_*` features)

---

## Part 6 — Architecture Map  `/admin/architecture`

**The demo showpiece. Make it look impressive.**

### Layout

Full-width canvas. Show the 7 PCOP layers as horizontal swimlanes, left → right data flow.

**Each layer card** (use `LayerCard` component):
- Layer number + name (e.g. "L2 · ARGUS Detection")
- Status dot (LivePulse)
- 2–3 bullet points of what it does
- Key metric (e.g. "9 signal agents · 42 active signals")
- Tech badge (e.g. "CUSUM · SPRT · Bayesian SR")

**7 layers:**

| Layer | Name | Metric | Tech |
|-------|------|--------|------|
| L1 | Data Ingestion | 50 customers · 60d txns | Kafka · PostgreSQL |
| L2 | ARGUS Detection | 9 signal agents | CUSUM · SPRT · Beta |
| L3 | CHRONOS Scoring | 4 ML models | TARE · HABITAT · GraphSAGE · GENESIS |
| L4 | COMPASS Orchestration | 7-node LangGraph | DeepSeek V3 · RAG |
| L5 | HERALD Content | Email · SMS · Push | NVIDIA DeepSeek V4 Pro |
| L6 | VERDICT Measurement | Qini · DR-ATE | Causal ML |
| L7 | ORACLE Learning | 4 cycles | Thompson · Bandits · A/B |

**Animated data flow:** CSS keyframe animation of small dots travelling left→right between layers (use `@keyframes flow` moving a dot from layer N to N+1). Triggered on page load.

**Kafka live ticker** at the bottom: "Last event: [event type] · [timestamp]" — polls `/api/kafka/events?limit=1` every 8s.

---

## Part 7 — Compliance Hub  `/admin/compliance`

**Assemble existing compliance components into one admin screen.**

### Layout: 3-col top + full-width bottom

**Top row — 3 stat cards:**
- Total Consent Records | source: `/api/rights/summary` (TM2)
- DSAR Requests Pending | source: same
- Bias Audit Status | PASS / REVIEW

**Middle — 2-col:**

**Left — Consent Ledger:**
- Table: Customer ID · DPDPA Consent · TRAI Consent · Opted Out · Last Updated
- Filter: All / Consented / Opted-out
- Pulls from `/api/admin/consent/ledger` (TM2)

**Right — DSAR Queue:**
- List of pending Data Subject Access Requests
- Each: customer ID, request type (ACCESS / ERASURE / PORTABILITY), date, status badge
- "Process" button → modal with confirm + reason field → PATCH `/api/rights/[id]`
- Reuse existing `DataRightsPanel` logic but admin-scoped

**Bottom — Bias Audit Panel:**
- Table: Segment (Mass Market / Mass Affluent / HNI) × Risk Tier distribution
- Flag if any segment has PRIORITY rate > 2× portfolio average (disparate impact warning)
- Source: `/api/admin/bias-audit` (TM2)

---

## Part 8 — Audit Reports  `/admin/audit`

### Layout

**Left 40% — Report builder:**

```
Report Type:  [dropdown]
  · Churn Intervention Summary
  · RM Performance Report  
  · Compliance / Consent Audit
  · Model Accuracy Report
  · DPDPA Data Processing Log

Date Range:   [from]  →  [to]
Format:       [PDF / CSV / JSON]
Include LLM summary:  [toggle]

              [Generate Report]
```

On generate → POST `/api/admin/reports/generate` (TM2) → show spinner → display result inline.

**Right 60% — Report preview:**

Shows the generated report as structured content:
- Header with bank name, report type, date range, generated timestamp
- Section headings (H2) + data tables
- Summary paragraph (if LLM summary toggled, text from AI)
- "Download" button at bottom

**Previous reports list** (below the builder):
- Table: Report Type · Generated At · Generated By · Download link
- Source: `/api/admin/reports/history` (TM2)

---

## Part 9 — Escalations  `/admin/escalations`

**Extend the existing `/reviews` page into a proper admin escalation center.**

### Layout: 2-col

**Left — Escalation Queue:**
- Filter tabs: ALL · PENDING · IN REVIEW · RESOLVED
- Each card:
  - Customer name + ID + risk tier badge
  - Escalated by: RM name
  - Reason / note
  - Created at timestamp
  - "Assign to me" · "Resolve" · "Request Info" buttons
- Source: `/api/reviews` (already exists) + `/api/admin/escalations` (TM2 extends it)

**Right — Selected Escalation Detail:**
- Slide-in panel (same pattern as calls page)
- Customer snapshot: churn score, tier, top signals
- RM notes / history
- Resolution form: outcome dropdown + notes textarea + "Resolve & Notify RM" button
- PATCH `/api/admin/escalations/[id]/resolve` (TM2)

---

## Part 10 — Policy & RBAC  `/admin/settings`

### Layout: 2-col (settings categories left, editor right)

**Left — Category list:**
```
● Risk Thresholds
● Contact Fatigue Rules
● Model Weights (read-only)
● Role Management
● Notification Config
```

**Right — Editor panel (changes based on selected category):**

**Risk Thresholds editor:**
| Tier | Score Range | Current | Edit |
|------|------------|---------|------|
| PRIORITY | ≥ 0.80 | [input] | |
| ESCALATE | 0.65–0.79 | [input] | |
| STANDARD | 0.45–0.64 | [input] | |
| MONITOR | 0.25–0.44 | [input] | |
| NONE | < 0.25 | (derived) | |
Save → PATCH `/api/admin/settings/thresholds` (TM2). Show confirmation modal ("This will re-tier all 50 customers. Confirm?")

**Contact Fatigue Rules:**
- Max outreach per customer per day: [input]
- Min days between contacts: [input]
- Suppression window after opt-out: [input] days
- Save → PATCH `/api/admin/settings/fatigue`

**Role Management:**
- Table of users: Username · Role · Last Login · Active toggle
- Edit role → dropdown (admin / manager / risk / rm / analyst)
- PATCH `/api/admin/users/[id]/role` (TM2)

---

## API calls to add in `api.ts`

TM2 will implement these endpoints. Add these stubs to `client/src/lib/api.ts`:

```typescript
// Admin
getAdminStats:           () => fetchApi('/api/admin/stats'),
getAdminHealth:          () => fetchApi('/api/admin/health'),
getAdminRms:             () => fetchApi('/api/admin/rms'),
getAdminRm:              (id: string) => fetchApi(`/api/admin/rms/${id}`),
getAdminRmActivity:      (id: string) => fetchApi(`/api/admin/rms/${id}/activity`),
createAdminUser:         (body: any) => fetchApi('/api/admin/users', { method:'POST', body }),
updateAdminUserRole:     (id: string, role: string) => fetchApi(`/api/admin/users/${id}/role`, { method:'PATCH', body:{ role } }),
getAdminConsentLedger:   (params?: any) => fetchApi('/api/admin/consent/ledger'),
getAdminBiasAudit:       () => fetchApi('/api/admin/bias-audit'),
getAdminEscalations:     (status?: string) => fetchApi(`/api/admin/escalations${status?`?status=${status}`:''}`),
resolveEscalation:       (id: string, body: any) => fetchApi(`/api/admin/escalations/${id}/resolve`, { method:'PATCH', body }),
generateAdminReport:     (body: any) => fetchApi('/api/admin/reports/generate', { method:'POST', body }),
getAdminReportHistory:   () => fetchApi('/api/admin/reports/history'),
getAdminSettings:        () => fetchApi('/api/admin/settings'),
updateAdminThresholds:   (body: any) => fetchApi('/api/admin/settings/thresholds', { method:'PATCH', body }),
updateAdminFatigue:      (body: any) => fetchApi('/api/admin/settings/fatigue', { method:'PATCH', body }),
notifyRm:                (id: string, message: string) => fetchApi(`/api/admin/rms/${id}/notify`, { method:'POST', body:{ message } }),
```

---

## Build Order (recommended)

1. **Admin layout + sidebar** — everything depends on this
2. **Command Center** — most visible, do this second
3. **RM Management + RM Activity Tracker** — core operations workflow
4. **Architecture Map** — demo showpiece, do before demo day
5. **Compliance Hub** — assemble existing components
6. **GraphSAGE Explorer** — good visual, moderate effort
7. **Audit Reports** — straightforward form + display
8. **Escalations** — extend existing reviews
9. **Policy & RBAC settings** — lowest priority

---

## Shared Design Rules

- All pages: `p-6` padding, no `max-w-*` constraint — fill the screen
- Stat cards: white bg, `border-l-4` colored accent, `border-slate-200`, `shadow-sm`, `rounded-xl`
- Tables: `bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`
- Empty states: centered icon + message + optional CTA button
- Loading: `<Skeleton>` from `@/components/ui/skeleton`
- Error: red banner with `AlertTriangle` icon
- Navy primary: `#0f2d5c` / hover: `#1a3f7a`
- Lucide icons only — no other icon library
