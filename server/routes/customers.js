const router = require('express').Router();
const demoServerClient = require('../services/demoServerClient');

router.get('/', async (req, res, next) => {
    try {
        const { segment, risk_tier, city, search, page = 1, limit = 20 } = req.query;
        const filters = {};
        if (segment) filters.segment = segment;
        if (risk_tier) filters.risk_tier = risk_tier;
        if (city) filters.city = city;

        const customersData = await demoServerClient.getCustomers(filters);
        let results = customersData.data || [];

        // Client-side search mock on full_name and id
        if (search) {
            const q = search.toLowerCase();
            results = results.filter(c =>
                c.full_name.toLowerCase().includes(q) ||
                c.customer_id.toLowerCase().includes(q)
            );
        }

        const total = results.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({
            data: paginated,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    console.log("Hiii")
    try {
        const body = await demoServerClient.getCustomerById(req.params.id);
        const snapshot = body.data;
        if (!snapshot || !snapshot.customer) {
            return res.status(404).json({ status: 'error', message: 'Customer not found' });
        }
        res.json(snapshot);
    } catch (error) {
        next(error);
    }
});

router.get('/:id/signals', async (req, res, next) => {
    try {
        const body = await demoServerClient.getCustomerById(req.params.id);
        const snapshot = body.data;
        if (!snapshot || !snapshot.customer) {
            return res.status(404).json({ status: 'error', message: 'Customer not found' });
        }

        // Create mock signal objects from the customer active_signals string array
        const signals = (snapshot.customer.active_signals || []).map(sig => ({
            signal_type: sig,
            confidence: 0.85 + Math.random() * 0.1,
            evidence: ['Detected pattern matching risk profile', 'Recent activity deviation'],
            method_used: 'CUSUM / ML'
        }));

        res.json(signals);
    } catch (error) {
        next(error);
    }
});

router.get('/:id/transactions', async (req, res, next) => {
    try {
        const { from, to, limit = 50 } = req.query;
        // For raw transactions, we query demoServerClient's client directly since we didn't expose raw txns helper
        const params = new URLSearchParams({ customer_id: req.params.id });
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        params.append('limit', limit);

        const resp = await demoServerClient.client.get(`/api/core-banking/transactions?${params.toString()}`);
        res.json(resp.data);
    } catch (error) {
        next(error);
    }
});

router.get('/:id/insights', async (req, res, next) => {
    try {
        const id = req.params.id;
        const [engagement, crm, stress, location] = await Promise.all([
            demoServerClient.getAppEngagement(id),
            demoServerClient.getCrmSummary(id),
            demoServerClient.getStressIndicators(id),
            demoServerClient.getLocationSeries(id)
        ]);

        res.json({
            engagement: engagement.data,
            crm: crm.data,
            stress: stress.data,
            location: location.data
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
