'use strict';
/**
 * /api/v2 — Precision Risk Engine (CHRONOS) endpoints
 * All list endpoints are paginated. Response shape is backward-compatible.
 */
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ds = require('../services/dataStore');

// GET /api/v2/scores
router.get('/scores', verifyToken, async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const result = await ds.getScores({}, { page, limit });
    const data   = result.rows || result;
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', data, count: result.total ?? data.length, page: result.page ?? 1, limit: result.limit ?? data.length });
});

// GET /api/v2/scores/:id
router.get('/scores/:id', verifyToken, async (req, res) => {
    const score = await ds.getScore(req.params.id);
    if (!score) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', data: score });
});

// GET /api/v2/signals
router.get('/signals', verifyToken, async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const result = await ds.getAllSignals({ page, limit });
    const data   = result.rows || result;
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', data, count: result.total ?? data.length, page: result.page ?? 1, limit: result.limit ?? data.length });
});

// GET /api/v2/signals/:id
router.get('/signals/:id', verifyToken, async (req, res) => {
    const signals = await ds.getSignals(req.params.id);
    res.json({ status: 'ok', customer_id: req.params.id, signals, alarm_count: signals.length });
});

// GET /api/v2/action-plans
router.get('/action-plans', verifyToken, async (req, res) => {
    const data = await ds.getActionPlans();
    const { page = 1, limit = 50 } = req.query;
    const p = parseInt(page), l = Math.min(parseInt(limit), 500);
    const paged = data.slice((p - 1) * l, p * l);
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', data: paged, count: data.length, page: p, limit: l });
});

// GET /api/v2/action-plans/:id
router.get('/action-plans/:id', verifyToken, async (req, res) => {
    const plan = await ds.getActionPlan(req.params.id);
    if (!plan) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: plan });
});

// GET /api/v2/content
router.get('/content', verifyToken, async (req, res) => {
    const data = await ds.getHeraldAll();
    const { page = 1, limit = 50 } = req.query;
    const p = parseInt(page), l = Math.min(parseInt(limit), 500);
    const paged = data.slice((p - 1) * l, p * l);
    res.set('Cache-Control', 'private, max-age=10');
    res.json({ status: 'ok', data: paged, count: data.length, page: p, limit: l });
});

// GET /api/v2/content/:id
router.get('/content/:id', verifyToken, async (req, res) => {
    const herald = await ds.getHerald(req.params.id);
    if (!herald) return res.status(404).json({ status: 'error', message: 'No content' });
    res.json({ status: 'ok', data: herald });
});

// GET /api/v2/model-health
router.get('/model-health', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.model_health || {} });
});

// GET /api/v2/portfolio-survival — precomputed in prod; computed on the fly in demo
router.get('/portfolio-survival', verifyToken, async (req, res) => {
    const config = require('../config');
    if (!config.demoMode) {
        try {
            const { getPortfolioAggregates } = require('../repositories/scoreRepo');
            const cached = await getPortfolioAggregates();
            if (cached) return res.json({ status: 'ok', data: cached });
        } catch (_) {}
    }
    const result  = await ds.getScores();
    const scores  = result.rows || result;
    const summary = {
        avg_p7:     +(scores.reduce((s, c) => s + (c.p7  || 0), 0) / (scores.length || 1)).toFixed(4),
        avg_p30:    +(scores.reduce((s, c) => s + (c.p30 || 0), 0) / (scores.length || 1)).toFixed(4),
        avg_p90:    +(scores.reduce((s, c) => s + (c.p90 || 0), 0) / (scores.length || 1)).toFixed(4),
        urgent_7d:  scores.filter(c => (c.p7  || 0) > 0.40).length,
        urgent_30d: scores.filter(c => (c.p30 || 0) > 0.40).length,
        urgent_90d: scores.filter(c => (c.p90 || 0) > 0.40).length,
    };
    res.json({ status: 'ok', data: summary });
});

module.exports = router;
