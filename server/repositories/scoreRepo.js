'use strict';
// Externalized to Postgres so the API tier is stateless and horizontally scalable (was in-process Maps).
const { query } = require('../db/pool');

let _recomputeTimer = null;

async function getScore(customerId) {
    const res = await query('SELECT * FROM scores WHERE customer_id = $1', [customerId]);
    return res.rows[0] || null;
}

async function getScores(filters = {}, pagination = {}) {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (filters.tier)         { conditions.push(`risk_tier = $${idx++}`);    params.push(filters.tier); }
    if (filters.anomalyOnly)  { conditions.push(`final_score >= $${idx++}`); params.push(0.8); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page   = Math.max(1, parseInt(pagination.page  || '1'));
    const limit  = Math.min(parseInt(pagination.limit || '50'), 500);
    const offset = (page - 1) * limit;

    const countRes = await query(`SELECT COUNT(*) FROM scores ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);
    const dataRes  = await query(
        `SELECT * FROM scores ${where} ORDER BY final_score DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
    );
    return { rows: dataRes.rows, total, page, limit };
}

async function applyScoreOverride(customerId, delta) {
    await query(`
        INSERT INTO scores (customer_id, final_score, risk_tier, model_version, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (customer_id) DO UPDATE
            SET final_score   = EXCLUDED.final_score,
                risk_tier     = EXCLUDED.risk_tier,
                model_version = EXCLUDED.model_version,
                updated_at    = now()
    `, [customerId, delta.final_score, delta.risk_tier, delta.model_version || 'live-override']);

    scheduleRecomputeAggregates();
}

async function upsertScore(s) {
    await query(`
        INSERT INTO scores (customer_id,final_score,risk_tier,p7,p30,p90,model_version,components,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
        ON CONFLICT (customer_id) DO NOTHING
    `, [s.customer_id, s.final_score, s.risk_tier, s.p7, s.p30, s.p90, s.model_version, JSON.stringify(s.components || {})]);
}

async function getPortfolioAggregates() {
    const res = await query('SELECT data FROM portfolio_aggregates WHERE id = 1');
    return res.rows[0]?.data || null;
}

async function recomputePortfolioAggregates() {
    const res = await query(`
        SELECT
            AVG(p7)  AS avg_p7,
            AVG(p30) AS avg_p30,
            AVG(p90) AS avg_p90,
            COUNT(*) FILTER (WHERE p7  > 0.40) AS urgent_7d,
            COUNT(*) FILTER (WHERE p30 > 0.40) AS urgent_30d,
            COUNT(*) FILTER (WHERE p90 > 0.40) AS urgent_90d
        FROM scores
    `);
    const row  = res.rows[0];
    const data = {
        avg_p7:      parseFloat(row.avg_p7  || 0).toFixed(4),
        avg_p30:     parseFloat(row.avg_p30 || 0).toFixed(4),
        avg_p90:     parseFloat(row.avg_p90 || 0).toFixed(4),
        urgent_7d:   parseInt(row.urgent_7d  || 0),
        urgent_30d:  parseInt(row.urgent_30d || 0),
        urgent_90d:  parseInt(row.urgent_90d || 0),
        recomputed_at: new Date().toISOString(),
    };
    await query(`
        INSERT INTO portfolio_aggregates (id, data, updated_at)
        VALUES (1, $1, now())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `, [JSON.stringify(data)]);

    // Also cache in Redis if available
    try {
        const eventBus = require('../services/eventBus');
        if (eventBus._pub) {
            await eventBus._pub.set('portfolio:aggregates', JSON.stringify(data), 'EX', 30);
        }
    } catch (_) {}

    return data;
}

// Debounced — recompute at most once every 10 s across all calls
function scheduleRecomputeAggregates() {
    if (_recomputeTimer) return;
    _recomputeTimer = setTimeout(async () => {
        _recomputeTimer = null;
        try { await recomputePortfolioAggregates(); } catch (e) { console.error('[scoreRepo] aggregate recompute error:', e.message); }
    }, 10_000);
}

module.exports = { getScore, getScores, applyScoreOverride, upsertScore, getPortfolioAggregates, recomputePortfolioAggregates };
