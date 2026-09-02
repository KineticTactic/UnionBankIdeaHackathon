'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ds = require('../services/dataStore');

// POST /api/analysis/analyze
router.post('/analyze', verifyToken, async (req, res) => {
    const { customer_id } = req.body;
    if (!customer_id)
        return res.status(400).json({
            error: true, stage: 0, stage_name: 'orchestrator',
            message: 'customer_id required',
        });

    const snap = await ds.getCustomerSnapshot(customer_id);
    if (!snap) return res.status(404).json({
        error: true, stage: 0, stage_name: 'orchestrator',
        message: `Customer ${customer_id} not found`,
    });

    const { customer, score, signals } = snap;
    const riskTier  = score?.risk_tier || 'Medium';
    const churnP30  = score?.p30 != null ? `${Math.round(score.p30 * 100)}%` : 'N/A';
    const topSignal = signals?.[0]?.signal_type || 'no recent signals';

    const analysis =
        `**Risk Assessment — ${customer.full_name}**\n\n` +
        `**1. Key Churn Drivers**\n` +
        `${customer.full_name} (${customer.segment}, ${customer.tenure_months}-month tenure) shows a ${riskTier} churn risk ` +
        `with a 30-day churn probability of ${churnP30}. Primary driver: ${topSignal}. ` +
        `Account inactivity of ${customer.inactivity_days} days and ${customer.complaint_count} logged complaint(s) ` +
        `are compounding the risk. Current balance of ₹${(customer.balance || 0).toLocaleString('en-IN')} ` +
        `suggests limited recent transactional engagement.\n\n` +
        `**2. Recommended Intervention**\n` +
        `Assign a dedicated RM touchpoint within 48 hours. Offer a personalised product review ` +
        `(${customer.life_event ? `aligned to the recent life event: ${customer.life_event}` : 'focused on portfolio optimisation'}). ` +
        `Consider a fee-waiver or loyalty reward to re-engage the account.\n\n` +
        `**3. Urgency**\n` +
        `${riskTier === 'High' || riskTier === 'Critical'
            ? 'HIGH — escalate to senior RM immediately; risk of silent attrition within 30 days.'
            : 'MEDIUM — schedule outreach within the next 5 business days to prevent further disengagement.'}`;

    await new Promise(r => setTimeout(r, 2000));
    res.json({ status: 'ok', analysis, source: 'demo' });
});

module.exports = router;
