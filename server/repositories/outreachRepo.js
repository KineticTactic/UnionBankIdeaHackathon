'use strict';
// Externalized to Postgres so the API tier is stateless and horizontally scalable (was in-memory outreachLog array).
const { query } = require('../db/pool');

async function listOutreach(filters = {}, pagination = {}) {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (filters.customer_id) { conditions.push(`customer_id = $${idx++}`); params.push(filters.customer_id); }
    if (filters.status)      { conditions.push(`status = $${idx++}`);      params.push(filters.status); }
    if (filters.channel)     { conditions.push(`channel = $${idx++}`);     params.push(filters.channel); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page   = Math.max(1, parseInt(pagination.page  || '1'));
    const limit  = Math.min(parseInt(pagination.limit || '20'), 500);
    const offset = (page - 1) * limit;

    const countRes = await query(`SELECT COUNT(*) FROM outreach_log ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);
    const dataRes  = await query(
        `SELECT * FROM outreach_log ${where} ORDER BY dispatched_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
    );
    return { rows: dataRes.rows, total, page, limit };
}

async function getOutreachById(id) {
    const res = await query('SELECT * FROM outreach_log WHERE id = $1', [id]);
    return res.rows[0] || null;
}

async function insertOutreach(record) {
    await query(`
        INSERT INTO outreach_log (id, customer_id, channel, risk_tier, status, offer_code, content_hash, dispatched_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
    `, [record.id, record.customer_id, record.channel, record.risk_tier,
        record.status, record.offer_code, record.content_hash, record.dispatched_at || new Date()]);
}

async function seedOutreachLog(herald, plansMap) {
    const STATUSES = ['sent', 'delivered', 'opened', 'clicked'];
    for (let i = 0; i < herald.length; i++) {
        const h   = herald[i];
        const id  = `OR-${String(i + 1).padStart(4, '0')}`;
        const ch  = h.risk_tier === 'PRIORITY' ? 'phone' : h.risk_tier === 'ESCALATE' ? 'email' : 'sms';
        const status = STATUSES[i % STATUSES.length]; // deterministic — no Math.random
        const dispatchedAt = new Date(Date.now() - (i % 7) * 86_400_000).toISOString();
        await query(`
            INSERT INTO outreach_log (id, customer_id, channel, risk_tier, status, offer_code, dispatched_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
        `, [id, h.customer_id, ch, h.risk_tier, status, plansMap[h.customer_id]?.offer_code || 'NONE', dispatchedAt]);
    }
}

module.exports = { listOutreach, getOutreachById, insertOutreach, seedOutreachLog };
