'use strict';
// Idempotent schema migration + seed. Safe to run on every boot; concurrent replicas are fine.
const path = require('path');
const fs   = require('fs');
const { pool, query } = require('./pool');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const DATA_DIR    = path.join(__dirname, '..', 'data');

function loadJson(file) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
    catch { return null; }
}

async function migrate() {
    // 1. Apply schema — idempotent thanks to IF NOT EXISTS
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await pool.query(schema);
    console.log('[migrate] schema applied');

    // 2. Seed only if tables are empty
    const countRes = await query('SELECT COUNT(*) FROM customers');
    if (parseInt(countRes.rows[0].count) > 0) {
        console.log('[migrate] tables already populated — skipping seed');
        return;
    }

    const customers   = loadJson('customers.json')    || [];
    const scores      = loadJson('scores.json')       || [];
    const signals     = loadJson('signals.json')      || [];
    const actionPlans = loadJson('action_plans.json') || [];
    const herald      = loadJson('herald.json')       || [];

    // Seed customers
    const { upsertCustomer } = require('../repositories/customerRepo');
    for (const c of customers) await upsertCustomer(c);
    console.log(`[migrate] seeded ${customers.length} customers`);

    // Seed scores
    const { upsertScore } = require('../repositories/scoreRepo');
    for (const s of scores) {
        await upsertScore({
            customer_id:   s.customer_id,
            final_score:   s.final_score,
            risk_tier:     s.risk_tier,
            p7:            s.p7,
            p30:           s.p30,
            p90:           s.p90,
            model_version: s.model_version || 'FusionXV2',
            components:    s.components || {},
        });
    }
    console.log(`[migrate] seeded ${scores.length} scores`);

    // Seed signals (signals.json is grouped per customer)
    const { upsertSignalBulk } = require('../repositories/signalRepo');
    for (const group of signals) {
        await upsertSignalBulk(group.customer_id, group.signals || []);
    }
    console.log(`[migrate] seeded signals for ${signals.length} customers`);

    // Seed action plans
    for (const p of actionPlans) {
        await query(`
            INSERT INTO action_plans
                (customer_id, action, channel, offer_code, offer_display, timing, rationale, content_strategy, tone_modifiers, raw)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (customer_id) DO NOTHING
        `, [p.customer_id, p.action, p.channel, p.offer_code, p.offer_display,
            p.timing, p.rationale, p.content_strategy, JSON.stringify(p.tone_modifiers || {}), JSON.stringify(p)]);
    }
    console.log(`[migrate] seeded ${actionPlans.length} action plans`);

    // Seed outreach log — deterministic (no Math.random), so restarts are stable
    const plansMap = actionPlans.reduce((m, p) => { m[p.customer_id] = p; return m; }, {});
    const { seedOutreachLog } = require('../repositories/outreachRepo');
    await seedOutreachLog(herald, plansMap);
    console.log(`[migrate] seeded ${herald.length} outreach records`);

    // 3. Initial portfolio aggregates
    const { recomputePortfolioAggregates } = require('../repositories/scoreRepo');
    await recomputePortfolioAggregates();
    console.log('[migrate] portfolio aggregates computed');
}

module.exports = { migrate };
