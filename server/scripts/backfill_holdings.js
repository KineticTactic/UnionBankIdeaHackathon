'use strict';
/**
 * backfill_holdings.js — P0 of NEXUS.
 * Adds a deterministic `products` array to every demo customer in
 * server/data/customers.json, derived from segment + product_count.
 *
 * Idempotent: re-running produces identical holdings (seeded by customer_id).
 * Run:  node server/scripts/backfill_holdings.js
 */

const fs   = require('fs');
const path = require('path');
const { deriveHoldings, PRODUCT_CATALOG } = require('../services/productCatalog');

const FILE = path.join(__dirname, '..', 'data', 'customers.json');

function main() {
    const customers = JSON.parse(fs.readFileSync(FILE, 'utf8'));

    let changed = 0;
    const adoption = Object.fromEntries(PRODUCT_CATALOG.map(p => [p, 0]));

    for (const c of customers) {
        const products = deriveHoldings(c);
        if (JSON.stringify(c.products) !== JSON.stringify(products)) changed++;
        c.products = products;
        products.forEach(p => { adoption[p]++; });
    }

    fs.writeFileSync(FILE, JSON.stringify(customers, null, 2) + '\n', 'utf8');

    console.log(`[backfill_holdings] wrote products[] to ${customers.length} customers (${changed} changed).`);
    console.log('[backfill_holdings] catalog adoption counts:');
    for (const p of PRODUCT_CATALOG) {
        const pct = ((adoption[p] / customers.length) * 100).toFixed(0);
        console.log(`  ${p.padEnd(20)} ${String(adoption[p]).padStart(2)}  (${pct}%)`);
    }
    // Spot-check a few
    console.log('[backfill_holdings] samples:');
    customers.slice(0, 4).forEach(c =>
        console.log(`  ${c.customer_id} ${c.segment.padEnd(14)} pc=${c.product_count} → [${c.products.join(', ')}]`));
}

main();
