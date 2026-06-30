'use strict';
/**
 * routes/nexus.js — NEXUS cross-sell recommendation API (demo).
 *
 * Endpoints
 *   GET /api/nexus/overview          — portfolio cross-sell intelligence (KPIs, catalog adoption, top opportunities)
 *   GET /api/nexus/customer/:id      — per-customer ranked recommendations + eligibility + COMPASS offer
 *
 * Scoring: services/nexus.js (peer-adoption heuristic imitating the trained GNN).
 * Filtering: services/eligibility.js (compliance + churn deferral).
 * Every surfaced recommendation is audit-logged (DPDPA Rule 4 consistency).
 */

const express = require('express');
const router  = express.Router();

const path     = require('path');
const ds       = require('../services/dataStore');
const nexus    = require('../services/nexus');
const eligibility = require('../services/eligibility');
const auditLog = require('../services/auditLogService');
const { readJson, writeJson } = require('../utils/jsonStore');
const { PRODUCT_CATALOG, PRODUCT_META } = require('../services/productCatalog');

const HANDOFF_FILE = path.join(__dirname, '..', 'data', 'nexus_handoffs.json');

function buildRationale(rec, customer) {
    const bits = (rec.reason_codes || []).slice(0, 2).map(r => r.detail);
    return `Cross-sell fit ${Math.round(rec.score * 100)}% for ${rec.label}. ` +
           (bits.length ? bits.join('; ') + '.' : '') +
           ` Source: ${rec.source_model}.`;
}

// ── GET /api/nexus/customer/:id ───────────────────────────────────────────────
router.get('/customer/:id', async (req, res) => {
    try {
        const customer = ds.CUSTOMERS_MAP[req.params.id];
        if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

        const scored   = nexus.scoreCustomer(customer);
        const filtered = eligibility.filterRecommendations(scored, customer);

        auditLog.logEvent({
            eventType:  'NEXUS_RECOMMENDATIONS_SURFACED',
            customerId: customer.customer_id,
            actor:      req.user?.username || 'system',
            layer:      'CHRONOS',
            payload: {
                top_offer: filtered.top_offer?.product || null,
                eligible_count: filtered.recommendations.length,
                suppressed_count: filtered.suppressed.length,
                churn_deferral_active: filtered.churn_deferral_active,
            },
            modelVersion: 'nexus-demo-v1',
        }).catch(() => {});

        res.json({
            status: 'ok',
            ...filtered,
            disclaimer: 'Demo scoring uses a transparent peer-adoption heuristic imitating the NEXUS-GNN. Recommendations are advisory; eligibility and churn-deferral gates applied. COMPASS makes the final pitch decision.',
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ── GET /api/nexus/overview ───────────────────────────────────────────────────
router.get('/overview', (req, res) => {
    try {
        const customers = ds.CUSTOMERS;

        // Catalog adoption across the book
        const adoption = Object.fromEntries(PRODUCT_CATALOG.map(p => [p, 0]));
        for (const c of customers) (c.products || []).forEach(p => { if (adoption[p] != null) adoption[p]++; });

        // Score every customer once to build portfolio opportunity stats
        let totalEligible = 0, totalSuppressed = 0, deferralCustomers = 0;
        const opportunityByProduct = Object.fromEntries(PRODUCT_CATALOG.map(p => [p, { count: 0, scoreSum: 0 }]));
        const topOpportunities = [];

        for (const c of customers) {
            const filtered = eligibility.filterRecommendations(nexus.scoreCustomer(c), c);
            totalEligible   += filtered.recommendations.length;
            totalSuppressed += filtered.suppressed.length;
            if (filtered.churn_deferral_active) deferralCustomers++;

            const top = filtered.top_offer;
            if (top) {
                opportunityByProduct[top.product].count++;
                opportunityByProduct[top.product].scoreSum += top.score;
                topOpportunities.push({
                    customer_id: c.customer_id,
                    full_name: c.full_name,
                    segment: c.segment,
                    product: top.product,
                    label: top.label,
                    score: top.score,
                    rationale: top.reason_codes?.[0]?.detail || null,
                });
            }
        }

        topOpportunities.sort((a, b) => b.score - a.score);

        const productOpportunities = PRODUCT_CATALOG.map(p => ({
            product: p,
            label: PRODUCT_META[p]?.label || p,
            category: PRODUCT_META[p]?.category,
            held_by: adoption[p],
            held_pct: +((adoption[p] / customers.length) * 100).toFixed(0),
            top_offer_count: opportunityByProduct[p].count,
            avg_fit: opportunityByProduct[p].count
                ? +(opportunityByProduct[p].scoreSum / opportunityByProduct[p].count).toFixed(3)
                : 0,
        })).sort((a, b) => b.top_offer_count - a.top_offer_count);

        res.json({
            status: 'ok',
            summary: {
                customers: customers.length,
                catalog_size: PRODUCT_CATALOG.length,
                total_eligible_opportunities: totalEligible,
                total_suppressed: totalSuppressed,
                churn_deferral_customers: deferralCustomers,
                avg_opportunities_per_customer: +(totalEligible / customers.length).toFixed(1),
            },
            product_opportunities: productOpportunities,
            top_opportunities: topOpportunities.slice(0, 12),
            model_version: 'nexus-demo-v1',
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ── POST /api/nexus/send-to-compass/:id ───────────────────────────────────────
// Hand the top eligible cross-sell recommendation to COMPASS as an action plan.
// In production this writes the product_recommendations row that COMPASS's
// get_product_recommendations_tool reads; in the demo we materialize the COMPASS
// action plan (offer_code + offer_display) that DISPATCH → HERALD consume.
router.post('/send-to-compass/:id', (req, res) => {
    try {
        const customer = ds.CUSTOMERS_MAP[req.params.id];
        if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

        const filtered = eligibility.filterRecommendations(nexus.scoreCustomer(customer), customer);
        const top = filtered.top_offer;
        if (!top) {
            return res.json({
                status: 'ok', sent: false,
                reason: filtered.churn_deferral_active
                    ? 'All cross-sell suppressed — customer is high churn-risk (retention takes priority).'
                    : 'No eligible cross-sell product for this customer.',
            });
        }

        const actionPlan = {
            customer_id:      customer.customer_id,
            source:           'NEXUS',
            action:           'CROSS_SELL',
            offer_code:       `CROSS_SELL_${top.product}`,
            offer_display:    top.label,
            content_strategy: 'cross_sell',
            channel:          customer.preferred_channel || 'email',
            fit_score:        top.score,
            model:            top.source_model,
            model_version:    filtered.model_version,
            reason_codes:     top.reason_codes,
            rationale:        buildRationale(top, customer),
            churn_deferral_checked: true,
            created_at:       new Date().toISOString(),
        };

        // Persist (latest hand-off per customer)
        const store = readJson(HANDOFF_FILE, {}) || {};
        store[customer.customer_id] = actionPlan;
        writeJson(HANDOFF_FILE, store);

        auditLog.logEvent({
            eventType:  'NEXUS_HANDOFF_TO_COMPASS',
            customerId: customer.customer_id,
            actor:      req.user?.username || 'system',
            layer:      'COMPASS',
            payload:    { offer_code: actionPlan.offer_code, fit_score: top.score, model: top.source_model },
            modelVersion: filtered.model_version,
        }).catch(() => {});

        res.json({
            status: 'ok',
            sent: true,
            action_plan: actionPlan,
            compass_note: 'COMPASS will weigh this cross-sell against churn-retention before HERALD drafts the pitch.',
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ── GET /api/nexus/handoffs ───────────────────────────────────────────────────
router.get('/handoffs', (req, res) => {
    try { res.json({ status: 'ok', handoffs: readJson(HANDOFF_FILE, {}) || {} }); }
    catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── GET /api/nexus/graph ──────────────────────────────────────────────────────
// Bipartite recommendation graph: customer nodes + product nodes, holds-edges,
// and peer edges (top-K same-segment customers by product-overlap = the
// collaborative-filtering neighbourhood). Powers the graph visualization.
router.get('/graph', (req, res) => {
    try {
        const customers = ds.CUSTOMERS;

        // Product nodes with adoption
        const adoption = Object.fromEntries(PRODUCT_CATALOG.map(p => [p, 0]));
        for (const c of customers) (c.products || []).forEach(p => { if (adoption[p] != null) adoption[p]++; });
        const productNodes = PRODUCT_CATALOG.map(p => ({
            id: p,
            label: PRODUCT_META[p]?.label || p,
            category: PRODUCT_META[p]?.category,
            is_credit: !!PRODUCT_META[p]?.is_credit,
            adoption: adoption[p],
        }));

        // Customer nodes + holds edges
        const customerNodes = customers.map(c => ({
            id: c.customer_id,
            name: c.full_name,
            first_name: (c.full_name || '').split(' ')[0],
            segment: c.segment,
            city: c.city,
            churn_score: c.churn_score,
            risk_tier: c.risk_tier,
            products: c.products || [],
        }));

        const holdsEdges = [];
        for (const c of customers) (c.products || []).forEach(p => holdsEdges.push({ c: c.customer_id, p }));

        // Peer edges: top-3 same-segment customers by Jaccard product-overlap
        const peerEdges = [];
        const seen = new Set();
        for (const c of customers) {
            const cset = new Set(c.products || []);
            const peers = customers
                .filter(d => d.customer_id !== c.customer_id && d.segment === c.segment)
                .map(d => {
                    const dset = new Set(d.products || []);
                    const inter = [...cset].filter(x => dset.has(x)).length;
                    const uni = new Set([...cset, ...dset]).size || 1;
                    return { id: d.customer_id, sim: inter / uni };
                })
                .sort((a, b) => b.sim - a.sim)
                .slice(0, 3);
            for (const pe of peers) {
                const key = [c.customer_id, pe.id].sort().join('|');
                if (!seen.has(key) && pe.sim > 0) {
                    seen.add(key);
                    peerEdges.push({ a: c.customer_id, b: pe.id, sim: +pe.sim.toFixed(2) });
                }
            }
        }

        res.json({
            status: 'ok',
            products: productNodes,
            customers: customerNodes,
            holds_edges: holdsEdges,
            peer_edges: peerEdges,
            catalog: PRODUCT_CATALOG,
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

module.exports = router;
