import type { CreateCustomerInput } from "@/types";

// Use relative URLs so Next.js rewrites proxy to the backend (avoids CORS + mixed-content in production).
// Falls back to absolute localhost URL only when running outside of a Next.js server (e.g. unit tests).
const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
const TOKEN_KEY = 'pcop_token';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;
    const token = getToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        clearToken();
        // Only redirect to /login if we're not already there — prevents hard-reload loops.
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

export const api = {
    login: async (username: string, password: string) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        
        if (!response.ok) {
            throw new Error('Invalid credentials');
        }
        
        const data = await response.json();
        if (data.token) {
            setToken(data.token);
        }
        return data;
    },

    logout: () => {
        clearToken();
    },

    getPortfolioStats: () => fetchApi('/api/portfolio/stats'),
    getRiskDistribution: () => fetchApi('/api/portfolio/risk-distribution'),
    getChurnTrend: (weeks = 12) => fetchApi(`/api/portfolio/churn-trend?weeks=${weeks}`),
    getSignalBreakdown: () => fetchApi('/api/portfolio/signal-breakdown'),
    getTopAtRisk: (limit = 10) => fetchApi(`/api/portfolio/top-at-risk?limit=${limit}`),
    getMarketSignals: () => fetchApi('/api/portfolio/market-signals'),

    getCustomers: (params?: { segment?: string; risk_tier?: string; city?: string; search?: string; page?: number; limit?: number }) => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    searchParams.append(key, value.toString());
                }
            });
        }
        return fetchApi(`/api/customers?${searchParams.toString()}`);
    },

    getCustomerById: (id: string) => fetchApi(`/api/customers/${id}`),
    getCustomerSignals: (id: string) => fetchApi(`/api/customers/${id}/signals`),
    getCustomerInsights: (id: string) => fetchApi(`/api/customers/${id}/insights`),
    getCustomerTransactions: (id: string) => fetchApi(`/api/customers/${id}/transactions`),

    getDashboard: () => fetchApi('/api/analysis/dashboard'),
    getWarnings: () => fetchApi('/api/analysis/warnings'),

    getOutreach: (params?: { customer_id?: string; campaign_id?: string; channel?: string; status?: string; page?: number; limit?: number }) => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    searchParams.append(key, value.toString());
                }
            });
        }
        return fetchApi(`/api/outreach?${searchParams.toString()}`);
    },
    createOutreach: (data: { customer_id: string; channel: string; message?: string }) =>
        fetchApi('/api/outreach', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getCampaigns: () => fetchApi('/api/outreach/campaigns'),
    getCampaignsList: () => fetchApi('/api/outreach/campaigns/list'),

    runAnalysis: (customerId: string) =>
        fetchApi('/api/analysis/run', {
            method: 'POST',
            body: JSON.stringify({ customer_id: customerId }),
        }),

    // CHRONOS API
    getChronosScores: (params?: { page?: number; page_size?: number; anomaly_only?: boolean; tier?: string }) => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') searchParams.append(key, value.toString());
            });
        }
        return fetchApi(`/api/chronos/scores?${searchParams.toString()}`);
    },
    getChronosScore: (customerId: string) => fetchApi(`/api/chronos/scores/${customerId}`),
    analyzeChronosScore: (customerId: string) => fetchApi(`/api/chronos/scores/${customerId}/analyze`, { method: 'POST' }),
    getChronosReasonCodes: (customerId: string) => fetchApi(`/api/chronos/scores/${customerId}/reason-codes`),
    getChronosTokenSequence: (customerId: string) => fetchApi(`/api/chronos/scores/${customerId}/token-sequence`),
    getChronosModelHealth: () => fetchApi('/api/chronos/model-health'),
    getChronosScheduler: () => fetchApi('/api/chronos/model-health/scheduler'),
    getChronosStats: () => fetchApi('/api/chronos/stats'),

    // ── CHRONOS v2 endpoints ──────────────────────────────────────────────────
    getV2Scores: (params?: { tier?: string; urgency?: string }) => {
        const sp = new URLSearchParams();
        if (params?.tier) sp.set('tier', params.tier);
        if (params?.urgency) sp.set('urgency', params.urgency);
        return fetchApi(`/api/v2/scores?${sp}`);
    },
    getV2Score: (customerId: string) => fetchApi(`/api/v2/scores/${customerId}`),
    getV2ActionPlan: (customerId: string) => fetchApi(`/api/v2/action-plans/${customerId}`),
    getV2ActionPlans: () => fetchApi('/api/v2/action-plans'),
    getV2Content: (customerId: string) => fetchApi(`/api/v2/content/${customerId}`),
    getV2ModelHealth: () => fetchApi('/api/v2/model-health'),
    getV2PortfolioSurvival: () => fetchApi('/api/v2/portfolio-survival'),

    createCustomer: (data: CreateCustomerInput) =>
        fetchApi('/api/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── Review Queue ─────────────────────────────────────────────────────────
    getReviews: (params?: { status?: string; type?: string; priority?: string; assignedTo?: string; page?: number; limit?: number }) => {
        const sp = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') sp.append(key, value.toString());
            });
        }
        return fetchApi(`/api/reviews?${sp.toString()}`);
    },
    getReviewById: (id: string) => fetchApi(`/api/reviews/${id}`),
    createReviewCase: (data: { customer_id: string; type?: string; priority?: string; title?: string; description?: string; context?: Record<string, unknown> }) =>
        fetchApi('/api/reviews', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    takeReviewAction: (id: string, data: { action: string; comment?: string }) =>
        fetchApi(`/api/reviews/${id}/action`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    assignReview: (id: string, officerId: string) =>
        fetchApi(`/api/reviews/${id}/assign`, {
            method: 'PATCH',
            body: JSON.stringify({ officerId }),
        }),
    getReviewStats: () => fetchApi('/api/reviews/stats'),
    getReviewOfficers: () => fetchApi('/api/reviews/officers'),
};
