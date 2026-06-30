# Admin Portal — Team Member 2: Backend Implementation Plan

> **Role:** Build every admin API route, middleware extension, and data computation.
> TM1 will consume your endpoints from the frontend. All new routes go in `server/routes/admin.js`
> mounted at `/api/admin`. Existing auth middleware (`requireAuth`, `requireRole`) already exists —
> use it everywhere.
>
> **Stack:** Express.js · JSON demo data files (DEMO_MODE=true) · existing `dataStore` module
> **Auth:** JWT — `req.user.role` is available after `requireAuth`. Admin routes need `requireRole(['admin','manager','risk'])`.
> **Demo mode:** All endpoints must work with `config.demoMode === true` (no real DB needed).

---

## Your File Scope

```
server/
├── routes/
│   └── admin.js              ← YOUR MAIN FILE (all /api/admin/* routes)
├── middleware/
│   └── adminGuard.js         ← Role-scoped middleware helper (YOU CREATE)
├── services/
│   └── adminStats.js         ← Stats computation service (YOU CREATE)
└── index.js                  ← Add: app.use('/api/admin', require('./routes/admin'))  (YOU ADD)
```

Also extend:
- `server/data/users.json` — add admin/manager/risk demo users
- `server/routes/reviews.js` — extend escalation fields

---

## Part 0 — Setup: Mount & Guard

### 1. Add mount in `server/index.js`

```js
// After existing routes, before the 404 handler:
app.use('/api/admin', require('./routes/admin'));
```

### 2. Create `server/middleware/adminGuard.js`

```js
'use strict';
const { requireAuth, requireRole } = require('./auth');

// Full admin access (admin only)
const adminOnly = [requireAuth, requireRole(['admin'])];

// Operations access (admin + manager)
const opsAccess = [requireAuth, requireRole(['admin', 'manager'])];

// Compliance access (admin + manager + risk)
const complianceAccess = [requireAuth, requireRole(['admin', 'manager', 'risk'])];

module.exports = { adminOnly, opsAccess, complianceAccess };
```

---

## Part 1 — `GET /api/admin/stats`  (Command Center KPIs)

**Used by:** TM1 Command Center page (top KPI bar + RM leaderboard)

**Response shape:**
```json
{
  "status": "ok",
  "stats": {
    "total_customers": 50,
    "at_risk_count": 12,
    "active_signals_today": 34,
    "saves_this_month": 8,
    "outreach_sent_24h": 15,
    "avg_churn_score": 0.47,
    "tier_distribution": {
      "PRIORITY": 4, "ESCALATE": 8, "STANDARD": 18, "MONITOR": 14, "NONE": 6
    }
  },
  "rm_leaderboard": [
    { "rm_name": "Aditya Sharma", "username": "rm_user", "saves": 2, "calls": 2, "task_completion_rate": 25, "book_size": 11 }
  ],
  "top_at_risk": [
    { "customer_id": "...", "full_name": "...", "risk_tier": "PRIORITY", "churn_score": 0.91, "rm_name": "..." }
  ]
}
```

**Implementation:**
```js
router.get('/stats', complianceAccess, (req, res) => {
  const customers = dataStore.getAllCustomers();        // already exists
  const outcomes  = dataStore.getAllOutcomes?.() || [];
  const calls     = dataStore.getAllCalls?.() || [];
  const tasks     = dataStore.getAllTasks?.() || [];

  const atRisk = customers.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier));
  const savesThisMonth = outcomes.filter(o =>
    ['converted','retained'].includes(o.outcome) &&
    new Date(o.created_at) > new Date(Date.now() - 30*24*3600*1000)
  );
  const tierDist = customers.reduce((acc, c) => {
    acc[c.risk_tier] = (acc[c.risk_tier] || 0) + 1; return acc;
  }, {});
  const avgChurn = customers.reduce((s,c) => s + (c.churn_score||0), 0) / customers.length;

  // Build RM leaderboard from RM_BOOK_MAP
  const RM_BOOK_MAP = require('../routes/rm').RM_BOOK_MAP || { rm_user: 'Aditya Sharma' };
  const leaderboard = Object.entries(RM_BOOK_MAP).map(([username, rmName]) => {
    const book = customers.filter(c => c.relationship_manager === rmName);
    const rmOutcomes = outcomes.filter(o => o.rm_username === username);
    const rmCalls    = calls.filter(c => c.rm_username === username);
    const rmTasks    = tasks.filter(t => t.rm_username === username);
    const doneTasks  = rmTasks.filter(t => t.status === 'done');
    return {
      rm_name: rmName, username, book_size: book.length,
      saves: rmOutcomes.filter(o => ['converted','retained'].includes(o.outcome)).length,
      calls: rmCalls.length,
      task_completion_rate: rmTasks.length ? Math.round((doneTasks.length / rmTasks.length) * 100) : 0,
    };
  });

  res.json({
    status: 'ok',
    stats: {
      total_customers: customers.length, at_risk_count: atRisk.length,
      active_signals_today: Math.floor(Math.random()*20)+20, // demo: simulate
      saves_this_month: savesThisMonth.length,
      outreach_sent_24h: Math.floor(Math.random()*10)+5,     // demo: simulate
      avg_churn_score: parseFloat(avgChurn.toFixed(3)),
      tier_distribution: tierDist,
    },
    rm_leaderboard: leaderboard,
    top_at_risk: atRisk.slice(0,10).map(c => ({
      customer_id: c.customer_id, full_name: c.full_name,
      risk_tier: c.risk_tier, churn_score: c.churn_score,
      rm_name: c.relationship_manager,
    })),
  });
});
```

---

## Part 2 — `GET /api/admin/health`  (System Health)

**Used by:** TM1 Command Center health panel. Polled every 10s.

**Response shape:**
```json
{
  "status": "ok",
  "layers": [
    { "id": "argus",   "name": "L2 ARGUS",   "status": "live", "latency_ms": 12 },
    { "id": "chronos", "name": "L3 CHRONOS", "status": "live", "latency_ms": 8  },
    { "id": "compass", "name": "L4 COMPASS", "status": "live", "latency_ms": 340 },
    { "id": "herald",  "name": "L5 HERALD",  "status": "live", "latency_ms": 820 },
    { "id": "kafka",   "name": "Kafka Sim",  "status": "live", "latency_ms": 0   }
  ]
}
```

**Implementation:** In demo mode, return static `"live"` statuses with small random latency jitter. In production, probe `/health` on each microservice port.

```js
router.get('/health', complianceAccess, (req, res) => {
  const jitter = () => Math.floor(Math.random() * 30);
  res.json({
    status: 'ok',
    layers: [
      { id:'argus',   name:'L2 ARGUS',   status:'live', latency_ms: 10+jitter() },
      { id:'chronos', name:'L3 CHRONOS', status:'live', latency_ms: 6+jitter()  },
      { id:'compass', name:'L4 COMPASS', status:'live', latency_ms: 300+jitter()*10 },
      { id:'herald',  name:'L5 HERALD',  status:'live', latency_ms: 750+jitter()*10 },
      { id:'kafka',   name:'Kafka Sim',  status:'live', latency_ms: 0 },
    ],
  });
});
```

---

## Part 3 — RM Management Routes

### `GET /api/admin/rms`

Returns all RM accounts with their book stats.

```json
{
  "status": "ok",
  "rms": [
    {
      "username": "rm_user",
      "rm_name": "Aditya Sharma",
      "role": "rm",
      "book_size": 11,
      "at_risk_count": 4,
      "saves_this_month": 2,
      "calls_this_week": 2,
      "task_completion_rate": 25,
      "active": true,
      "last_active": "2026-06-30T05:44:00Z"
    }
  ]
}
```

Build this by iterating `RM_BOOK_MAP`, computing book/outcomes/calls/tasks per RM.

### `GET /api/admin/rms/:id`

Single RM profile + extended stats.

```json
{
  "status": "ok",
  "rm": { "username": "...", "rm_name": "...", "role": "rm" },
  "stats": { "book_size": 11, "at_risk_count": 4, "saves": 2, "calls": 2, "task_rate": 25 },
  "book": [ /* customer list */ ],
  "recent_activity": [ /* last 20 actions */ ]
}
```

### `GET /api/admin/rms/:id/activity`

Chronological feed of all RM actions (outcomes + calls + tasks created), newest first.

```json
{
  "status": "ok",
  "activity": [
    {
      "type": "outcome",
      "timestamp": "2026-06-22T10:30:00Z",
      "customer_id": "CUST-049",
      "customer_name": "Naveen Chakraborty",
      "summary": "Retained · phone call"
    },
    {
      "type": "call",
      "timestamp": "2026-06-22T10:00:00Z",
      "customer_id": "CUST-049",
      "customer_name": "Naveen Chakraborty",
      "summary": "8m call · Neutral sentiment"
    }
  ]
}
```

### `POST /api/admin/rms/:id/notify`

Send a note to an RM (demo: just log it; production: push notification or email).

```js
router.post('/rms/:id/notify', adminOnly, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ status:'error', message:'message required' });
  // Demo: just acknowledge
  console.log(`[Admin] Notifying RM ${req.params.id}: ${message}`);
  res.json({ status:'ok', sent: true, message });
});
```

---

## Part 4 — User Management Routes

### `GET /api/admin/users`

Returns all system users (from `server/data/users.json`).

```json
{
  "status": "ok",
  "users": [
    { "username": "admin", "role": "admin", "name": "Admin User", "active": true },
    { "username": "rm_user", "role": "rm", "name": "Relationship Manager", "active": true }
  ]
}
```

### `POST /api/admin/users`  (Create RM / user)

```js
router.post('/users', adminOnly, (req, res) => {
  const { username, name, role, password } = req.body;
  if (!username || !role) return res.status(400).json({ status:'error', message:'username and role required' });
  // Demo: add to in-memory users map. Production: hash password, insert DB.
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync(password || 'Welcome@123', 10);
  dataStore.addUser?.({ username, name, role, password_hash: hash, active: true });
  res.json({ status:'ok', message:`User ${username} created`, username });
});
```

### `PATCH /api/admin/users/:id/role`

```js
router.patch('/users/:id/role', adminOnly, (req, res) => {
  const { role } = req.body;
  const valid = ['admin','manager','risk','rm','analyst'];
  if (!valid.includes(role)) return res.status(400).json({ status:'error', message:'invalid role' });
  dataStore.updateUserRole?.(req.params.id, role);
  res.json({ status:'ok', username: req.params.id, role });
});
```

---

## Part 5 — Compliance & Consent Routes

### `GET /api/admin/consent/ledger`

Returns all customers' consent status in one call (admin-only god-view).

```js
router.get('/consent/ledger', complianceAccess, (req, res) => {
  const customers = dataStore.getAllCustomers();
  const consents  = dataStore.getAllConsents?.() || {};
  const rows = customers.map(c => ({
    customer_id: c.customer_id,
    full_name:   c.full_name,
    dpdpa_consent: consents[c.customer_id]?.dpdpa_consent ?? true,
    trai_consent:  consents[c.customer_id]?.trai_consent  ?? true,
    opted_out:     consents[c.customer_id]?.opted_out     ?? false,
    last_updated:  consents[c.customer_id]?.last_updated  ?? null,
  }));
  res.json({ status:'ok', total: rows.length, records: rows });
});
```

### `GET /api/admin/bias-audit`

Computes segment × tier distribution for fairness analysis.

```js
router.get('/bias-audit', complianceAccess, (req, res) => {
  const customers = dataStore.getAllCustomers();
  const segments  = [...new Set(customers.map(c => c.segment))];
  const tiers     = ['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'];

  const matrix = segments.map(seg => {
    const inSeg = customers.filter(c => c.segment === seg);
    const tierCounts = tiers.reduce((acc, t) => {
      acc[t] = inSeg.filter(c => c.risk_tier === t).length; return acc;
    }, {});
    const priorityRate = inSeg.length ? tierCounts['PRIORITY'] / inSeg.length : 0;
    return { segment: seg, count: inSeg.length, tiers: tierCounts, priority_rate: priorityRate };
  });

  const portfolioPriorityRate = customers.filter(c => c.risk_tier === 'PRIORITY').length / customers.length;
  const flags = matrix.filter(r => r.priority_rate > portfolioPriorityRate * 2);

  res.json({
    status: 'ok',
    portfolio_priority_rate: portfolioPriorityRate,
    matrix,
    disparate_impact_flags: flags.map(f => f.segment),
  });
});
```

---

## Part 6 — Escalations Routes

Extend the existing `/api/reviews` system.

### `GET /api/admin/escalations`

```js
router.get('/escalations', opsAccess, (req, res) => {
  const { status } = req.query;
  let items = dataStore.getReviews?.() || [];
  if (status) items = items.filter(r => r.status === status);
  res.json({ status:'ok', count: items.length, escalations: items });
});
```

### `PATCH /api/admin/escalations/:id/resolve`

```js
router.patch('/escalations/:id/resolve', opsAccess, (req, res) => {
  const { outcome, notes, notify_rm } = req.body;
  const updated = dataStore.resolveReview?.(req.params.id, {
    outcome, notes,
    resolved_by: req.user.username,
    resolved_at: new Date().toISOString(),
    status: 'resolved',
  });
  // Demo: log notify
  if (notify_rm) console.log(`[Admin] Notifying RM of resolution: ${req.params.id}`);
  res.json({ status:'ok', escalation: updated });
});
```

---

## Part 7 — Reports Routes

### `POST /api/admin/reports/generate`

```js
router.post('/reports/generate', complianceAccess, async (req, res) => {
  const { report_type, date_from, date_to, include_llm_summary } = req.body;
  const customers = dataStore.getAllCustomers();
  const outcomes  = dataStore.getAllOutcomes?.() || [];
  const calls     = dataStore.getAllCalls?.() || [];

  // Build report data based on type
  let data = {};
  if (report_type === 'churn_intervention') {
    data = {
      total_customers: customers.length,
      at_risk: customers.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
      interventions: outcomes.length,
      saves: outcomes.filter(o => ['converted','retained'].includes(o.outcome)).length,
      save_rate: outcomes.length ? (outcomes.filter(o => ['converted','retained'].includes(o.outcome)).length / outcomes.length * 100).toFixed(1) + '%' : '—',
    };
  } else if (report_type === 'compliance_audit') {
    data = {
      total_customers: customers.length,
      calls_recorded: calls.length,
      compliance_flags: calls.filter(c => c.compliance_flags?.length > 0).length,
      consent_coverage: '100%',
    };
  }
  // ... add other report types

  let llm_summary = null;
  if (include_llm_summary && process.env.NVIDIA_API_KEY) {
    // Optional: call DeepSeek to generate a summary paragraph
    // For demo, return a placeholder
    llm_summary = `Summary: Based on the ${report_type} report for ${date_from}–${date_to}, the portfolio shows ${data.save_rate || 'stable'} retention performance.`;
  }

  const report = {
    id: `RPT-${Date.now()}`,
    report_type,
    date_from, date_to,
    generated_at: new Date().toISOString(),
    generated_by: req.user.username,
    data,
    llm_summary,
  };

  dataStore.saveReport?.(report);
  res.json({ status:'ok', report });
});
```

### `GET /api/admin/reports/history`

```js
router.get('/reports/history', complianceAccess, (req, res) => {
  const reports = dataStore.getReports?.() || [];
  res.json({ status:'ok', reports: reports.slice(-20).reverse() });
});
```

---

## Part 8 — Settings / Policy Routes

### `GET /api/admin/settings`

```js
// Store settings in a JSON file or in-memory object
const DEFAULT_SETTINGS = {
  thresholds: { PRIORITY: 0.80, ESCALATE: 0.65, STANDARD: 0.45, MONITOR: 0.25 },
  fatigue: { max_per_day: 3, min_days_between: 2, suppression_window_days: 30 },
};
let currentSettings = { ...DEFAULT_SETTINGS };

router.get('/settings', adminOnly, (req, res) => {
  res.json({ status:'ok', settings: currentSettings });
});
```

### `PATCH /api/admin/settings/thresholds`

```js
router.patch('/settings/thresholds', adminOnly, (req, res) => {
  const { PRIORITY, ESCALATE, STANDARD, MONITOR } = req.body;
  // Validate: must be descending
  if (!(PRIORITY > ESCALATE && ESCALATE > STANDARD && STANDARD > MONITOR)) {
    return res.status(400).json({ status:'error', message:'Thresholds must be strictly descending' });
  }
  currentSettings.thresholds = { PRIORITY, ESCALATE, STANDARD, MONITOR };
  res.json({ status:'ok', thresholds: currentSettings.thresholds });
});
```

### `PATCH /api/admin/settings/fatigue`

```js
router.patch('/settings/fatigue', adminOnly, (req, res) => {
  const { max_per_day, min_days_between, suppression_window_days } = req.body;
  currentSettings.fatigue = { max_per_day, min_days_between, suppression_window_days };
  res.json({ status:'ok', fatigue: currentSettings.fatigue });
});
```

---

## Part 9 — Demo Data Additions

### Add admin users to `server/data/users.json` (or the in-memory auth store)

```json
[
  { "username": "admin",   "password": "admin123",   "role": "admin",   "name": "Admin User" },
  { "username": "manager", "password": "manager123", "role": "manager", "name": "Operations Manager" },
  { "username": "risk",    "password": "risk123",    "role": "risk",    "name": "Risk Officer" },
  { "username": "rm_user", "password": "rm123",      "role": "rm",      "name": "Relationship Manager" }
]
```

Check `server/routes/auth.js` to see how users are loaded — match that format exactly.

---

## Part 10 — `dataStore` Extensions Needed

The existing `dataStore` (loaded from JSON files in demo mode) may not expose all-outcomes and all-calls globally. You may need to add these to `server/dataStore.js`:

```js
// Add these if they don't exist:
getAllOutcomes: () => {
  // Return all outcomes across all RMs from server/data/outcomes.json
  const fs = require('fs');
  try { return JSON.parse(fs.readFileSync('./data/outcomes.json')); } catch { return []; }
},
getAllCalls: () => {
  const fs = require('fs');
  try { return JSON.parse(fs.readFileSync('./data/calls.json')); } catch { return []; }
},
getAllTasks: () => {
  const fs = require('fs');
  try { return JSON.parse(fs.readFileSync('./data/tasks.json')); } catch { return []; }
},
getAllConsents: () => {
  const fs = require('fs');
  try {
    const raw = JSON.parse(fs.readFileSync('./data/consents.json'));
    return raw.reduce((acc, c) => { acc[c.customer_id] = c; return acc; }, {});
  } catch { return {}; }
},
saveReport: (report) => {
  // Append to reports.json (demo: in-memory array)
},
getReports: () => [ /* stored reports */ ],
```

---

## Full Route Table

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/admin/stats` | complianceAccess | Command Center KPIs |
| GET | `/api/admin/health` | complianceAccess | Layer health status |
| GET | `/api/admin/rms` | opsAccess | All RMs + book stats |
| GET | `/api/admin/rms/:id` | opsAccess | Single RM profile |
| GET | `/api/admin/rms/:id/activity` | opsAccess | RM activity feed |
| POST | `/api/admin/rms/:id/notify` | adminOnly | Send note to RM |
| GET | `/api/admin/users` | adminOnly | All system users |
| POST | `/api/admin/users` | adminOnly | Create user |
| PATCH | `/api/admin/users/:id/role` | adminOnly | Update role |
| GET | `/api/admin/consent/ledger` | complianceAccess | All consent records |
| GET | `/api/admin/bias-audit` | complianceAccess | Segment fairness matrix |
| GET | `/api/admin/escalations` | opsAccess | Escalation queue |
| PATCH | `/api/admin/escalations/:id/resolve` | opsAccess | Resolve escalation |
| POST | `/api/admin/reports/generate` | complianceAccess | Generate report |
| GET | `/api/admin/reports/history` | complianceAccess | Report history |
| GET | `/api/admin/settings` | adminOnly | Current policy settings |
| PATCH | `/api/admin/settings/thresholds` | adminOnly | Update tier thresholds |
| PATCH | `/api/admin/settings/fatigue` | adminOnly | Update fatigue rules |

---

## Build Order (recommended)

1. **Mount + adminGuard.js** — needed before anything else works
2. **`/stats` + `/health`** — TM1 needs these first for Command Center
3. **`/rms` + `/rms/:id` + `/rms/:id/activity`** — RM Management pages
4. **`/users` CRUD** — RBAC settings page
5. **`/consent/ledger` + `/bias-audit`** — Compliance Hub
6. **`/escalations`** — Escalations page
7. **`/reports/generate` + `/reports/history`** — Audit Reports
8. **`/settings`** — Policy config (lowest risk, do last)

---

## Coordinate with TM1

- **Share early:** TM1 needs `/stats` and `/health` on Day 1 so they can build the Command Center with real data.
- **API contract:** The response shapes in this doc are the contract — don't rename fields without telling TM1.
- **Demo users:** Make sure `admin` / `manager` / `risk` logins work before TM1 tests their role guards.
- **Demo data tip:** If `dataStore.getAllCalls()` returns `[]`, the leaderboard will look empty. Verify the data files exist: `server/data/calls.json`, `server/data/outcomes.json`, `server/data/tasks.json`.
