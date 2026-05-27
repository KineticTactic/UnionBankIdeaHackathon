/**
 * Local data service — reads directly from bank/data JSON files.
 * Replaces demoServerClient calls that require localhost:3001.
 */
const path = require('path');
const fs = require('fs');
const dataStore = require('./dataStore');

const DATA_DIR = path.join(__dirname, '..', '..', 'bank', 'data');

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    } catch { return []; }
}

// lazy-loaded caches
let _customers = null;
let _accounts  = null;
let _events    = null;
let _crm       = null;
let _enrichment= null;

function customers()  { return _customers  || (_customers  = readJson('customers.json')); }
function accounts()   { return _accounts   || (_accounts   = readJson('accounts.json')); }
function events()     { return _events     || (_events     = readJson('account_events.json')); }
function crmNotes()   { return _crm        || (_crm        = readJson('crm_notes.json')); }
function enrichment() { return _enrichment || (_enrichment = readJson('enrichment.json') || {}); }

function enrichCustomer(c) {
    const score = dataStore.CHURN_SCORES[c.customer_id];
    const signals = dataStore.SIGNALS
        .filter(s => s.customer_id === c.customer_id && s.detected)
        .map(s => s.signal_type);
    const lifeEvts = dataStore.LIFE_EVENTS
        .filter(e => e.customer_id === c.customer_id)
        .map(e => e.event_type);
    return {
        ...c,
        churn_score: score?.churn_score ?? 0.5,
        risk_tier: score?.risk_tier ?? 'medium',
        reason_codes: score?.reason_codes ?? [],
        active_signals: signals,
        life_events: lifeEvts,
        recommended_action: score?.reason_codes?.[0] ?? 'Monitor Account',
    };
}

function getCustomers(filters = {}) {
    let list = customers().map(enrichCustomer);
    if (filters.segment)   list = list.filter(c => c.segment === filters.segment);
    if (filters.risk_tier) list = list.filter(c => c.risk_tier === filters.risk_tier);
    if (filters.city)      list = list.filter(c => c.city === filters.city);
    return { status: 'ok', data: list };
}

function getCustomerById(id) {
    const c = customers().find(c => c.customer_id === id);
    if (!c) return null;
    const ec = enrichCustomer(c);
    const accs = accounts().filter(a => a.customer_id === id);
    const evts = events().filter(e => e.customer_id === id);
    const crm  = crmNotes().filter(n => n.customer_id === id);
    const enr  = enrichment()[id];
    const complaints = crm.filter(n => n.note_type === 'complaint');

    // Build engagement from enrichment data (enrichment.json is keyed by customer_id)
    const engagementDefaults = { days_since_last_login: 14, total_sessions_30d: 8, avg_session_duration_s: 210, most_used_feature: 'balance_check' };
    const engagement = enr?.engagement_summary || engagementDefaults;

    // MCC categories derived from actual account events
    const mccCategories = { salary: 'Salary Credit', grocery: 'Grocery / Supermarket', utility: 'Utility Bill', emi: 'Loan EMI', travel: 'Travel', fuel: 'Fuel', insurance: 'Insurance Premium', entertainment: 'Entertainment' };
    const top_mccs = evts.slice(0, 5).map(e => ({
        mcc_code: e.product_code || 'MISC',
        mcc_description: mccCategories[e.event_type] || e.metadata?.product_name || e.event_type,
        count: 1
    }));

    return {
        status: 'ok',
        data: {
            customer: ec,
            accounts: accs,
            score_history: dataStore.getScoreHistory(id, 90),
            active_signal_details: dataStore.SIGNALS.filter(s => s.customer_id === id && s.detected),
            life_event_details: dataStore.LIFE_EVENTS.filter(e => e.customer_id === id),
            engagement,
            // resolved is boolean in crm_notes.json — use resolved === false for unresolved
            crm_summary: {
                total_complaints: complaints.length,
                unresolved_count: complaints.filter(n => n.resolved === false).length,
                avg_resolution_days: complaints.filter(n => n.resolution_days != null).reduce((s, n) => s + n.resolution_days, 0) / (complaints.filter(n => n.resolution_days != null).length || 1),
                last_complaint_at: complaints.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at || null,
            },
            top_mccs,
            enrichment: enr ? { linkedin_employer: enr.linkedin_employer, linkedin_title: enr.linkedin_title, credit_score: enr.credit_score, credit_score_band: enr.credit_score_band, competitor_proximity: enr.competitor_proximity, news_risk_flag: enr.news_risk_flag, news_summary: enr.news_summary } : null,
        },
    };
}

function getPortfolioStats() {
    const list = customers().map(enrichCustomer);
    const counts = { critical: 0, high: 0, medium: 0, watch: 0, low: 0 };
    let scoreSum = 0;
    list.forEach(c => {
        if (counts[c.risk_tier] !== undefined) counts[c.risk_tier]++;
        scoreSum += c.churn_score;
    });
    return {
        status: 'ok',
        data: {
            total_customers: list.length,
            critical_count: counts.critical,
            high_count: counts.high,
            medium_count: counts.medium,
            watch_count: counts.watch,
            low_count: counts.low,
            avg_churn_score: list.length ? scoreSum / list.length : 0,
            outreach_sent_this_week: dataStore.outreachRecords.filter(r => {
                const d = new Date(r.dispatched_at);
                const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
                return d.getTime() > week;
            }).length,
        },
    };
}

function getMarketSignals() {
    return {
        status: 'ok',
        data: [
            { signal_id: 'MS-001', signal_type: 'competitor_rate', description: 'HDFC Bank raised savings rate to 7.25%', severity: 'high', detected_at: new Date(Date.now() - 2 * 3600000).toISOString() },
            { signal_id: 'MS-002', signal_type: 'rbi_policy',      description: 'RBI repo rate unchanged at 6.50%', severity: 'info', detected_at: new Date(Date.now() - 24 * 3600000).toISOString() },
            { signal_id: 'MS-003', signal_type: 'fintech_promo',   description: 'Paytm Payments Bank running zero-fee promo', severity: 'medium', detected_at: new Date(Date.now() - 48 * 3600000).toISOString() },
        ],
    };
}

module.exports = { getCustomers, getCustomerById, getPortfolioStats, getMarketSignals };
