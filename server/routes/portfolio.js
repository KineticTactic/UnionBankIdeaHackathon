'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ds = require('../services/dataStore');

router.get('/summary', verifyToken, async (req, res) => {
    res.json({ status: 'ok', data: await ds.getPortfolioSummary() });
});

router.get('/tier-distribution', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.tier_distribution || [] });
});

router.get('/churn-trend', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.churn_trend || [] });
});

router.get('/signal-breakdown', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.signal_breakdown || [] });
});

router.get('/top-at-risk', verifyToken, async (req, res) => {
    const port  = await ds.getPortfolio();
    const limit = parseInt(req.query.limit) || 10;
    res.json({ status: 'ok', data: (port.top_at_risk || []).slice(0, limit) });
});

router.get('/model-health', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.model_health || {} });
});

router.get('/uplift', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.uplift_stats || {} });
});

router.get('/bandit', verifyToken, async (req, res) => {
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.bandit_state || {} });
});

router.get('/full', verifyToken, async (req, res) => {
    res.json({ status: 'ok', data: await ds.getPortfolio() });
});

// GET /api/portfolio/stats — aggregate churn stats
router.get('/stats', verifyToken, async (req, res) => {
    const config = require('../config');
    if (!config.demoMode) {
        try {
            const { getPortfolioAggregates } = require('../repositories/scoreRepo');
            const cached = await getPortfolioAggregates();
            if (cached) return res.json({ status: 'ok', data: cached });
        } catch (_) {}
    }
    const port = await ds.getPortfolio();
    res.json({ status: 'ok', data: port.summary || {} });
});

module.exports = router;
