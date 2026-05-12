# PCOP Implementation Plan

## Phase 1: Bank Server Cleanup (~15 min)

### 1.1 Fix debug code in server.js
- Remove `console.trace()`, `console.log("Hiiiii")` on lines 253-254

### 1.2 Add missing endpoints
- `/api/core-banking/account-events` — account lifecycle events
- `/api/core-banking/kyc-updates` — KYC field update history

### 1.3 Verify health endpoint
- Ensure `/health` returns `{ status: "ok", timestamp: "..." }` per spec

---

## Phase 2: Server (Port 8000) — Core Infrastructure (~30 min)

### 2.1 Fix port configuration
- Change `server/index.js` to listen on port 8000 (or PORT env var)
- Update `server/config.js` with `BANK_API_BASE_URL` (currently `DEMO_SERVER_URL`)

### 2.2 Create auth middleware (`middleware/auth.js`)
- JWT verification middleware
- Extract user from token, attach to `req.user`
- `requireRole(roles)` factory for route protection

### 2.3 Create auth route (`routes/auth.js`)
- `POST /auth/login` — validate username/password, return JWT
- Seed users: `analyst/analyst123`, `manager/manager123`, `admin/admin123`

### 2.4 Create in-memory stores (`services/dataStore.js`)
- `churnScores[]` — 20 customers with scores per spec
- `signals[]` — signal results per customer
- `lifeEvents[]` — life events per spec
- `campaigns[]` — 3 campaigns per spec
- `outreachRecords[]` — 40+ outreach records
- `users[]` — seeded users with hashed passwords

### 2.5 Create analysis routes (`routes/analysis.js`)
- `GET /api/analysis/dashboard` — aggregates (risk distribution, critical count, outreach sent, uplift %)
- `GET /api/analysis/warnings` — last 50 active alarms

### 2.6 Create outreach routes (`routes/outreach.js`)
- `GET /api/campaigns` — list campaigns with stats
- `GET /api/outreach` — paginated outreach records
- `POST /api/outreach` — create outreach (auth: manager/admin)

---

## Phase 3: Client — Auth & Layout (~30 min)

### 3.1 Update API client (`lib/api.ts`)
- Fix base URL to `http://localhost:8000` (currently `http://localhost:3000`)
- Add JWT token from `localStorage` on every request
- Add 401 redirect to `/login` on unauthorized

### 3.2 Complete types (`types/index.ts`)
- Add: `LifeEvent`, `OutreachRecord`, `ContentPreview`, `Warning`, `Campaign`, `DashboardData`, `PaginatedResponse`

### 3.3 Create auth hooks (`hooks/`)
- `useAuth()` — login, logout, get current user
- `useRequireRole(role)` — redirect if insufficient permissions

### 3.4 Create Login page (`app/login/page.tsx`)
- Username + password form
- Store JWT in localStorage on success
- Redirect to `/dashboard`

### 3.5 Create ProtectedRoute component (`components/ProtectedRoute.tsx`)
- Redirect to `/login` if no token
- Wrap protected pages

### 3.6 Update Sidebar
- Add links: Signal Monitor, Outreach Hub, Analytics
- Add logout button

---

## Phase 4: Client — TanStack Query Hooks (~20 min)

### 4.1 Install dependencies
- `@tanstack/react-query` (check if already installed)

### 4.2 Create hooks (`hooks/`)
- `useDashboard()` — fetch `/api/analysis/dashboard`
- `useWarnings()` — fetch `/api/analysis/warnings` with 30s refetch
- `useSignals(filters)` — fetch signals
- `useCustomerSignals(id)` — fetch customer signals
- `useCampaigns()` — fetch campaigns
- `useOutreach(filters)` — fetch outreach records
- `useTriggerOutreach()` — mutation for POST

### 4.3 Update dashboard page
- Use `useDashboard()` instead of multiple hooks
- Use `useWarnings()` for warning feed

---

## Phase 5: Client — Missing Pages (~45 min)

### 5.1 Signal Monitor page (`app/signals/page.tsx`)
- `AlarmTable` — all detected signals, sortable by severity
- `SignalTypeBreakdown` — stacked bar chart (last 7 days)

### 5.2 Outreach Hub page (`app/outreach/page.tsx`)
- `CampaignList` — campaigns table with stats
- `OutreachQueue` — pending/failed items (manager approval)
- `ContentPreviewPanel` — outreach content preview
- `ChannelPerformanceSummary` — grouped bar chart

### 5.3 Analytics page (`app/analytics/page.tsx`)
- `UpliftBySegmentChart` — treatment vs holdout retention
- `PromptBankTable` — prompt versions with stats
- `ModelDriftMonitor` — score vs actual churn
- `CohortOutcomeHeatmap` — retention by channel × life event

---

## Phase 6: Infrastructure (~10 min)

### 6.1 Create docker-compose.yml
- Services: bank (3001), server (8000), client (5173)
- Proper env vars and dependencies

---

## Summary

| Phase | Area | Tasks | Est. Time |
|-------|------|-------|-----------|
| 1 | Bank | Debug code, 2 missing endpoints | 15 min |
| 2 | Server | Auth, data stores, 3 route files | 30 min |
| 3 | Client | Auth, types, login page | 30 min |
| 4 | Client | TanStack Query hooks | 20 min |
| 5 | Client | 3 missing pages | 45 min |
| 6 | Infra | docker-compose | 10 min |

**Total estimated: ~2.5 hours**
