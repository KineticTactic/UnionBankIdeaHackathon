'use strict';
// Externalized to Postgres so the API tier is stateless and horizontally scalable (was in-process signalOverrides Map).
const { query } = require('../db/pool');

async function getSignals(customerId) {
    const res = await query(
        'SELECT * FROM signals WHERE customer_id = $1 AND archived = false ORDER BY created_at DESC',
        [customerId]
    );
    return res.rows;
}

async function getAllSignals(pagination = {}) {
    const page   = Math.max(1, parseInt(pagination.page  || '1'));
    const limit  = Math.min(parseInt(pagination.limit || '50'), 500);
    const offset = (page - 1) * limit;

    const countRes = await query('SELECT COUNT(*) FROM signals WHERE archived = false');
    const total    = parseInt(countRes.rows[0].count);
    const dataRes  = await query(
        'SELECT * FROM signals WHERE archived = false ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    return { rows: dataRes.rows, total, page, limit };
}

async function insertSignal(customerId, signal) {
    const res = await query(`
        INSERT INTO signals (customer_id, signal_type, method, confidence, cusum_value, alarm_threshold, days_active, detected)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [customerId, signal.signal_type, signal.method, signal.confidence,
        signal.cusum_value, signal.alarm_threshold, signal.days_active || 1, true]);
    return res.rows[0];
}

async function upsertSignalBulk(customerId, signals) {
    for (const s of (signals || [])) {
        await query(`
            INSERT INTO signals (customer_id, signal_type, method, confidence, cusum_value, alarm_threshold, days_active, detected)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT DO NOTHING
        `, [customerId, s.signal_type, s.method || 'CUSUM', s.confidence, s.cusum_value,
            s.alarm_threshold, s.days_active || 1, s.detected !== false]);
    }
}

async function archiveStaleSignals(olderThanDays = 90) {
    const res = await query(
        `UPDATE signals SET archived = true WHERE created_at < now() - ($1 || ' days')::INTERVAL AND archived = false`,
        [olderThanDays]
    );
    return res.rowCount;
}

module.exports = { getSignals, getAllSignals, insertSignal, upsertSignalBulk, archiveStaleSignals };
