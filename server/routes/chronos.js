const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const chronos = require('../services/chronosClient');

router.get('/scores', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.getScores(req.query);
        res.json(data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.get('/scores/:customerId', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.getScore(req.params.customerId);
        res.json(data);
    } catch (err) {
        if (err.response?.status === 404) return res.status(404).json({ status: 'error', message: `No CHRONOS score for ${req.params.customerId}` });
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.post('/scores/:customerId/analyze', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.analyzeScore(req.params.customerId);
        res.json(data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.get('/scores/:customerId/reason-codes', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.getReasonCodes(req.params.customerId);
        res.json(data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.get('/scores/:customerId/token-sequence', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.getTokenSequence(req.params.customerId, req.query);
        res.json(data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.get('/model-health', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.getModelHealth();
        res.json(data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.get('/model-health/scheduler', verifyToken, async (req, res, next) => {
    try {
        const data = await chronos.getSchedulerStatus();
        res.json(data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

router.get('/stats', verifyToken, async (req, res, next) => {
    try {
        const scoresData = await chronos.getScores({ page_size: 500 });
        const customers = scoresData.customers || [];
        const total = scoresData.total || customers.length;
        const tiers = { critical: 0, high: 0, medium: 0, low: 0 };
        customers.forEach(c => { if (tiers[c.risk_tier] !== undefined) tiers[c.risk_tier]++; });
        const avgScore = customers.length > 0
            ? customers.reduce((s, c) => s + c.final_score, 0) / customers.length : 0;
        res.json({
            status: 'ok',
            data: {
                total_customers_scored: total,
                tier_distribution: tiers,
                avg_churn_score: avgScore,
                last_scored_at: customers.length > 0 ? customers[0].scored_at : null,
                model_versions: [...new Set(customers.map(c => c.model_version))],
            },
        });
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        res.status(502).json({ status: 'error', message: 'CHRONOS service unavailable' });
    }
});

module.exports = router;
