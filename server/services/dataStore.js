'use strict';
/**
 * dataStore.js — thin facade over either JSON (DEMO_MODE=true) or Postgres (DEMO_MODE=false).
 * All accessor functions are async so the caller pattern is identical in both modes.
 * Static data exports (CUSTOMERS, HERALD, etc.) remain synchronous arrays — used by module-level
 * seeding code in outreach.js and reviews.js that runs at require() time.
 */

const path   = require('path');
const fs     = require('fs');
const config = require('../config');

const DEMO = config.demoMode;

// ── Load static demo data ─────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');

function load(filename) {
    const fp = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fp)) {
        console.warn(`[dataStore] WARNING: ${filename} not found at ${fp}`);
        return null;
    }
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

const CUSTOMERS    = load('customers.json')    || [];
const SCORES       = load('scores.json')       || [];
const SIGNALS      = load('signals.json')      || [];
const TRANSACTIONS = load('transactions.json') || [];
const SURVIVAL     = load('survival.json')     || [];
const ACTION_PLANS = load('action_plans.json') || [];
const HERALD       = load('herald.json')       || [];
const PORTFOLIO    = load('portfolio.json')    || {};

// Derived convenience exports (kept for backward-compat — e.g. reviewStore.js,
// localData.js).  CHURN_SCORES is derived from scores.json (per-customer
// {final_score, risk_tier, …}), not from customers.json.
const CUSTOMER_IDS = CUSTOMERS.map(c => c.customer_id);
const CHURN_SCORES = SCORES.reduce((m, s) => { m[s.customer_id] = s; return m; }, {});

// Lookup maps for O(1) access in DEMO_MODE
const CUSTOMERS_MAP    = CUSTOMERS.reduce((m, c) => { m[c.customer_id] = c; return m; }, {});
const SCORES_MAP       = SCORES.reduce((m, s)    => { m[s.customer_id] = s; return m; }, {});
const SIGNALS_MAP      = SIGNALS.reduce((m, s)   => { m[s.customer_id] = s; return m; }, {});
const TRANSACTIONS_MAP = TRANSACTIONS.reduce((m, t) => { m[t.customer_id] = t; return m; }, {});
const SURVIVAL_MAP     = SURVIVAL.reduce((m, s)  => { m[s.customer_id] = s; return m; }, {});
const PLANS_MAP        = ACTION_PLANS.reduce((m, p) => { m[p.customer_id] = p; return m; }, {});
const HERALD_MAP       = HERALD.reduce((m, h)    => { m[h.customer_id] = h; return m; }, {});

// Signal-level convenience accessor (e.g. LIFE_EVENTS) — derived from signals.json.
const LIFE_EVENTS = SIGNALS.filter(s => s.signal_type === 'life_event' || s.life_event).map(s => ({
    customer_id: s.customer_id,
    event_type:  s.life_event || s.signal_type,
    confidence:  s.confidence,
    evidence:    s.evidence,
    detected_at: s.detected_at,
}));

console.log(`[dataStore] Loaded ${CUSTOMERS.length} customers, ${HERALD.length} HERALD records (demo=${DEMO})`);

// ── Live state for DEMO_MODE (mutated by Kafka simulation) ───────────────────
const liveScoreOverrides  = {};
const liveSignalOverrides = {};

// ── Repos (lazily required to avoid circular deps at boot) ───────────────────
let _customerRepo, _scoreRepo, _signalRepo;
function customerRepo() { return _customerRepo || (_customerRepo = require('../repositories/customerRepo')); }
function scoreRepo()    { return _scoreRepo    || (_scoreRepo    = require('../repositories/scoreRepo'));    }
function signalRepo()   { return _signalRepo   || (_signalRepo   = require('../repositories/signalRepo'));   }

// ── In-memory implementations (DEMO_MODE) ────────────────────────────────────

function inMemoryGetCustomers(filters = {}) {
    let list = [...CUSTOMERS];
    if (filters.segment)   list = list.filter(c => c.segment   === filters.segment);
    if (filters.risk_tier) list = list.filter(c => c.risk_tier === filters.risk_tier);
    if (filters.city)      list = list.filter(c => c.city      === filters.city);
    if (filters.archetype) list = list.filter(c => c.archetype === filters.archetype);
    if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(c =>
            c.full_name.toLowerCase().includes(q) ||
            c.customer_id.toLowerCase().includes(q) ||
            (c.employer || '').toLowerCase().includes(q) ||
            (c.city     || '').toLowerCase().includes(q));
    }
    if (filters.sort === 'score_desc') list.sort((a, b) => b.churn_score - a.churn_score);
    if (filters.sort === 'score_asc')  list.sort((a, b) => a.churn_score - b.churn_score);
    if (filters.sort === 'name')       list.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return list;
}

function inMemoryGetScore(id) {
    const base = SCORES_MAP[id];
    if (!base) return null;
    return { ...base, ...(liveScoreOverrides[id] || {}) };
}

function inMemoryGetScores() {
    return SCORES.map(s => ({ ...s, ...(liveScoreOverrides[s.customer_id] || {}) }));
}

function inMemoryGetSignals(id) {
    const base  = SIGNALS_MAP[id]?.signals || [];
    const extra = liveSignalOverrides[id]  || [];
    return [...base, ...extra];
}

function inMemoryGetAllSignals() {
    return SIGNALS.map(s => ({
        customer_id: s.customer_id,
        alarm_count: s.alarm_count,
        signals: [...s.signals, ...(liveSignalOverrides[s.customer_id] || [])],
    }));
}

// ── Async facade functions ────────────────────────────────────────────────────

async function getCustomers(filters = {}, pagination = {}) {
    if (DEMO) {
        const list  = inMemoryGetCustomers(filters);
        const page  = Math.max(1, parseInt(pagination.page  || '1'));
        const limit = Math.min(parseInt(pagination.limit || '100'), 200);
        return { rows: list.slice((page - 1) * limit, page * limit), total: list.length, page, limit };
    }
    return customerRepo().getCustomers(filters, pagination);
}

async function getCustomerById(id) {
    if (DEMO) return CUSTOMERS_MAP[id] || null;
    return customerRepo().getCustomerById(id);
}

async function getCustomerSnapshot(id) {
    if (DEMO) {
        const customer = CUSTOMERS_MAP[id];
        if (!customer) return null;
        return {
            customer,
            score:    inMemoryGetScore(id),
            signals:  inMemoryGetSignals(id),
            plan:     PLANS_MAP[id]  || null,
            survival: SURVIVAL_MAP[id] || null,
            herald:   HERALD_MAP[id] || null,
        };
    }
    return customerRepo().getCustomerSnapshot(id);
}

async function getScore(id) {
    if (DEMO) return inMemoryGetScore(id);
    return scoreRepo().getScore(id);
}

async function getScores(filters, pagination) {
    if (DEMO) {
        const list  = inMemoryGetScores();
        const page  = Math.max(1, parseInt((pagination || {}).page  || '1'));
        const limit = Math.min(parseInt((pagination || {}).limit || '50'), 500);
        return { rows: list.slice((page - 1) * limit, page * limit), total: list.length, page, limit };
    }
    return scoreRepo().getScores(filters, pagination);
}

async function getSignals(id) {
    if (DEMO) return inMemoryGetSignals(id);
    return signalRepo().getSignals(id);
}

async function getAllSignals(pagination) {
    if (DEMO) return { rows: inMemoryGetAllSignals(), total: SIGNALS.length, page: 1, limit: SIGNALS.length };
    return signalRepo().getAllSignals(pagination);
}

async function getTransactions(id, limit = 60) {
    const all = TRANSACTIONS_MAP[id]?.transactions || [];
    return all.slice(-limit);
}

async function getSurvival(id) { return SURVIVAL_MAP[id] || null; }
async function getActionPlan(id) { return PLANS_MAP[id] || null; }
async function getActionPlans() { return ACTION_PLANS; }
async function getHerald(id) { return HERALD_MAP[id] || null; }
async function getHeraldAll() { return HERALD; }

async function getPortfolio() { return PORTFOLIO; }
async function getPortfolioSummary() { return PORTFOLIO.summary || {}; }

// ── Live state mutators (DEMO_MODE only; prod uses scoreRepo.applyScoreOverride) ──

function applyScoreOverride(customerId, delta) {
    liveScoreOverrides[customerId] = {
        ...(liveScoreOverrides[customerId] || {}),
        ...delta,
        _live_updated_at: new Date().toISOString(),
    };
    // Cap at 500 entries to prevent unbounded growth
    const keys = Object.keys(liveScoreOverrides);
    if (keys.length > 500) delete liveScoreOverrides[keys[0]];
}

function applySignalOverride(customerId, signal) {
    if (!liveSignalOverrides[customerId]) liveSignalOverrides[customerId] = [];
    const idx = liveSignalOverrides[customerId].findIndex(s => s.signal_type === signal.signal_type);
    if (idx >= 0) liveSignalOverrides[customerId][idx] = signal;
    else liveSignalOverrides[customerId].push(signal);
    // Cap entries per customer at 20
    if (liveSignalOverrides[customerId].length > 20)
        liveSignalOverrides[customerId] = liveSignalOverrides[customerId].slice(-20);
}

// ──────────────────────────────────────────────────────────────────────────
// Admin extension block — file-backed collections + user mutators
// used by the admin portal (server/routes/admin.js).  Reuses the
// DATA_DIR constant declared at the top of this file.
// ──────────────────────────────────────────────────────────────────────────

function _readJsonFile(name, fallback) {
    try {
        const raw = fs.readFileSync(path.join(DATA_DIR, name), 'utf8');
        return JSON.parse(raw);
    } catch (e) { return fallback; }
}
function _writeJsonFile(name, data) {
    try {
        fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) { return false; }
}

// Synchronous accessor: returns the in-memory CUSTOMERS array.
function getAllCustomers() { return CUSTOMERS; }

// File-backed admin helpers (read-mostly — written via admin routes
// only; safe in DEMO_MODE since the orchestrator process is single-
// threaded and we never write from concurrent requests).
function getAllOutcomes()    { return _readJsonFile('outcomes.json', []); }
function getAllCalls()       { return _readJsonFile('calls.json', []); }
function getAllTasks()       { return _readJsonFile('tasks.json', []); }
function getAllConsents()    {
    const raw = _readJsonFile('consents.json', []);
    return raw.reduce((acc, c) => { acc[c.customer_id] = c; return acc; }, {});
}

// User mutators (in-memory; persists for the process lifetime).
// In production these would write to the users table; in DEMO_MODE
// we keep the change visible without restarting the server.
const _extraUsers = []; // new users created via /api/admin/users
const _roleOverrides = {}; // username -> new role

function listUsers() {
    // Merge the static USERS table (exported by auth.js) with any
    // runtime additions.  We import it lazily to avoid a require cycle.
    const { USERS } = require('../routes/auth');
    const out = USERS.map(u => ({ ...u, password: undefined, active: true }));
    for (const u of _extraUsers) out.push({ ...u, active: true });
    for (const [username, role] of Object.entries(_roleOverrides)) {
        const row = out.find(u => u.username === username);
        if (row) row.role = role;
    }
    return out;
}
function addUser({ username, name, role, password_hash }) {
    if (_extraUsers.find(u => u.username === username)) {
        return { ok: false, error: 'username already exists' };
    }
    const id = 1000 + _extraUsers.length + 1;
    const user = { id, username, name: name || username, role: role || 'rm', password: password_hash, password_plain: null };
    _extraUsers.push(user);
    return { ok: true, user };
}
function updateUserRole(username, role) {
    if (!['admin','manager','risk','rm','analyst'].includes(role)) {
        return { ok: false, error: 'invalid role' };
    }
    _roleOverrides[username] = role;
    return { ok: true, username, role };
}

// Reviews: lives in routes/reviews.js in-memory.  We expose getters
// + a mutator so the admin portal can list/resolve.
function getReviews() { return _readJsonFile('reviews.json', null); }
function saveReviews(list) { return _writeJsonFile('reviews.json', list); }
function resolveReview(reviewId, patch) {
    let reviews = getReviews();
    if (!reviews) return null; // reviews still in-memory only (legacy behaviour)
    const idx = reviews.findIndex(r => r.id === reviewId);
    if (idx === -1) return null;
    reviews[idx] = { ...reviews[idx], ...patch, id: reviews[idx].id };
    saveReviews(reviews);
    return reviews[idx];
}

// Reports — file-backed, append-only.
function getReports()    { return _readJsonFile('reports.json', []); }
function saveReport(r)  {
    const list = getReports();
    list.push(r);
    return _writeJsonFile('reports.json', list);
}

module.exports = {
    // Static data (synchronous — used at module-load time by routes)
    CUSTOMERS, SCORES, SIGNALS, TRANSACTIONS, SURVIVAL,
    ACTION_PLANS, HERALD, PORTFOLIO,
    CUSTOMERS_MAP, SCORES_MAP, SIGNALS_MAP, PLANS_MAP, HERALD_MAP,
    CUSTOMER_IDS, CHURN_SCORES, LIFE_EVENTS,

    // Async facade
    getCustomers, getCustomerById, getCustomerSnapshot,
    getScore, getScores,
    getSignals, getAllSignals,
    getTransactions, getSurvival,
    getActionPlan, getActionPlans,
    getHerald, getHeraldAll,
    getPortfolio, getPortfolioSummary,

    // Mutators
    applyScoreOverride, applySignalOverride,

    // Admin extensions
    getAllCustomers, getAllOutcomes, getAllCalls, getAllTasks, getAllConsents,
    listUsers, addUser, updateUserRole,
    getReviews, saveReviews, resolveReview,
    getReports, saveReport,
};
