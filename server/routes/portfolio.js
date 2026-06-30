'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const config = require('../config');
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
    const limit = parseInt(req.query.limit) || 10;

    // Live, override-aware top-N — in DEMO mode we compute from the
    // current in-memory customer list so that score/signal overrides
    // applied via /api/kafka/publish (e.g. from the live-event
    // simulator) actually move customers into and out of the top
    // list.  In prod the static portfolio.json top_at_risk is the
    // source of truth.
    if (config.demoMode) {
        try {
            const kafka = require('../services/kafkaService');
            const { rows } = await ds.getCustomers({}, { page: 1, limit: 1000 });
            // Fetch every live score concurrently — getScore is async
            // and reflects the in-memory override set by the Kafka
            // service.  Promise.all keeps the route fast even for
            // 1000 customers.
            const liveScores = await Promise.all(
                rows.map(c => ds.getScore(c.customer_id).catch(() => null))
            );
            const scored = rows.map((c, i) => {
                const liveScore  = liveScores[i];
                const finalScore = (liveScore && liveScore.final_score != null)
                                 ? liveScore.final_score
                                 : (c.churn_score != null ? c.churn_score : 0);
                const liveSignals = kafka.getLiveSignalCount(c.customer_id);
                return {
                    customer_id: c.customer_id,
                    full_name:   c.full_name,
                    segment:     c.segment,
                    churn_score: finalScore,
                    risk_tier:   (liveScore && liveScore.risk_tier) || c.risk_tier,
                    city:        c.city,
                    alarm_count: (c.alarm_count || 0) + liveSignals,
                };
            });
            scored.sort((a, b) => (b.churn_score || 0) - (a.churn_score || 0));
            return res.json({ status: 'ok', data: scored.slice(0, limit) });
        } catch (e) {
            console.error('[top-at-risk] live override failed, falling back to static:', e.message);
        }
    }

    const port = await ds.getPortfolio();
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
