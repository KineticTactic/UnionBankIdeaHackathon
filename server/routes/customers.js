const router = require('express').Router();
const demoServerClient = require('../services/demoServerClient');
const { verifyToken } = require('../middleware/auth');
const dataStore = require('../services/dataStore');
const chronos = require('../services/chronosClient');

router.get('/', verifyToken, async (req, res, next) => {
    try {
        const { segment, risk_tier, city, search, page = 1, limit = 20 } = req.query;
        const filters = {};
        if (segment) filters.segment = segment;
        if (risk_tier) filters.risk_tier = risk_tier;
        if (city) filters.city = city;

        const customersData = await demoServerClient.getCustomers(filters);
        let results = customersData.data || [];

        if (search) {
            const q = search.toLowerCase();
            results = results.filter(c =>
                c.full_name.toLowerCase().includes(q) ||
                c.customer_id.toLowerCase().includes(q)
            );
        }

        const { CHURN_SCORES, SIGNALS, LIFE_EVENTS } = dataStore;
        let chronosMap = {};
        try {
            const chronosData = await chronos.getScores({ page_size: 100 });
            for (const c of (chronosData.customers || [])) {
                if (!chronosMap[c.customer_id]) {
                    chronosMap[c.customer_id] = { churn_score: c.final_score, risk_tier: c.risk_tier, reason_codes: (c.reason_codes_v2 || []).map(r => r.description) };
                }
            }
        } catch (_) { /* fall through to static dataStore */ }

        results = results.map(customer => {
            const cs = chronosMap[customer.customer_id] || CHURN_SCORES[customer.customer_id] || {};
            return {
                ...customer,
                churn_score: cs.churn_score ?? customer.churn_score,
                risk_tier: cs.risk_tier || customer.risk_tier,
                reason_codes: cs.reason_codes || [],
                active_signals: SIGNALS.filter(s => s.customer_id === customer.customer_id && s.detected).map(s => s.signal_type),
                life_events: LIFE_EVENTS.filter(e => e.customer_id === customer.customer_id).map(e => e.event_type)
            };
        });

        const total = results.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({
            status: 'ok',
            data: paginated,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', verifyToken, async (req, res, next) => {
    try {
        const body = await demoServerClient.getCustomerById(req.params.id);
        const snapshot = body.data;
        if (!snapshot || !snapshot.customer) {
            return res.status(404).json({ status: 'error', message: 'Customer not found' });
        }

        const { CHURN_SCORES, SIGNALS, LIFE_EVENTS, getScoreHistory } = dataStore;
        const customer = snapshot.customer;

        let chronosScore = null;
        try {
            chronosScore = await chronos.getScore(customer.customer_id);
        } catch (_) { /* fall through */ }

        const enrichedCustomer = {
            ...customer,
            churn_score: chronosScore?.final_score ?? CHURN_SCORES[customer.customer_id]?.churn_score ?? customer.churn_score,
            risk_tier: chronosScore?.risk_tier ?? CHURN_SCORES[customer.customer_id]?.risk_tier ?? customer.risk_tier,
            reason_codes: (chronosScore?.reason_codes_v2 || []).map(r => r.description) || CHURN_SCORES[customer.customer_id]?.reason_codes || [],
            active_signals: SIGNALS.filter(s => s.customer_id === customer.customer_id && s.detected).map(s => s.signal_type),
            life_events: LIFE_EVENTS.filter(e => e.customer_id === customer.customer_id).map(e => e.event_type)
        };

        const scoreHistory = getScoreHistory(customer.customer_id, 90);

        const customerSignals = SIGNALS.filter(s => s.customer_id === customer.customer_id);
        const customerLifeEvents = LIFE_EVENTS.filter(e => e.customer_id === customer.customer_id);

        res.json({
            status: 'ok',
            data: {
                customer: enrichedCustomer,
                accounts: snapshot.accounts || [],
                score_history: scoreHistory,
                active_signal_details: customerSignals.filter(s => s.detected),
                life_event_details: customerLifeEvents,
                engagement: snapshot.engagement_summary || {},
                crm_summary: snapshot.crm_summary || {},
                top_mccs: snapshot.latest_card_mccs || []
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/signals', verifyToken, async (req, res, next) => {
    try {
        const { SIGNALS } = dataStore;
        const signals = SIGNALS.filter(s => s.customer_id === req.params.id);

        if (signals.length === 0) {
            const body = await demoServerClient.getCustomerById(req.params.id);
            if (!body.data?.customer) {
                return res.status(404).json({ status: 'error', message: 'Customer not found' });
            }
            const customerSignals = (body.data.customer.active_signals || []).map(sig => ({
                signal_type: sig,
                confidence: 0.85 + Math.random() * 0.1,
                evidence: ['Detected pattern matching risk profile', 'Recent activity deviation'],
                method_used: 'CUSUM / ML',
                detected: true
            }));
            return res.json({ status: 'ok', data: customerSignals });
        }

        res.json({ status: 'ok', data: signals });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/transactions', verifyToken, async (req, res, next) => {
    try {
        const { from, to, limit = 50 } = req.query;
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

router.get('/:id/insights', verifyToken, async (req, res, next) => {
    try {
        const id = req.params.id;
        const [engagement, crm, stress, location] = await Promise.all([
            demoServerClient.getAppEngagement(id),
            demoServerClient.getCrmSummary(id),
            demoServerClient.getStressIndicators(id),
            demoServerClient.getLocationSeries(id)
        ]);

        const { LIFE_EVENTS } = dataStore;
        const customerLifeEvents = LIFE_EVENTS.filter(e => e.customer_id === id);

        res.json({
            status: 'ok',
            data: {
                engagement: engagement.data,
                crm: crm.data,
                stress: stress.data,
                location: location.data,
                life_events: customerLifeEvents
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
