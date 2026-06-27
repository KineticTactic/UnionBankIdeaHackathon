'use strict';
const demoServerClient = require('./demoServerClient');
const config = require('../config');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runAnalysis(customerId) {
    const snapshotData = await demoServerClient.getCustomerById(customerId);
    if (!snapshotData || !snapshotData.customer) {
        throw new Error(`Customer ${customerId} not found`);
    }
    const customer = snapshotData.customer;

    // Simulate pipeline latency only in DEMO_MODE — in prod, CHRONOS scores are pre-computed
    if (config.demoMode) {
        await delay(800);   // fetching signals
        await delay(1200);  // CUSUM & BOCPD detection
        await delay(1500);  // scoring with XGBoost + Transformer
        await delay(1000);  // LangGraph orchestration
        await delay(600);   // generating action plan
    }

    let reason_codes = [];
    if (customer.risk_tier === 'critical') {
        reason_codes = ['Significant drop in engagement over 30 days', 'Recent high-stress lifecycle events detected', 'Unresolved CRM complaints affecting sentiment'];
    } else if (customer.risk_tier === 'high') {
        reason_codes = ['Salary drift detected', 'Decrease in account balance velocity', 'Recent competitor inquiry'];
    } else {
        reason_codes = ['Normal transaction patterns', 'Stable engagement', 'No negative CRM sentiment'];
    }

    const recommended_action = {
        channel:   customer.preferred_channel || 'email',
        offer_code: customer.recommended_action ? 'RET-24-SPECIAL' : 'RM-CONSULT',
        timing:    customer.recommended_action ? 'next_24_hours' : 'next_business_day',
        rationale: customer.recommended_action
            ? 'Customer prefers this channel and has high churn risk.'
            : 'Proactive outreach to ensure satisfaction.',
    };

    return {
        customer_id:      customer.customer_id,
        churn_score:      customer.churn_score,
        risk_tier:        customer.risk_tier,
        active_signals:   customer.active_signals || [],
        life_events:      (customer.life_events || []).map(event => ({ event_type: event, confidence: 0.95, evidence: ['Inferred from recent transaction patterns'] })),
        recommended_action,
        reason_codes,
        analysis_duration_ms: config.demoMode ? 5100 : 0,
        model_version:    'xgb-v2.1 + transformer-v1.4',
        scored_at:        new Date().toISOString(),
    };
}

module.exports = { runAnalysis };
