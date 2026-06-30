// API client — all calls proxied through Next.js rewrites to avoid CORS
const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
const TOKEN_KEY = 'pcop_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken(): void { localStorage.removeItem(TOKEN_KEY); }

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url   = `${API_URL}${endpoint}`;
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login'))
      window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `API Error ${response.status}`);
  }
  return response.json();
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  login: async (username: string, password: string) => {
    const r = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error('Invalid credentials');
    const data = await r.json();
    if (data.token) setToken(data.token);
    return data;
  },
  logout: () => clearToken(),

  // ── Portfolio ───────────────────────────────────────────────────────────────
  getPortfolioFull:      ()      => fetchApi('/api/portfolio/full'),
  getPortfolioSummary:   ()      => fetchApi('/api/portfolio/summary'),
  getTierDistribution:   ()      => fetchApi('/api/portfolio/tier-distribution'),
  getChurnTrend:         ()      => fetchApi('/api/portfolio/churn-trend'),
  getSignalBreakdown:    ()      => fetchApi('/api/portfolio/signal-breakdown'),
  getTopAtRisk:          (n=10)  => fetchApi(`/api/portfolio/top-at-risk?limit=${n}`),
  getModelHealth:        ()      => fetchApi('/api/portfolio/model-health'),
  getUpliftStats:        ()      => fetchApi('/api/portfolio/uplift'),
  getBanditState:        ()      => fetchApi('/api/portfolio/bandit'),

  // ── Customers ───────────────────────────────────────────────────────────────
  getCustomers: (params: Record<string, string | number | undefined> = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)); });
    return fetchApi(`/api/customers?${sp}`);
  },
  getCustomerById:       (id: string) => fetchApi(`/api/customers/${id}`),
  getCustomerSignals:    (id: string) => fetchApi(`/api/customers/${id}/signals`),
  getCustomerTransactions:(id: string) => fetchApi(`/api/customers/${id}/transactions`),
  getCustomerSurvival:   (id: string) => fetchApi(`/api/customers/${id}/survival`),
  getCustomerScore:      (id: string) => fetchApi(`/api/customers/${id}/score`),
  getCustomerPlan:       (id: string) => fetchApi(`/api/customers/${id}/plan`),
  getCustomerHerald:     (id: string) => fetchApi(`/api/customers/${id}/herald`),

  // ── V2 / CHRONOS ────────────────────────────────────────────────────────────
  getV2Scores:           ()           => fetchApi('/api/v2/scores'),
  getV2Score:            (id: string) => fetchApi(`/api/v2/scores/${id}`),
  getV2Signals:          ()           => fetchApi('/api/v2/signals'),
  getV2ActionPlans:      ()           => fetchApi('/api/v2/action-plans'),
  getV2ActionPlan:       (id: string) => fetchApi(`/api/v2/action-plans/${id}`),
  getV2Content:          ()           => fetchApi('/api/v2/content'),
  getV2ContentById:      (id: string) => fetchApi(`/api/v2/content/${id}`),
  getV2ModelHealth:      ()           => fetchApi('/api/v2/model-health'),
  getV2PortfolioSurvival:()           => fetchApi('/api/v2/portfolio-survival'),

  // ── Outreach ────────────────────────────────────────────────────────────────
  getCampaigns: () => fetchApi('/api/outreach/campaigns'),
  getOutreach: (params: Record<string, string | number | undefined> = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)); });
    return fetchApi(`/api/outreach?${sp}`);
  },
  getOutreachById:    (id: string) => fetchApi(`/api/outreach/${id}`),
  getOutreachJob:     (jobId: string) => fetchApi(`/api/outreach/job/${jobId}`),

  // Translation (GCP).  listLanguages() returns the dropdown options;
  // translateHerald() calls /api/outreach/translate-herald and returns
  // the translated content with metadata (mode, source, target).
  listLanguages:     ()      => fetchApi('/api/outreach/languages'),
  translateHerald:   (herald: any, target: string) =>
    fetchApi('/api/outreach/translate-herald', {
      method: 'POST',
      body:   JSON.stringify({ herald, target }),
    }),

  // generateOutreach: POST /generate → if 202+jobId, poll until complete (max 30s).
  // Falls back transparently when the queue is unavailable (sync 200 response).
  generateOutreach: async (customer_id: string) => {
    const initial = await fetchApi('/api/outreach/generate', { method: 'POST', body: JSON.stringify({ customer_id }) });
    if (!initial.jobId || initial.status !== 'queued') return initial; // sync fallback path
    const jobId = initial.jobId;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const poll = await fetchApi(`/api/outreach/job/${jobId}`);
      if (poll.state === 'completed') return { status: 'ok', ...poll.result };
      if (poll.state === 'failed')    throw new Error(poll.failedReason || 'HERALD generation failed');
    }
    throw new Error('HERALD generation timed out — check approval queue');
  },

  // ── Analysis ────────────────────────────────────────────────────────────────
  analyzeCustomer:    (customer_id: string) =>
    fetchApi('/api/analysis/analyze', { method: 'POST', body: JSON.stringify({ customer_id }) }),

  // ── Reviews ─────────────────────────────────────────────────────────────────
  getReviews: (params: Record<string, string | number | undefined> = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)); });
    return fetchApi(`/api/reviews?${sp}`);
  },
  getReviewById:      (id: string) => fetchApi(`/api/reviews/${id}`),
  getReviewStats:     () => fetchApi('/api/reviews/stats'),
  getReviewOfficers:  () => fetchApi('/api/reviews/officers'),
  approveReview:      (id: string, notes?: string) =>
    fetchApi(`/api/reviews/${id}/approve`, { method: 'POST', body: JSON.stringify({ notes }) }),
  rejectReview:       (id: string, notes?: string) =>
    fetchApi(`/api/reviews/${id}/reject`, { method: 'POST', body: JSON.stringify({ notes }) }),
  takeReviewAction: (id: string, opts: { action: string; comment: string }) => {
    if (opts.action === 'approve')
      return fetchApi(`/api/reviews/${id}/approve`, { method: 'POST', body: JSON.stringify({ notes: opts.comment }) });
    if (opts.action === 'reject')
      return fetchApi(`/api/reviews/${id}/reject`, { method: 'POST', body: JSON.stringify({ notes: opts.comment }) });
    return fetchApi(`/api/reviews/${id}/action`, { method: 'POST', body: JSON.stringify(opts) });
  },

  // ── Customers (create) ───────────────────────────────────────────────────────
  createCustomer: (data: unknown) =>
    fetchApi('/api/customers', { method: 'POST', body: JSON.stringify(data) }),

  // ── Kafka ────────────────────────────────────────────────────────────────────
  getKafkaStatus:     () => fetchApi('/api/kafka/status'),
  publishKafkaEvent:  (topic: string, key: string, value: object) =>
    fetchApi('/api/kafka/publish', { method: 'POST', body: JSON.stringify({ topic, key, value }) }),

  // ── Approval Queue (HERALD human-in-the-loop) ────────────────────────────────
  getPendingApprovals: (params: Record<string, string | undefined> = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, v); });
    return fetchApi(`/api/outreach/pending?${sp}`);
  },
  getApprovalById:  (id: string) => fetchApi(`/api/outreach/approval/${id}`),
  approveOutreach:  (id: string, reviewedBy?: string) =>
    fetchApi(`/api/outreach/approve/${id}`, { method: 'POST', body: JSON.stringify({ reviewedBy }) }),
  rejectOutreach:   (id: string, rejectionReason: string, reviewedBy?: string) =>
    fetchApi(`/api/outreach/reject/${id}`, { method: 'POST', body: JSON.stringify({ rejectionReason, reviewedBy }) }),

  // ── Consent & Data Rights (DPDPA 2023 + TRAI TCCCPR 2025) ────────────────────
  getConsent:       (customerId: string) => fetchApi(`/api/rights/consent?customerId=${encodeURIComponent(customerId)}`),
  grantDpdpaConsent:(customerId: string) =>
    fetchApi('/api/rights/consent/dpdpa', { method: 'POST', body: JSON.stringify({ customerId, grant: true }) }),
  revokeDpdpaConsent:(customerId: string) =>
    fetchApi('/api/rights/consent/dpdpa', { method: 'POST', body: JSON.stringify({ customerId, grant: false }) }),
  grantTraiConsent: (customerId: string, channels: string[]) =>
    fetchApi('/api/rights/consent/trai', { method: 'POST', body: JSON.stringify({ customerId, grant: true, channels }) }),
  revokeTraiConsent:(customerId: string) =>
    fetchApi('/api/rights/consent/trai', { method: 'POST', body: JSON.stringify({ customerId, grant: false }) }),
  addOptOut:        (customerId: string, channel: string) =>
    fetchApi('/api/rights/optout', { method: 'POST', body: JSON.stringify({ customerId, channel }) }),
  removeOptOut:     (customerId: string, channel: string) =>
    fetchApi('/api/rights/optout', { method: 'POST', body: JSON.stringify({ customerId, channel, remove: true }) }),
  exportCustomerData:(customerId: string) => fetchApi(`/api/rights/export?customerId=${encodeURIComponent(customerId)}`),
  requestErasure:   (customerId: string, reason?: string) =>
    fetchApi('/api/rights/erase', { method: 'POST', body: JSON.stringify({ customerId, reason }) }),
  getErasureStatus: (customerId: string) => fetchApi(`/api/rights/erasure-status?customerId=${encodeURIComponent(customerId)}`),

  // ── Explainability (RBI AI Governance 2024) ───────────────────────────────────
  getChurnExplanation:(customerId: string) => fetchApi(`/api/explain/churn-score?customerId=${encodeURIComponent(customerId)}`),
  getSignalExplanations:(customerId: string) => fetchApi(`/api/explain/signals?customerId=${encodeURIComponent(customerId)}`),
  getExplainModelHealth:() => fetchApi('/api/explain/model-health'),

  // ── RM Portal — Book ─────────────────────────────────────────────────────────
  getRmBook: (params: Record<string, string | undefined> = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => { if (v) sp.set(k, v); });
    return fetchApi(`/api/rm/book?${sp}`);
  },
  getRmBookSummary: () => fetchApi('/api/rm/book/summary'),

  // ── RM Portal — Tasks ────────────────────────────────────────────────────────
  getRmTasks: (status?: string) => fetchApi(`/api/rm/tasks${status ? `?status=${status}` : ''}`),
  createRmTask: (data: { customer_id: string; due_date: string; note?: string; type?: string }) =>
    fetchApi('/api/rm/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateRmTask: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/api/rm/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── RM Portal — Outcomes ─────────────────────────────────────────────────────
  getRmOutcomes: (customerId?: string) =>
    fetchApi(`/api/rm/outcomes${customerId ? `?customer_id=${encodeURIComponent(customerId)}` : ''}`),
  logRmOutcome: (data: Record<string, unknown>) =>
    fetchApi('/api/rm/outcomes', { method: 'POST', body: JSON.stringify(data) }),
  updateRmOutcome: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/api/rm/outcomes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── RM Portal — Calls ────────────────────────────────────────────────────────
  getRmCalls: (params: Record<string, string | undefined> = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => { if (v) sp.set(k, v); });
    return fetchApi(`/api/rm/calls?${sp}`);
  },
  getRmCall: (id: string) => fetchApi(`/api/rm/calls/${id}`),
  startCall: (customer_id: string) =>
    fetchApi('/api/rm/calls/start', { method: 'POST', body: JSON.stringify({ customer_id, consent_to_record: true }) }),
  analyzeCall: (customer_id: string, transcript: string) =>
    fetchApi('/api/rm/calls/analyze', { method: 'POST', body: JSON.stringify({ customer_id, transcript }) }),
  commitCall: (data: Record<string, unknown>) =>
    fetchApi('/api/rm/calls/commit', { method: 'POST', body: JSON.stringify(data) }),

  // ── RM Portal — Performance ──────────────────────────────────────────────────
  getRmPerformance: () => fetchApi('/api/rm/performance'),

  // ── Outreach — Translate + Call Script ──────────────────────────────────────
  translateOutreach: (data: { customer_id: string; content: Record<string, unknown>; target_language: string }) =>
    fetchApi('/api/outreach/translate', { method: 'POST', body: JSON.stringify(data) }),
  getCallScript: (customerId: string) => fetchApi(`/api/outreach/call-script/${encodeURIComponent(customerId)}`),

  // ── Admin Portal ─────────────────────────────────────────────────────────────
  getAdminStats:       () => fetchApi('/api/admin/stats'),
  getAdminHealth:      () => fetchApi('/api/admin/health'),
  getAdminRms:         () => fetchApi('/api/admin/rms'),
  getAdminRm:          (id: string) => fetchApi(`/api/admin/rms/${id}`),
  getAdminRmActivity:  (id: string) => fetchApi(`/api/admin/rms/${id}/activity`),
  notifyRm:            (id: string, message: string) =>
    fetchApi(`/api/admin/rms/${id}/notify`, { method: 'POST', body: JSON.stringify({ message }) }),
  getAdminUsers:       () => fetchApi('/api/admin/users'),
  updateUserRole:      (id: string, role: string) =>
    fetchApi(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  getConsentLedger:    () => fetchApi('/api/admin/consent/ledger'),
  getBiasAudit:        () => fetchApi('/api/admin/bias-audit'),
  getEscalations:      (status?: string) =>
    fetchApi(`/api/admin/escalations${status ? `?status=${status}` : ''}`),
  resolveEscalation:   (id: string, data: { outcome: string; notes: string }) =>
    fetchApi(`/api/admin/escalations/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
  generateReport:      (data: Record<string, unknown>) =>
    fetchApi('/api/admin/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
  getReportHistory:    () => fetchApi('/api/admin/reports/history'),
  getAdminSettings:    () => fetchApi('/api/admin/settings'),
  updateThresholds:    (data: Record<string, number>) =>
    fetchApi('/api/admin/settings/thresholds', { method: 'PATCH', body: JSON.stringify(data) }),
  updateChannels:      (data: Record<string, boolean>) =>
    fetchApi('/api/admin/settings/channels', { method: 'PATCH', body: JSON.stringify(data) }),
  updateFatigue:       (data: Record<string, number>) =>
    fetchApi('/api/admin/settings/fatigue', { method: 'PATCH', body: JSON.stringify(data) }),
};
