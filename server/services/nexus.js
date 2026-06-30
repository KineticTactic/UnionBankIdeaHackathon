'use strict';
/**
 * nexus.js — NEXUS demo recommendation engine (P1 of NEXUS_IMPLEMENTATION.md §13).
 *
 * Demo-side scoring service. Produces ranked, explainable cross-sell
 * recommendations for a customer using a TRANSPARENT heuristic that imitates
 * the trained GNN's peer-adoption logic:
 *
 *     fit(product) = w_segment · segment_affinity
 *                  + w_peer    · peer_adoption_rate     ("customers like you also hold X")
 *                  + w_event   · life_event_match
 *
 * peer_adoption_rate is the fraction of demographically-similar customers
 * (same segment, same-city weighted) who already hold the product — this is
 * the literal "signals of surrounding customers" idea, computable live from
 * the 50-customer book. The trained NEXUS-GNN (CHRONOS) is the credibility
 * backing; this service is what powers the live /admin/nexus demo and feeds
 * COMPASS. Each recommendation carries reason codes — never an unexplained pick.
 */

const fs   = require('fs');
const path = require('path');
const ds = require('./dataStore');
const { PRODUCT_CATALOG, PRODUCT_META, SEGMENT_AFFINITY } = require('./productCatalog');

const WEIGHTS = { segment: 0.35, peer: 0.45, event: 0.20 };

// ── Trained NEXUS-Baseline scores (batch-produced by CHRONOS) ─────────────────
// chronos/scripts/score_demo_customers.py writes this: real XGBoost propensities
// (trained on PKDD'99) for the 5 label-backed products, quantile-bridged onto the
// demo book. Loaded once; absence degrades gracefully to the pure heuristic.
let MODEL_SCORES = null;
try {
    const p = path.join(__dirname, '..', 'data', 'nexus_model_scores.json');
    if (fs.existsSync(p)) MODEL_SCORES = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch { MODEL_SCORES = null; }

const MODEL_META = MODEL_SCORES?._meta || null;
const MODEL_VERSION = MODEL_META?.model_version || null;

// Life-event → product affinity boosts (0..1 added pre-weight to the event term)
const LIFE_EVENT_BOOST = {
    JOB_CHANGE:        { HOME_LOAN: 0.8, CREDIT_CARD_PREMIUM: 0.5, DEMAT_ACCOUNT: 0.4 },
    SALARY_CHANGE:     { FIXED_DEPOSIT: 0.7, DEMAT_ACCOUNT: 0.6, CREDIT_CARD_PREMIUM: 0.5 },
    LIFE_MILESTONE:    { LIFE_INSURANCE: 0.8, HEALTH_INSURANCE: 0.7, HOME_LOAN: 0.6 },
    RELOCATION:        { HOME_LOAN: 0.9, CAR_LOAN: 0.6 },
    RETIREMENT:        { FIXED_DEPOSIT: 0.9, HEALTH_INSURANCE: 0.7, RECURRING_DEPOSIT: 0.5 },
    // Negative-context events: no cross-sell boost (handled further by eligibility)
    FINANCIAL_STRESS:  {},
    COMPLAINT_DRIVEN:  {},
    COMPETITOR_INQUIRY:{},
};

const LIFE_EVENT_LABEL = {
    JOB_CHANGE: 'job change', SALARY_CHANGE: 'salary increase', LIFE_MILESTONE: 'life milestone',
    RELOCATION: 'relocation', RETIREMENT: 'retirement',
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Peer set for a customer: same segment. Same-city peers are weighted double
 * so geographic clustering shows up in the adoption rate (and the reason code).
 */
function peerStats(customer, product) {
    const peers = ds.CUSTOMERS.filter(c =>
        c.customer_id !== customer.customer_id && c.segment === customer.segment);
    if (!peers.length) return { rate: 0, holders: 0, total: 0, cityHolders: 0, cityTotal: 0 };

    let wHold = 0, wTotal = 0, holders = 0, cityHolders = 0, cityTotal = 0;
    for (const p of peers) {
        const sameCity = p.city === customer.city;
        const weight   = sameCity ? 2 : 1;
        const holds    = (p.products || []).includes(product);
        wTotal += weight;
        if (holds) wHold += weight;
        if (holds) holders++;
        if (sameCity) { cityTotal++; if (holds) cityHolders++; }
    }
    return {
        rate: wTotal ? wHold / wTotal : 0,
        holders, total: peers.length,
        cityHolders, cityTotal,
    };
}

/**
 * Score every product the customer does NOT already hold, ranked by fit.
 * Returns the full ranked list with breakdown + reason codes.
 */
function scoreCustomer(customerOrId) {
    const customer = typeof customerOrId === 'string'
        ? ds.CUSTOMERS_MAP[customerOrId]
        : customerOrId;
    if (!customer) return null;

    const held = new Set(customer.products || []);
    const aff  = SEGMENT_AFFINITY[customer.segment] || SEGMENT_AFFINITY['Mass Market'];
    const event = customer.life_event;
    const eventBoost = LIFE_EVENT_BOOST[event] || {};

    const recs = PRODUCT_CATALOG
        .filter(p => !held.has(p))
        .map(product => {
            const segmentFit = aff[product] != null ? aff[product] : 0.05;
            const peers      = peerStats(customer, product);
            const eventFit   = eventBoost[product] || 0;

            const score = clamp(
                WEIGHTS.segment * segmentFit +
                WEIGHTS.peer    * peers.rate +
                WEIGHTS.event   * eventFit,
                0, 1);

            // Reason codes — most informative first
            const reason_codes = [];
            if (peers.holders > 0) {
                reason_codes.push({
                    feature: 'peer_adoption',
                    value: +peers.rate.toFixed(2),
                    direction: 'increases_fit',
                    detail: `${peers.holders} of ${peers.total} similar ${customer.segment} customers hold this`,
                });
            }
            if (peers.cityHolders > 0) {
                reason_codes.push({
                    feature: 'geo_cluster',
                    value: +(peers.cityTotal ? peers.cityHolders / peers.cityTotal : 0).toFixed(2),
                    direction: 'increases_fit',
                    detail: `${peers.cityHolders} hold it in ${customer.city}`,
                });
            }
            if (segmentFit >= 0.5) {
                reason_codes.push({
                    feature: 'segment_affinity',
                    value: +segmentFit.toFixed(2),
                    direction: 'increases_fit',
                    detail: `typical for the ${customer.segment} segment`,
                });
            }
            if (eventFit > 0) {
                reason_codes.push({
                    feature: 'life_event',
                    value: +eventFit.toFixed(2),
                    direction: 'increases_fit',
                    detail: `triggered by recent ${LIFE_EVENT_LABEL[event] || event}`,
                });
            }

            // ── Blend in the trained model score where we have one ──────────
            // The trained NEXUS-Baseline (XGBoost on PKDD'99) covers 5 label-backed
            // products; for those, the model propensity is the headline score and the
            // peer/segment reason codes become the explanation. Other catalog products
            // keep the transparent heuristic. Honest + best-of-both.
            const modelScore = MODEL_SCORES?.[customer.customer_id]?.scores?.[product];
            const hasModel   = typeof modelScore === 'number';
            const finalScore = hasModel ? modelScore : score;

            if (hasModel) {
                reason_codes.unshift({
                    feature: 'trained_model',
                    value: +modelScore.toFixed(2),
                    direction: 'increases_fit',
                    detail: `NEXUS-Baseline propensity ${(modelScore * 100).toFixed(0)}% (XGBoost, trained on PKDD'99)`,
                });
            }

            return {
                product,
                label: PRODUCT_META[product]?.label || product,
                category: PRODUCT_META[product]?.category,
                is_credit: !!PRODUCT_META[product]?.is_credit,
                score: +finalScore.toFixed(3),
                heuristic_score: +score.toFixed(3),
                model_score: hasModel ? +modelScore.toFixed(3) : null,
                breakdown: {
                    segment: +(WEIGHTS.segment * segmentFit).toFixed(3),
                    peer:    +(WEIGHTS.peer * peers.rate).toFixed(3),
                    event:   +(WEIGHTS.event * eventFit).toFixed(3),
                },
                peer_adoption: { holders: peers.holders, total: peers.total, rate: +peers.rate.toFixed(2) },
                reason_codes,
                source_model: hasModel ? 'nexus-baseline-pkdd99' : 'nexus-heuristic',
            };
        });

    recs.sort((a, b) => b.score - a.score);
    return {
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        segment: customer.segment,
        city: customer.city,
        churn_score: customer.churn_score,
        risk_tier: customer.risk_tier,
        life_event: customer.life_event,
        current_products: (customer.products || []).map(p => ({ product: p, label: PRODUCT_META[p]?.label || p, category: PRODUCT_META[p]?.category })),
        recommendations: recs,
        model_backed: !!MODEL_SCORES,
        model_version: MODEL_VERSION || 'nexus-demo-v1',
        scored_at: new Date().toISOString(),
    };
}

module.exports = { scoreCustomer, peerStats, WEIGHTS, MODEL_VERSION };
