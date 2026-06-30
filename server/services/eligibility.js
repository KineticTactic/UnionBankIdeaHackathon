'use strict';
/**
 * eligibility.js — NEXUS eligibility / compliance filter (§9 of NEXUS_IMPLEMENTATION.md).
 *
 * The piece worth pitching as much as the recommender itself: it stops NEXUS
 * from "recommending debt to everyone" and ties into the project's RBI AI
 * Governance / DPDPA framing.
 *
 * Two gates, in order:
 *   1. CHURN DEFERRAL (the headline rule): if the customer is high churn-risk,
 *      suppress all new-credit cross-sell — retention messaging should win that
 *      customer, not cross-sell. The recommender actively defers to the
 *      retention model rather than working in isolation.
 *   2. PER-PRODUCT eligibility rules (utilization / tenure / complaints / value).
 *
 * Every suppressed recommendation carries a human-readable `filtered_reason`
 * for the audit log (mirrors how AEGIS/SENTINEL log gate decisions).
 */

const HIGH_RISK_TIERS = ['ESCALATE', 'PRIORITY'];
const PREMIUM_INCOME_THRESHOLD = 1_500_000;   // ₹/yr for premium card
const HOME_LOAN_MIN_TENURE_MONTHS = 6;        // ~180 days relationship

function isHighChurnRisk(customer) {
    return HIGH_RISK_TIERS.includes(customer.risk_tier) || (customer.churn_score || 0) >= 0.50;
}

/**
 * Per-product credit-risk rules. Return { ok: bool, reason?: string }.
 * Demo fields: complaint_count, tenure_months, income, balance.
 * (Production maps these to avg_utilization, decline_rate_30d, monetary_total, etc.)
 */
const RULES = {
    PERSONAL_LOAN: (c) =>
        c.complaint_count > 0
            ? { ok: false, reason: `open complaints (${c.complaint_count}) — unsecured lending gate` }
            : { ok: true },

    HOME_LOAN: (c) =>
        (c.tenure_months || 0) < HOME_LOAN_MIN_TENURE_MONTHS
            ? { ok: false, reason: `relationship tenure ${c.tenure_months}mo < ${HOME_LOAN_MIN_TENURE_MONTHS}mo minimum` }
            : { ok: true },

    CAR_LOAN: (c) =>
        (c.income || 0) < 300_000
            ? { ok: false, reason: `income below auto-loan affordability floor` }
            : { ok: true },

    CREDIT_CARD_PREMIUM: (c) => {
        if (c.complaint_count > 0) return { ok: false, reason: `open complaints (${c.complaint_count}) — premium card gate` };
        if ((c.income || 0) < PREMIUM_INCOME_THRESHOLD)
            return { ok: false, reason: `income ₹${(c.income / 100000).toFixed(1)}L below premium threshold ₹${(PREMIUM_INCOME_THRESHOLD / 100000)}L` };
        return { ok: true };
    },
    // CREDIT_CARD_BASIC, FIXED_DEPOSIT, RECURRING_DEPOSIT, DEMAT_ACCOUNT,
    // LIFE_INSURANCE, HEALTH_INSURANCE: no credit-risk gate → default eligible.
};

const NEW_CREDIT_DEFER_MSG = 'high churn-risk — retention takes priority over new-credit cross-sell';

/**
 * Filter a NEXUS scoreCustomer() result.
 * Returns the same shape with each rec tagged `eligible` + (if dropped)
 * `filtered_reason`, plus split `recommendations` / `suppressed` lists.
 */
function filterRecommendations(scored, customer) {
    const highRisk = isHighChurnRisk(customer);

    const eligible = [];
    const suppressed = [];

    for (const rec of scored.recommendations) {
        let ok = true;
        let reason = null;

        // Gate 1 — churn deferral (only blocks NEW CREDIT products)
        if (highRisk && rec.is_credit) {
            ok = false;
            reason = NEW_CREDIT_DEFER_MSG;
        }

        // Gate 2 — per-product rule
        if (ok && RULES[rec.product]) {
            const r = RULES[rec.product](customer);
            if (!r.ok) { ok = false; reason = r.reason; }
        }

        const tagged = { ...rec, eligible: ok, filtered_reason: ok ? null : reason };
        (ok ? eligible : suppressed).push(tagged);
    }

    return {
        ...scored,
        churn_deferral_active: highRisk,
        recommendations: eligible,
        suppressed,
        top_offer: eligible.length ? eligible[0] : null,   // what COMPASS would receive
    };
}

module.exports = { filterRecommendations, isHighChurnRisk };
