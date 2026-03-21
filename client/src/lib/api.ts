// API client for frontend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

export const api = {
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
    // The backend uses demoServer client directly for transactions, returning raw rows
    getCustomerTransactions: (id: string) => fetchApi(`/api/customers/${id}/transactions`),

    runAnalysis: (customerId: string) =>
        fetchApi('/api/analysis/run', {
            method: 'POST',
            body: JSON.stringify({ customer_id: customerId }),
        }),
};
