const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const localData = require('../services/localData');

router.get('/stats', verifyToken, (req, res, next) => {
    try {
        res.json(localData.getPortfolioStats());
    } catch (e) { next(e); }
});

router.get('/risk-distribution', verifyToken, (req, res, next) => {
    try {
        const { data: customers } = localData.getCustomers();
        const counts = { critical: 0, high: 0, medium: 0, watch: 0, low: 0 };
        customers.forEach(c => { if (counts[c.risk_tier] !== undefined) counts[c.risk_tier]++; });
        const total = customers.length;
        const distribution = Object.entries(counts).map(([tier, count]) => ({
            tier, count,
            percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
        }));
        res.json({ status: 'ok', data: distribution });
    } catch (e) { next(e); }
});

router.get('/churn-trend', verifyToken, (req, res, next) => {
    try {
        const weeks = parseInt(req.query.weeks) || 12;
        const { data: statsData } = localData.getPortfolioStats();
        const baseAvg = statsData.avg_churn_score || 0.55;
        const trend = [];
        for (let i = weeks; i >= 1; i--) {
            const date = new Date();
            date.setDate(date.getDate() - (i * 7));
            // deterministic variance seeded on week index so it doesn't change on refresh
            const seed = Math.sin(i * 47.3) * 0.05;
            trend.push({
                week: `W${weeks - i + 1}`,
                date: date.toISOString().split('T')[0],
                avg_score: Math.max(0.2, Math.min(0.9, baseAvg + seed)),
            });
        }
        res.json({ status: 'ok', data: trend });
    } catch (e) { next(e); }
});

router.get('/signal-breakdown', verifyToken, (req, res, next) => {
    try {
        const { SIGNALS } = require('../services/dataStore');
        const counts = {};
        SIGNALS.filter(s => s.detected).forEach(s => {
            const label = s.signal_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            counts[label] = (counts[label] || 0) + 1;
        });
        const breakdown = Object.entries(counts)
            .map(([signal_type, count]) => ({ signal_type, count }))
            .sort((a, b) => b.count - a.count);
        res.json({ status: 'ok', data: breakdown });
    } catch (e) { next(e); }
});

router.get('/top-at-risk', verifyToken, (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const { data: customers } = localData.getCustomers();
        const sorted = [...customers].sort((a, b) => b.churn_score - a.churn_score).slice(0, limit);
        const result = sorted.map(c => ({
            id: c.customer_id,
            full_name: c.full_name,
            segment: c.segment,
            city: c.city,
            churn_score: c.churn_score,
            risk_tier: c.risk_tier,
            active_signals: c.active_signals || [],
            recommended_action: c.recommended_action || 'Review Account',
        }));
        res.json({ status: 'ok', data: result });
    } catch (e) { next(e); }
});

router.get('/market-signals', verifyToken, (req, res, next) => {
    try {
        res.json(localData.getMarketSignals());
    } catch (e) { next(e); }
});

module.exports = router;
