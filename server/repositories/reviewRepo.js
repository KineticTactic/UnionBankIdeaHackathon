'use strict';
// Externalized to Postgres so the API tier is stateless and horizontally scalable (was reviewStore Maps + integer counters).
// UUIDs replace integer counters so concurrent replicas never collide.
const { query } = require('../db/pool');
const crypto    = require('crypto');

async function listCases(filters = {}, pagination = {}) {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (filters.status)     { conditions.push(`status = $${idx++}`);      params.push(filters.status); }
    if (filters.type)       { conditions.push(`type = $${idx++}`);        params.push(filters.type); }
    if (filters.priority)   { conditions.push(`priority = $${idx++}`);    params.push(filters.priority); }
    if (filters.assignedTo) { conditions.push(`assigned_to = $${idx++}`); params.push(filters.assignedTo); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page   = Math.max(1, parseInt(pagination.page  || '1'));
    const limit  = Math.min(parseInt(pagination.limit || '20'), 200);
    const offset = (page - 1) * limit;

    const countRes = await query(`SELECT COUNT(*) FROM review_cases ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);
    const dataRes  = await query(
        `SELECT * FROM review_cases ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
    );
    return { data: dataRes.rows, total, page, limit };
}

async function getCase(id) {
    const caseRes = await query('SELECT * FROM review_cases WHERE id = $1', [id]);
    if (!caseRes.rows[0]) return null;
    const actRes  = await query('SELECT * FROM review_actions WHERE case_id = $1 ORDER BY created_at DESC', [id]);
    return { ...caseRes.rows[0], actions: actRes.rows };
}

async function createCase(data) {
    const id = crypto.randomUUID();
    const res = await query(`
        INSERT INTO review_cases (id, customer_id, type, priority, title, description, status, created_by, assigned_to, context)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NULL, $8)
        RETURNING *
    `, [id, data.customer_id, data.type || 'manual', data.priority || 'medium',
        data.title || 'Review case', data.description || '', data.createdBy || 'system',
        JSON.stringify(data.context || {})]);
    return res.rows[0];
}

async function updateCase(id, patch) {
    const sets   = [];
    const params = [];
    let   idx    = 1;
    for (const [k, v] of Object.entries(patch)) {
        sets.push(`${k} = $${idx++}`);
        params.push(v);
    }
    sets.push(`updated_at = now()`);
    params.push(id);
    const res = await query(
        `UPDATE review_cases SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );
    return res.rows[0] || null;
}

async function addAction(caseId, action) {
    const id  = crypto.randomUUID();
    const res = await query(`
        INSERT INTO review_actions (id, case_id, action, actor, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [id, caseId, action.action, action.actor || 'system', action.notes || null]);
    return res.rows[0];
}

async function listActions(caseId) {
    const res = await query('SELECT * FROM review_actions WHERE case_id = $1 ORDER BY created_at DESC', [caseId]);
    return res.rows;
}

async function getStats() {
    const res = await query(`
        SELECT
            COUNT(*)                                   AS total,
            COUNT(*) FILTER (WHERE status='pending')   AS pending,
            COUNT(*) FILTER (WHERE status='in_review') AS in_review,
            COUNT(*) FILTER (WHERE status='approved')  AS approved,
            COUNT(*) FILTER (WHERE status='rejected')  AS rejected,
            COUNT(*) FILTER (WHERE status='escalated') AS escalated
        FROM review_cases
    `);
    return res.rows[0];
}

module.exports = { listCases, getCase, createCase, updateCase, addAction, listActions, getStats };
