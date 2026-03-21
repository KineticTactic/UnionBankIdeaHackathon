const axios = require('axios');
const config = require('../config');

const client = axios.create({
    baseURL: config.demoServerUrl,
});

// Helper to standardise responses
const extractData = (response) => {
    if (response.data && response.data.status === 'ok') {
        return response.data;
    }
    return response.data;
};

// API calls matching demo server PRD

async function getCustomers(filters = {}) {
    const { segment, city, risk_tier } = filters;
    const params = new URLSearchParams();
    if (segment) params.append('segment', segment);
    if (city) params.append('city', city);
    if (risk_tier) params.append('risk_tier', risk_tier);

    const res = await client.get(`/api/core-banking/customers?${params.toString()}`);
    return extractData(res);
}

async function getCustomerById(id) {
    const res = await client.get(`/api/customers/${id}/snapshot`);
    return extractData(res);
}

async function getTransactionSummary(id, from, to) {
    const params = new URLSearchParams({ customer_id: id });
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const res = await client.get(`/api/core-banking/transactions/summary?${params.toString()}`);
    return extractData(res);
}

async function getSalaryCredits(id, months) {
    const params = new URLSearchParams({ customer_id: id });
    if (months) params.append('months', months.toString());

    const res = await client.get(`/api/core-banking/salary-credits?${params.toString()}`);
    return extractData(res);
}

async function getCrmNotes(id, limit) {
    const params = new URLSearchParams({ customer_id: id });
    if (limit) params.append('limit', limit.toString());

    const res = await client.get(`/api/crm/notes?${params.toString()}`);
    return extractData(res);
}

async function getLoginSeries(id, days) {
    const params = new URLSearchParams({ customer_id: id });
    if (days) params.append('days', days.toString());

    const res = await client.get(`/api/app-events/login-series?${params.toString()}`);
    return extractData(res);
}

async function getMccSummary(id, from, to) {
    const params = new URLSearchParams({ customer_id: id });
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const res = await client.get(`/api/card-network/mcc-summary?${params.toString()}`);
    return extractData(res);
}

async function getEnrichment(id) {
    const res = await client.get(`/api/enrichment/${id}`);
    return extractData(res);
}

async function getAppEngagement(id) {
    const res = await client.get(`/api/app-events/summary?customer_id=${id}`);
    return extractData(res);
}

async function getCrmSummary(id) {
    const res = await client.get(`/api/crm/complaints/summary?customer_id=${id}`);
    return extractData(res);
}

async function getStressIndicators(id) {
    const res = await client.get(`/api/card-network/stress-indicators?customer_id=${id}`);
    return extractData(res);
}

async function getLocationSeries(id) {
    const res = await client.get(`/api/card-network/location-series?customer_id=${id}`);
    return extractData(res);
}

async function getMarketSignals() {
    const res = await client.get('/api/enrichment/market-signals');
    return extractData(res);
}

async function getPortfolioStats() {
    // Demo server doesn't have a single portfolio stats endpoint
    // We aggregate here by fetching all customers
    const res = await getCustomers();
    const customers = res.data || [];

    const stats = {
        total_customers: customers.length,
        critical_count: customers.filter(c => c.risk_tier === 'critical').length,
        high_count: customers.filter(c => c.risk_tier === 'high').length,
        medium_count: customers.filter(c => c.risk_tier === 'medium').length,
        watch_count: customers.filter(c => c.risk_tier === 'watch').length,
        low_count: customers.filter(c => c.risk_tier === 'low').length,
        avg_churn_score: customers.length ? (customers.reduce((acc, c) => acc + c.churn_score, 0) / customers.length) : 0,
        outreach_sent_this_week: 47 // Hardcoded per PRD
    };

    return stats;
}

module.exports = {
    getCustomers,
    getCustomerById,
    getTransactionSummary,
    getSalaryCredits,
    getCrmNotes,
    getLoginSeries,
    getMccSummary,
    getEnrichment,
    getPortfolioStats,
    getAppEngagement,
    getCrmSummary,
    getStressIndicators,
    getLocationSeries,
    getMarketSignals,
    client
};
