'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ds = require('../services/dataStore');
const { isConfigured } = require('../services/llmClient');
const { generateRiskAssessment } = require('../services/callAnalysisService');

// Templated fallback — used when no LLM key is configured or the provider fails.
// Preserves the exact response contract the frontend has always expected.
function _templateAssessment(customer, score) {
    const riskTier  = score?.risk_tier || 'Medium';
    const churnP30  = score?.p30 != null ? `${Math.round(score.p30 * 100)}%` : 'N/A';
    const topSignal = customer._topSignal || 'no recent signals';

    return (
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
            : 'MEDIUM — schedule outreach within the next 5 business days to prevent further disengagement.'}`
    );
}

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

    // 1) Live LLM (Groq) risk narrative, grounded in the pre-computed facts.
    let analysis = null;
    let source   = 'demo';
    if (isConfigured()) {
        try {
            analysis = await generateRiskAssessment(customer, score, signals);
            source   = 'llm-live';
        } catch (err) {
            console.error(`[analysis] LLM failed for ${customer_id}: ${err.category || 'error'} (${err.status || 'n/a'}) — using template fallback`);
        }
    }

    // 2) Fall back to the templated demo assessment.
    if (!analysis) {
        await new Promise(r => setTimeout(r, 2000));
        const topSignal = (signals?.[0]?.signal_type || 'no recent signals').replace(/_/g, ' ');
        analysis = _templateAssessment({ ...customer, _topSignal: topSignal }, score);
    }

    res.json({ status: 'ok', analysis, source });
});

module.exports = router;
