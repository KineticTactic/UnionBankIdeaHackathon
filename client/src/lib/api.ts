const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
        if (typeof window !== 'undefined') {
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
};
