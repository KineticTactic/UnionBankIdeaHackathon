'use strict';
// Externalized to Postgres so the API tier is stateless and horizontally scalable (was JSON+in-process Maps).
const { query } = require('../db/pool');

async function getCustomers(filters = {}, pagination = {}) {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (filters.segment)   { conditions.push(`segment = $${idx++}`);   params.push(filters.segment); }
    if (filters.risk_tier) { conditions.push(`risk_tier = $${idx++}`); params.push(filters.risk_tier); }
    if (filters.city)      { conditions.push(`city = $${idx++}`);      params.push(filters.city); }
    if (filters.archetype) { conditions.push(`archetype = $${idx++}`); params.push(filters.archetype); }
    if (filters.search) {
        const q = `%${filters.search.toLowerCase()}%`;
        conditions.push(`(LOWER(full_name) LIKE $${idx} OR LOWER(customer_id) LIKE $${idx} OR LOWER(COALESCE(employer,'')) LIKE $${idx} OR LOWER(COALESCE(city,'')) LIKE $${idx})`);
        params.push(q);
        idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let order = 'ORDER BY customer_id';
    if (filters.sort === 'score_desc') order = 'ORDER BY churn_score DESC NULLS LAST';
    if (filters.sort === 'score_asc')  order = 'ORDER BY churn_score ASC  NULLS LAST';
    if (filters.sort === 'name')       order = 'ORDER BY full_name ASC';

    const page  = Math.max(1, parseInt(pagination.page  || '1'));
    const limit = Math.min(parseInt(pagination.limit || '50'), 500);
    const offset = (page - 1) * limit;

    const countRes = await query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);

    const dataRes  = await query(
        `SELECT * FROM customers ${where} ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
    );

    return { rows: dataRes.rows, total, page, limit };
}

async function getCustomerById(id) {
    const res = await query('SELECT * FROM customers WHERE customer_id = $1', [id]);
    return res.rows[0] || null;
}

async function getCustomerSnapshot(id) {
    const customer = await getCustomerById(id);
    if (!customer) return null;

    const [scoreRes, signalRes, planRes] = await Promise.all([
        query('SELECT * FROM scores WHERE customer_id = $1', [id]),
        query('SELECT * FROM signals WHERE customer_id = $1 AND archived = false ORDER BY created_at DESC', [id]),
        query('SELECT * FROM action_plans WHERE customer_id = $1', [id]),
    ]);

    const score   = scoreRes.rows[0]  || null;
    const signals = signalRes.rows    || [];
    const plan    = planRes.rows[0]   || null;

    return { customer, score, signals, plan, survival: null, herald: null };
}

async function upsertCustomer(c) {
    await query(`
        INSERT INTO customers (customer_id,full_name,first_name,age,city,segment,archetype,employer,
            relationship_manager,tenure_months,balance,income,product_count,nps,risk_tier,churn_score,
            preferred_channel,inactivity_days,app_logins_30d,txn_freq_90d,digital_ratio,
            salary_credit_count,complaint_count,life_event,life_event_desc,raw,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,now())
        ON CONFLICT (customer_id) DO NOTHING
    `, [
        c.customer_id, c.full_name, c.first_name, c.age, c.city, c.segment,
        c.archetype, c.employer, c.relationship_manager, c.tenure_months,
        c.balance, c.income, c.product_count, c.nps, c.risk_tier, c.churn_score,
        c.preferred_channel, c.inactivity_days, c.app_logins_30d, c.txn_freq_90d,
        c.digital_ratio, c.salary_credit_count, c.complaint_count,
        c.life_event, c.life_event_desc, JSON.stringify(c),
    ]);
}

module.exports = { getCustomers, getCustomerById, getCustomerSnapshot, upsertCustomer };
