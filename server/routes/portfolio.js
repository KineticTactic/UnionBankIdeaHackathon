const router = require('express').Router();
const demoServerClient = require('../services/demoServerClient');

router.get('/stats', async (req, res, next) => {
    try {
        const stats = await demoServerClient.getPortfolioStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

router.get('/risk-distribution', async (req, res, next) => {
    try {
        const customersData = await demoServerClient.getCustomers();
        const customers = customersData.data || [];
        const counts = { 'critical': 0, 'high': 0, 'medium': 0, 'watch': 0, 'low': 0 };

        customers.forEach(c => {
            if (counts[c.risk_tier] !== undefined) counts[c.risk_tier]++;
        });

        const total = customers.length;
        const distribution = Object.entries(counts).map(([tier, count]) => ({
            tier,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0
        }));

        res.json(distribution);
    } catch (error) {
        next(error);
    }
});

router.get('/churn-trend', async (req, res, next) => {
    try {
        const weeks = parseInt(req.query.weeks) || 12;
        const stats = await demoServerClient.getPortfolioStats();
        const baseAvg = stats.avg_churn_score || 0.5;

        // Simulate trend based on base average
        const trend = [];
        for (let i = weeks; i >= 1; i--) {
            // Add slight random variance
            const variance = (Math.random() * 0.1) - 0.05;
            trend.push({
                week: `W${i}`,
                avg_score: Math.max(0, Math.min(1, baseAvg + variance))
            });
        }

        res.json(trend.reverse());
    } catch (error) {
        next(error);
    }
});

router.get('/signal-breakdown', async (req, res, next) => {
    try {
        const customersData = await demoServerClient.getCustomers();
        const customers = customersData.data || [];
        const signalCounts = {};

        customers.forEach(c => {
            const signals = c.active_signals || [];
            signals.forEach(sig => {
                signalCounts[sig] = (signalCounts[sig] || 0) + 1;
            });
        });

        const breakdown = Object.entries(signalCounts).map(([signal_type, count]) => ({
            signal_type,
            count
        }));

        res.json(breakdown);
    } catch (error) {
        next(error);
    }
});

router.get('/top-at-risk', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const customersData = await demoServerClient.getCustomers();
        const customers = customersData.data || [];

        const sorted = customers.sort((a, b) => b.churn_score - a.churn_score).slice(0, limit);

        const result = sorted.map(c => ({
            id: c.customer_id,
            full_name: c.full_name,
            segment: c.segment,
            city: c.city,
            churn_score: c.churn_score,
            risk_tier: c.risk_tier,
            active_signals: c.active_signals || [],
            recommended_action: c.recommended_action || 'Review Account'
        }));

        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/market-signals', async (req, res, next) => {
    try {
        const signals = await demoServerClient.getMarketSignals();
        res.json(signals.data || []);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
