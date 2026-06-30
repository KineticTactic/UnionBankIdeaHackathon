'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ds = require('../services/dataStore');

// GET /api/customers
router.get('/', verifyToken, async (req, res) => {
    const { segment, risk_tier, city, archetype, search, sort,
            page = 1, limit = 100 } = req.query;
    const filters    = { segment, risk_tier, city, archetype, search, sort };
    const pagination = { page, limit: Math.min(parseInt(limit), 200) };
    const result     = await ds.getCustomers(filters, pagination);
    // Normalise shape: rows comes from repo, list from legacy in-memory path
    const customers  = result.rows || result;
    const total      = result.total ?? customers.length;
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', total, page: result.page ?? parseInt(page), limit: result.limit ?? customers.length, customers });
});

// GET /api/customers/:id
router.get('/:id', verifyToken, async (req, res) => {
    const snap = await ds.getCustomerSnapshot(req.params.id);
    if (!snap) return res.status(404).json({ status: 'error', message: 'Customer not found' });
    res.json({ status: 'ok', ...snap });
});

// GET /api/customers/:id/signals
router.get('/:id/signals', verifyToken, async (req, res) => {
    // Customer may live in either the orchestrator store (CUST-001) or
    // the Bank API (C-00000001).  Soft-check both: if either returns
    // a record, return signals.  This lets the Signals tab work for
    // both ID formats.
    const inOrch = await ds.getCustomerById(req.params.id);
    if (!inOrch) {
        // Bank API quick-check (only one HTTP call, cheap)
        try {
            const http = require('http');
            const bankResp = await new Promise((resolve) => {
                const r = http.get({
                    host: '127.0.0.1', port: 3001,
                    path: `/api/customers/${encodeURIComponent(req.params.id)}/snapshot`,
                    timeout: 1500,
                }, (resp) => {
                    let body = ''; resp.on('data', (c) => body += c);
                    resp.on('end', () => resolve({ status: resp.statusCode, body }));
                });
                r.on('error',   () => resolve({ status: 0 }));
                r.on('timeout', () => { r.destroy(); resolve({ status: 0 }); });
            });
            if (bankResp.status !== 200) {
                return res.status(404).json({ status: 'error', message: 'Not found' });
            }
        } catch (_) {
            return res.status(404).json({ status: 'error', message: 'Not found' });
        }
    }

    // Prefer the most recent ARGUS evaluation when present — it's the
    // source of truth (9 HERALD agents, NEXUS+ORACLE+WARDEN, fresh
    // confidence/CUSUM values).  The legacy signals.json entries are
    // pre-seeded demo data and would otherwise clutter the live view.
    let signals = [];
    let wasReset = false;
    try {
        const argusRoute = require('./argus');
        if (argusRoute.isReset && argusRoute.isReset(req.params.id)) {
            // The user explicitly reset this customer — return an
            // empty list so the demo flow shows a clean "0 signals"
            // state instead of the pre-seeded demo data.
            wasReset = true;
        } else {
            const cached = argusRoute.getLastEvaluation && argusRoute.getLastEvaluation(req.params.id);
            if (cached && Array.isArray(cached.signals) && cached.signals.length) {
                signals = cached.signals;
            }
        }
    } catch (_) { /* argus module not mounted (tests, etc.) */ }

    // Fall back to the live signal overrides (ARGUS writes them) or
    // the static signals.json for a customer that hasn't been
    // evaluated yet.
    if (!signals.length && !wasReset) {
        signals = await ds.getSignals(req.params.id);
    }
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', customer_id: req.params.id, signals, alarm_count: signals.length });
});

// GET /api/customers/:id/transactions
router.get('/:id/transactions', verifyToken, async (req, res) => {
    if (!await ds.getCustomerById(req.params.id))
        return res.status(404).json({ status: 'error', message: 'Not found' });
    const txns = await ds.getTransactions(req.params.id, parseInt(req.query.limit) || 60);
    res.json({ status: 'ok', customer_id: req.params.id, transactions: txns, count: txns.length });
});

// GET /api/customers/:id/survival
router.get('/:id/survival', verifyToken, async (req, res) => {
    const data = await ds.getSurvival(req.params.id);
    if (!data) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', ...data });
});

// GET /api/customers/:id/score
router.get('/:id/score', verifyToken, async (req, res) => {
    const score = await ds.getScore(req.params.id);
    if (!score) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', ...score });
});

// GET /api/customers/:id/plan
router.get('/:id/plan', verifyToken, async (req, res) => {
    const plan = await ds.getActionPlan(req.params.id);
    if (!plan) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', ...plan });
});

// GET /api/customers/:id/herald
router.get('/:id/herald', verifyToken, async (req, res) => {
    const herald = await ds.getHerald(req.params.id);
    if (!herald) return res.status(404).json({ status: 'error', message: 'No content generated' });
    res.json({ status: 'ok', ...herald });
});

// POST /api/customers — stub
router.post('/', verifyToken, (req, res) => {
    const body = req.body || {};
    if (!body.full_name) return res.status(400).json({ status: 'error', message: 'full_name is required' });
    const now         = Date.now();
    const customer_id = `CUST-NEW-${now.toString(36).toUpperCase()}`;
    res.status(201).json({ status: 'ok', data: {
        customer_id, full_name: body.full_name, first_name: body.full_name.split(' ')[0],
        age: body.age || 30, income: 500000, tenure_months: Math.round((body.tenure_years || 0) * 12),
        segment: body.segment || 'Mass Market', archetype: 'healthy_active', city: body.city || 'Mumbai',
        product_count: 1, employer: body.employer_name || '', relationship_manager: 'System',
        preferred_channel: body.preferred_channel || 'email', email_opt_in: body.email_opt_in ?? true,
        sms_opt_in: body.sms_opt_in ?? true, txn_freq_90d: 0, avg_txn_amount: 0, inactivity_days: 0,
        digital_ratio: 0.5, complaint_count: 0, atm_withdrawals_90d: 0, app_logins_30d: 0,
        balance: 10000, salary_credit_count: 0, nps: 7, risk_tier: 'MONITOR', churn_score: 0.15,
        life_event: null, life_event_desc: null,
    }});
});

module.exports = router;
