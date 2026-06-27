'use strict';
const { Pool } = require('pg');
const config   = require('../config');

const pool = new Pool({
    connectionString:      config.databaseUrl,
    max:                   parseInt(process.env.PG_POOL_MAX || '20'),
    idleTimeoutMillis:     30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('[pg pool ERROR]', err.message));

async function query(text, params) {
    const start = Date.now();
    const res   = await pool.query(text, params);
    const ms    = Date.now() - start;
    if (ms > 200) console.warn(`[pg SLOW ${ms}ms] ${text.slice(0, 80)}`);
    return res;
}

async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function ping() {
    await pool.query('SELECT 1');
}

module.exports = { pool, query, withTransaction, ping };
