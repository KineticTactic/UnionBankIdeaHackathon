'use strict';
/**
 * productCatalog.js — NEXUS product taxonomy + segment affinity priors.
 *
 * Single source of truth for the cross-sell catalog. Mirrors
 * L3_CHRONOS/ml/features/product_taxonomy.py (§2 of NEXUS_IMPLEMENTATION.md).
 * Used by:
 *   - scripts/backfill_holdings.js  (P0 — seed demo customer holdings)
 *   - services/nexus.js             (P1 — peer-adoption recommendation scoring)
 *
 * Demo note: in production, holdings come from the core-banking system; here we
 * derive them deterministically from segment + product_count so the live demo
 * is stable across runs and peer-adoption fractions are meaningful.
 */

const PRODUCT_CATALOG = [
    'CREDIT_CARD_BASIC',
    'CREDIT_CARD_PREMIUM',
    'PERSONAL_LOAN',
    'HOME_LOAN',
    'CAR_LOAN',
    'FIXED_DEPOSIT',
    'RECURRING_DEPOSIT',
    'DEMAT_ACCOUNT',
    'LIFE_INSURANCE',
    'HEALTH_INSURANCE',
];

// Static per-product metadata (§4.2 product node features, plus display fields)
const PRODUCT_META = {
    CREDIT_CARD_BASIC:   { label: 'Basic Credit Card',   category: 'card',       is_credit: true,  is_secured: false, risk_tier: 2 },
    CREDIT_CARD_PREMIUM: { label: 'Premium Credit Card', category: 'card',       is_credit: true,  is_secured: false, risk_tier: 2 },
    PERSONAL_LOAN:       { label: 'Personal Loan',       category: 'loan',       is_credit: true,  is_secured: false, risk_tier: 3 },
    HOME_LOAN:           { label: 'Home Loan',           category: 'loan',       is_credit: true,  is_secured: true,  risk_tier: 1 },
    CAR_LOAN:            { label: 'Car Loan',            category: 'loan',       is_credit: true,  is_secured: true,  risk_tier: 2 },
    FIXED_DEPOSIT:       { label: 'Fixed Deposit',       category: 'deposit',    is_credit: false, is_secured: false, risk_tier: 0 },
    RECURRING_DEPOSIT:   { label: 'Recurring Deposit',   category: 'deposit',    is_credit: false, is_secured: false, risk_tier: 0 },
    DEMAT_ACCOUNT:       { label: 'Demat Account',       category: 'investment', is_credit: false, is_secured: false, risk_tier: 0 },
    LIFE_INSURANCE:      { label: 'Life Insurance',      category: 'insurance',  is_credit: false, is_secured: false, risk_tier: 0 },
    HEALTH_INSURANCE:    { label: 'Health Insurance',    category: 'insurance',  is_credit: false, is_secured: false, risk_tier: 0 },
};

// Probability a customer in this segment holds the product — drives both the
// seeded holdings backfill and the recommendation affinity term.
const SEGMENT_AFFINITY = {
    'HNW': {
        CREDIT_CARD_PREMIUM: 0.90, DEMAT_ACCOUNT: 0.80, FIXED_DEPOSIT: 0.70, LIFE_INSURANCE: 0.60,
        HOME_LOAN: 0.50, HEALTH_INSURANCE: 0.50, CAR_LOAN: 0.40, CREDIT_CARD_BASIC: 0.20,
        RECURRING_DEPOSIT: 0.20, PERSONAL_LOAN: 0.10,
    },
    'Mass Affluent': {
        CREDIT_CARD_BASIC: 0.70, FIXED_DEPOSIT: 0.60, CAR_LOAN: 0.50, LIFE_INSURANCE: 0.50,
        HEALTH_INSURANCE: 0.50, HOME_LOAN: 0.40, CREDIT_CARD_PREMIUM: 0.30, DEMAT_ACCOUNT: 0.30,
        RECURRING_DEPOSIT: 0.30, PERSONAL_LOAN: 0.20,
    },
    'SME': {
        CREDIT_CARD_BASIC: 0.70, RECURRING_DEPOSIT: 0.50, PERSONAL_LOAN: 0.50, HEALTH_INSURANCE: 0.50,
        FIXED_DEPOSIT: 0.40, CAR_LOAN: 0.40, LIFE_INSURANCE: 0.30, HOME_LOAN: 0.30,
        CREDIT_CARD_PREMIUM: 0.20, DEMAT_ACCOUNT: 0.20,
    },
    'Mass Market': {
        RECURRING_DEPOSIT: 0.60, CREDIT_CARD_BASIC: 0.50, PERSONAL_LOAN: 0.40, HEALTH_INSURANCE: 0.30,
        FIXED_DEPOSIT: 0.30, LIFE_INSURANCE: 0.20, CAR_LOAN: 0.20, HOME_LOAN: 0.10,
        CREDIT_CARD_PREMIUM: 0.05, DEMAT_ACCOUNT: 0.10,
    },
};

// ── Deterministic seeded RNG (mulberry32) ─────────────────────────────────────
function _hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function _mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Derive a customer's current product holdings deterministically.
 * Seeded by customer_id → stable across runs. Respects product_count,
 * weighted by segment affinity with per-customer jitter so within-segment
 * baskets vary (peer-adoption fractions become meaningful, not 0%/100%).
 */
function deriveHoldings(customer) {
    const aff = SEGMENT_AFFINITY[customer.segment] || SEGMENT_AFFINITY['Mass Market'];
    const rng = _mulberry32(_hashStr(customer.customer_id || customer.full_name || 'seed'));
    const n   = Math.max(1, Math.min(customer.product_count || 1, PRODUCT_CATALOG.length));

    const scored = PRODUCT_CATALOG.map(p => ({
        p,
        s: (aff[p] != null ? aff[p] : 0.05) * (0.5 + rng()),   // affinity × jitter
    }));
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, n).map(x => x.p);
}

module.exports = {
    PRODUCT_CATALOG,
    PRODUCT_META,
    SEGMENT_AFFINITY,
    deriveHoldings,
};
