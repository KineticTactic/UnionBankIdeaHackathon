'use strict';
/**
 * PCOP Load Test — uses autocannon to hammer the stateless API tier.
 *
 * Usage:
 *   node scripts/loadtest.js [--url http://localhost:8000] [--duration 30]
 *
 * Prerequisites:
 *   npm install -g autocannon   (or: npx autocannon)
 *   Server must be running with DEMO_MODE=false and seeded DB.
 *
 * What it does:
 *   1. Seeds 100k synthetic customers via POST /api/v2/customers/bulk-seed (if endpoint exists).
 *   2. Runs three autocannon scenarios back-to-back and prints a consolidated report.
 */

const autocannon = require('autocannon');
const { promisify } = require('util');

const run = promisify(autocannon);

const BASE = process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : (process.env.LOAD_TEST_URL || 'http://localhost:8000');

const DURATION = process.argv.includes('--duration')
    ? parseInt(process.argv[process.argv.indexOf('--duration') + 1])
    : 30;

const CONNECTIONS = parseInt(process.env.CONNECTIONS || '50');

// Auth token — set LOAD_TEST_TOKEN or we fall through to a demo token
const TOKEN = process.env.LOAD_TEST_TOKEN || 'demo';

const AUTH = { Authorization: `Bearer ${TOKEN}` };

// Sample customer IDs — pulled from the first page of the list
async function getSampleIds(n = 20) {
    const res = await fetch(`${BASE}/api/v2/customers?limit=${n}`, { headers: AUTH });
    if (!res.ok) throw new Error(`Failed to fetch customer list: ${res.status}`);
    const body = await res.json();
    return (body.customers || body.data || []).map(c => c.customer_id).filter(Boolean);
}

function fmt(result) {
    const lat = result.latency;
    return {
        title:        result.title,
        requests_sec: result.requests.average.toFixed(0),
        throughput:   `${(result.throughput.average / 1024).toFixed(0)} KB/s`,
        latency_p50:  `${lat.p50}ms`,
        latency_p95:  `${lat.p95}ms`,
        latency_p99:  `${lat.p99}ms`,
        errors:       result.errors,
        timeouts:     result.timeouts,
        non2xx:       result.non2xx,
    };
}

async function main() {
    console.log(`\n[PCOP loadtest] target=${BASE}  duration=${DURATION}s  connections=${CONNECTIONS}\n`);

    // ── 1. GET /api/v2/customers (paginated list) ────────────────────────────
    console.log('Scenario 1: GET /api/v2/customers (paginated list)');
    const listResult = await run({
        url:         `${BASE}/api/v2/customers?page=1&limit=50`,
        connections: CONNECTIONS,
        duration:    DURATION,
        title:       'Customer list',
        headers:     AUTH,
    });

    // ── 2. GET /api/v2/customers/:id (random detail pages) ──────────────────
    let ids;
    try {
        ids = await getSampleIds(50);
    } catch (e) {
        console.warn('Could not fetch sample IDs, using synthetic IDs:', e.message);
        ids = Array.from({ length: 50 }, (_, i) => `C-${String(i + 1).padStart(7, '0')}`);
    }

    const requests = ids.map(id => ({ path: `/api/v2/customers/${id}` }));

    console.log('Scenario 2: GET /api/v2/customers/:id (50 random customers, round-robin)');
    const detailResult = await run({
        url:         BASE,
        connections: CONNECTIONS,
        duration:    DURATION,
        title:       'Customer detail',
        headers:     AUTH,
        requests,
    });

    // ── 3. GET /api/v2/portfolio/summary ────────────────────────────────────
    console.log('Scenario 3: GET /api/v2/portfolio/summary (precomputed aggregates)');
    const portfolioResult = await run({
        url:         `${BASE}/api/v2/portfolio/summary`,
        connections: CONNECTIONS,
        duration:    DURATION,
        title:       'Portfolio summary',
        headers:     AUTH,
    });

    // ── Report ───────────────────────────────────────────────────────────────
    const results = [listResult, detailResult, portfolioResult].map(fmt);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('PCOP Load Test Results');
    console.log('═══════════════════════════════════════════════════════');
    console.table(results);

    const hasErrors = results.some(r => r.errors > 0 || r.non2xx > 0 || r.timeouts > 0);
    if (hasErrors) {
        console.error('\n[WARN] Some scenarios recorded errors — check server logs.');
        process.exit(1);
    }

    const minRps = Math.min(...results.map(r => Number(r.requests_sec)));
    console.log(`\n[OK] min throughput across scenarios: ${minRps} req/s`);
    if (minRps < 100) {
        console.warn('[WARN] Below 100 req/s — investigate DB indexes or connection pool size.');
    }
}

main().catch(e => { console.error('[loadtest ERROR]', e); process.exit(1); });
