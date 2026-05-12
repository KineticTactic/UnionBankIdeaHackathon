const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const dataStore = require('../services/dataStore');

router.get('/', verifyToken, (req, res) => {
    const { outreachRecords } = dataStore;
    const { customer_id, campaign_id, channel, status, page = 1, limit = 20 } = req.query;

    let results = [...outreachRecords];

    if (customer_id) {
        results = results.filter(r => r.customer_id === customer_id);
    }
    if (campaign_id) {
        results = results.filter(r => r.campaign_id === campaign_id);
    }
    if (channel) {
        results = results.filter(r => r.channel === channel);
    }
    if (status) {
        results = results.filter(r => r.status === status);
    }

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
});

router.post('/', verifyToken, requireRole('manager', 'admin'), (req, res) => {
    const { customer_id, channel, message } = req.body;

    if (!customer_id || !channel) {
        return res.status(400).json({
            status: 'error',
            message: 'customer_id and channel are required'
        });
    }

    const { CHURN_SCORES, LIFE_EVENTS } = dataStore;
    const score = CHURN_SCORES[customer_id] || { churn_score: 0.5, risk_tier: 'medium', reason_codes: [] };

    const record = dataStore.addOutreachRecord({
        customer_id,
        campaign_id: null,
        channel,
        risk_tier: score.risk_tier,
        life_events: LIFE_EVENTS.filter(e => e.customer_id === customer_id).map(e => e.event_type),
        offer_code: `OFFER-MANUAL-${Math.floor(Math.random() * 1000)}`,
        content_version: 'v1.0',
        status: 'sent',
        holdout_group: false,
        body_preview: message || 'Manual outreach initiated',
        dispatched_by: req.user.username
    });

    res.json({
        status: 'ok',
        data: record
    });
});

router.get('/campaigns', verifyToken, (req, res) => {
    const { CAMPAIGNS, outreachRecords } = dataStore;

    const campaignsWithStats = CAMPAIGNS.map(campaign => {
        const campaignRecords = outreachRecords.filter(r => r.campaign_id === campaign.campaign_id);
        const sent = campaignRecords.length;
        const delivered = campaignRecords.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length;
        const opened = campaignRecords.filter(r => ['opened', 'clicked'].includes(r.status)).length;
        const clicked = campaignRecords.filter(r => r.status === 'clicked').length;

        const uplift = dataStore.UPLIFT_RESULTS.find(u => u.campaign_id === campaign.campaign_id);

        return {
            ...campaign,
            stats: {
                sent,
                delivered,
                delivered_rate: sent ? Math.round((delivered / sent) * 100) : 0,
                opened,
                open_rate: delivered ? Math.round((opened / delivered) * 100) : 0,
                converted: clicked,
                conversion_rate: opened ? Math.round((clicked / opened) * 10000) / 10000 : 0,
                uplift_pct: uplift ? Math.round(uplift.uplift_pct * 100) : 0
            }
        };
    });

    res.json({
        status: 'ok',
        data: campaignsWithStats
    });
});

router.get('/campaigns/list', verifyToken, (req, res) => {
    const { CAMPAIGNS, outreachRecords } = dataStore;

    const campaignsWithStats = CAMPAIGNS.map(campaign => {
        const campaignRecords = outreachRecords.filter(r => r.campaign_id === campaign.campaign_id);
        const sent = campaignRecords.length;
        const delivered = campaignRecords.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length;
        const opened = campaignRecords.filter(r => ['opened', 'clicked'].includes(r.status)).length;
        const clicked = campaignRecords.filter(r => r.status === 'clicked').length;

        const uplift = dataStore.UPLIFT_RESULTS.find(u => u.campaign_id === campaign.campaign_id);
        const treatmentRecords = campaignRecords.filter(r => !r.holdout_group);
        const holdoutRecords = campaignRecords.filter(r => r.holdout_group);
        const treatmentRetention = treatmentRecords.filter(r => r.status !== 'failed').length / (treatmentRecords.length || 1);
        const holdoutRetention = holdoutRecords.filter(r => r.status !== 'failed').length / (holdoutRecords.length || 1);

        return {
            ...campaign,
            stats: {
                sent,
                delivered,
                delivered_rate: sent ? Math.round((delivered / sent) * 100) : 0,
                opened,
                open_rate: delivered ? Math.round((opened / delivered) * 100) : 0,
                converted: clicked,
                conversion_rate: opened ? Math.round((clicked / opened) * 10000) / 10000 : 0,
                uplift_pct: uplift ? Math.round(uplift.uplift_pct * 100) : Math.round((treatmentRetention - holdoutRetention) * 100)
            }
        };
    });

    res.json({
        status: 'ok',
        data: campaignsWithStats
    });
});

router.get('/:id', verifyToken, (req, res) => {
    const { outreachRecords } = dataStore;
    const record = outreachRecords.find(r => r.outreach_id === parseInt(req.params.id));

    if (!record) {
        return res.status(404).json({
            status: 'error',
            message: 'Outreach record not found'
        });
    }

    res.json({
        status: 'ok',
        data: record
    });
});

module.exports = router;
