'use strict';
/**
 * argusTransformer.js — build the `herald_data` dict for one ARGUS
 * evaluation from the Bank API.
 *
 * Each of the 9 HERALD agents expects a different shape:
 *
 *   sr_transaction   → { history, tempo_state, sr_state }
 *   sa_ewma_recency  → { days_since_last_txn, sa_state }
 *   cusum_salary     → { salary_amount, employer_ref, modal_employer_ref,
 *                        cusum_state, sr_state, tempo_state, employer_dist_history }
 *   beta_cusum_sentiment → { sentiment_score, complaint_count, beta_cusum_state,
 *                            sprt_state, lambda0, lambda1 }
 *   ewma_engagement  → { engagement_history, ewma_state, tempo_mu, tempo_sigma }
 *   cfsi_stress      → { components, cusum_state, tempo_state }
 *   location_rule    → { city_transactions, home_city, intl_fraction,
 *                        has_remittance_mcc }
 *   lifecycle_mcc    → { mccs_30d }
 *   rci_market       → { pcop_savings_rate, competitor_rates }
 *
 * Bank API endpoints used:
 *   /api/core-banking/salary-credits?customer_id=...&months=6
 *   /api/core-banking/transactions?customer_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   /api/card-network/transactions?customer_id=...
 *   /api/crm/notes?customer_id=...&note_type=complaint
 *   /api/app-events/login-series?customer_id=...
 *   /api/crm/sentiment/history?customer_id=...
 *   /api/enrichment/:customer_id
 *   /api/enrichment/market-signals
 *   /api/customers/:id
 *
 * Because the orchestrator process is single-threaded in DEMO_MODE we
 * hit the Bank API synchronously with the global URL fetcher; no
 * concurrency control is needed.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs   = require('fs');
const path = require('path');
const argusState = require('./argusState');
const config = require('../config');
const dataStore = require('./dataStore');

const BANK = config.bankApiBaseUrl;
const _states = argusState.getStates;

// ── Local-data fallback (bank/data/*.json) ─────────────────────────────────
const BANK_DATA_DIR = path.resolve(__dirname, '..', '..', 'bank', 'data');

function _readLocalJson(name) {
    try {
        const fp = path.join(BANK_DATA_DIR, name);
        if (!fs.existsSync(fp)) return null;
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch { return null; }
}

const _localBank = {
    customers:           null,
    accounts:            null,
    card_transactions:   null,
    transactions:        null,
    crm_notes:           null,
    app_events:          null,
    enrichment:          null,
};

// Tiny CSV parser (no third-party deps) — returns list of object rows
function _parseCsv(fp) {
    try {
        if (!fs.existsSync(fp)) return [];
        const raw = fs.readFileSync(fp, 'utf8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return [];
        const header = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const cols = line.split(',');
            const obj = {};
            for (let i = 0; i < header.length; i++) obj[header[i]] = (cols[i] || '').trim();
            return obj;
        });
    } catch { return []; }
}

function _localCustomers()  { return _localBank.customers        || (_localBank.customers        = _readLocalJson('customers.json')        || []); }
function _localAccounts()   { return _localBank.accounts         || (_localBank.accounts         = _readLocalJson('accounts.json')         || []); }
function _localCards()      { return _localBank.card_transactions|| (_localBank.card_transactions= _parseCsv(path.join(BANK_DATA_DIR, 'card_transactions.csv'))); }
function _localTxns()       { return _localBank.transactions     || (_localBank.transactions     = _parseCsv(path.join(BANK_DATA_DIR, 'transactions.csv'))); }
function _localCrm()        { return _localBank.crm_notes        || (_localBank.crm_notes        = _readLocalJson('crm_notes.json')        || []); }
function _localAppEvents()  { return _localBank.app_events       || (_localBank.app_events       = _parseCsv(path.join(BANK_DATA_DIR, 'app_events.csv'))); }
function _localEnrichment() { return _localBank.enrichment       || (_localBank.enrichment       = _readLocalJson('enrichment.json')       || {}); }

// Tiny CSV parser (no third-party deps) — returns list of object rows
function _parseCsv(fp) {
    try {
        if (!fs.existsSync(fp)) return [];
        const raw = fs.readFileSync(fp, 'utf8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return [];
        const header = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const cols = line.split(',');
            const obj = {};
            for (let i = 0; i < header.length; i++) obj[header[i]] = (cols[i] || '').trim();
            return obj;
        });
    } catch { return []; }
}

function _localCrmForCustomer(customerId) {
    const all = _localCrm();
    if (Array.isArray(all)) return all.filter(n => n.customer_id === customerId && n.note_type === 'complaint');
    return [];
}
function _localCardsForCustomer(customerId) {
    const all = _localCards();
    if (Array.isArray(all)) return all.filter(t => t.customer_id === customerId);
    return [];
}
function _localTxnsForCustomer(customerId) {
    const all = _localTxns();
    if (Array.isArray(all)) return all.filter(t => t.customer_id === customerId);
    return [];
}
function _localLoginsForCustomer(customerId) {
    // app_events.csv columns: event_id, customer_id, event_type,
    //   feature_name, session_id, session_duration_s, platform,
    //   app_version, event_timestamp
    const evts = _localAppEvents();
    const logins = [];
    for (const e of evts) {
        if (e.customer_id !== customerId) continue;
        if (e.event_type === 'login') {
            logins.push({ date: (e.event_timestamp || '').split('T')[0] || '' });
        }
    }
    return logins;
}
function _localSalaryForCustomer(customerId) {
    const txns = _localTxnsForCustomer(customerId);
    return txns.filter(t => t.category === 'salary_credit' || t.category === 'salary');
}

// ── Synthetic data generator ────────────────────────────────────────────────
// When neither the live Bank API nor the local bank/data/*.json files
// have data for a customer (the typical case for orchestrator-format
// IDs CUST-001 in DEMO_MODE), we synthesise a believable transaction
// history from the customer's static profile in the orchestrator's
// dataStore (server/data/customers.json).  This is keyed off the
// archetype so a "critical" customer gets more alerts than a
// "vip_loyal" customer — a small but useful demo affordance.
const _rng = (seed) => {
    let s = seed | 0;
    return () => {
        s = (s * 9301 + 49297) & 0x7fffffff;
        return (s % 1000) / 1000.0;
    };
};

function _hashId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    return h;
}

function _synthTxnsForCustomer(customerId) {
    const cust = dataStore.CUSTOMERS_MAP[customerId];
    if (!cust) return { txns: [], cardTxns: [], notes: [], logins: [], salary: [], snap: { customer_id: customerId, city: '' } };
    const rng  = _rng(_hashId(customerId));
    const freq = Math.max(5, Number(cust.txn_freq_90d) || 30);
    const avg  = Math.max(100, Number(cust.avg_txn_amount) || 1500);
    const txnCount = Math.min(120, Math.floor(freq * 1.3));
    const txns = [];
    const cardTxns = [];
    const today = _today();
    for (let i = 0; i < txnCount; i++) {
        const daysAgo = Math.floor(rng() * 60);
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        const ds = d.toISOString().split('T')[0];
        const amt = Math.max(20, Math.round(avg * (0.5 + rng() * 1.5)));
        const isCard = rng() > 0.4;
        const obj = {
            customer_id:     customerId,
            txn_date:        ds,
            date:            ds,
            txn_timestamp:   d.toISOString(),
            amount:          amt,
            direction:       rng() > 0.85 ? 'credit' : 'debit',
            category:        rng() > 0.85 ? 'salary_credit' : (rng() > 0.5 ? 'retail' : 'fee'),
            channel:         isCard ? 'card' : (rng() > 0.5 ? 'upi' : 'branch'),
            mcc_code:        isCard ? String([5411, 5812, 5722, 5211, 5944, 7011, 5641, 6552][Math.floor(rng() * 8)]) : '',
            merchant_name:   isCard ? ['Big Bazaar', 'Croma', 'The Taj', 'Reliance Fresh', 'D-Mart', 'Diamond Palace'][Math.floor(rng() * 6)] : '',
            merchant_city:   (rng() > 0.7 && cust.city) ? 'Bangalore' : (cust.city || 'Mumbai'),
            is_international: rng() > 0.92 ? '1' : '0',
            payment_ref:     rng() > 0.85 ? (cust.employer || 'Employer') : '',
        };
        if (isCard) cardTxns.push(obj);
        else        txns.push(obj);
    }
    // Salary credits (3 per quarter)
    const salary = [];
    if (cust.salary_credit_count > 0) {
        for (let i = 0; i < Math.min(6, cust.salary_credit_count); i++) {
            const d = new Date(today); d.setDate(d.getDate() - i * 30);
            salary.push({
                customer_id:  customerId,
                amount:       Math.round(Number(cust.income || 0) / 12),
                payment_ref:  cust.employer || 'Employer',
                txn_date:     d.toISOString().split('T')[0],
                date:         d.toISOString().split('T')[0],
            });
        }
    }
    // CRM complaints — use complaint_count + archetype multiplier
    const notes = [];
    const expectedComplaints = Math.max(0, Number(cust.complaint_count) || 0) +
        (cust.archetype === 'critical' ? 3 : cust.archetype === 'high_risk' ? 2 : cust.archetype === 'drifting' ? 1 : 0);
    for (let i = 0; i < expectedComplaints; i++) {
        notes.push({
            customer_id:      customerId,
            note_type:        'complaint',
            note_text:        'Customer escalated a service issue',
            sentiment_score:  -0.6 - rng() * 0.4,
            resolved:         i > 0,
        });
    }
    // App logins — use app_logins_30d as the base count
    const logins = [];
    const nLogins = Math.min(30, Number(cust.app_logins_30d) || 0);
    for (let i = 0; i < nLogins; i++) {
        const d = new Date(today); d.setDate(d.getDate() - Math.floor(rng() * 30));
        logins.push({ date: d.toISOString().split('T')[0] });
    }
    return {
        txns, cardTxns, notes, logins, salary,
        snap: { customer_id: customerId, city: cust.city || 'Mumbai' },
    };
}

// ── stdlib HTTP helpers (no node-fetch / axios) ─────────────────────────────
function _fetchJson(url, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const lib = u.protocol === 'https:' ? https : http;
            const req = lib.get({ host: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + (u.search || ''), timeout: timeoutMs, headers: { 'Accept': 'application/json' } }, (resp) => {
                let body = '';
                resp.on('data', (c) => body += c);
                resp.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch (e) { resolve({ _raw: body, _parse_error: e.message }); }
                });
            });
            req.on('error',   (e) => reject(new Error(e.code || e.message)));
            req.on('timeout', () => { req.destroy(new Error('bank API timeout')); });
        } catch (e) { reject(e); }
    });
}

// ── Date helpers ────────────────────────────────────────────────────────────
function _today()      { return new Date(); }
function _isoDate(d)   { return d.toISOString().split('T')[0]; }
function _daysAgo(n)   { const d = _today(); d.setDate(d.getDate() - n); return d; }
function _diffDays(a, b) { return Math.floor((a.getTime() - b.getTime()) / 86_400_000); }

// ── Empty state factories (Python-side dataclass-equivalents) ──────────────
// These are the JSON shapes the ARGUS Python service will reconstruct
// into dataclass instances.  The Python __init__ methods accept
// positional/keyword args, so we pass the fields it needs.

function _emptyTEMP() { return { signal_type: '', mu: 0.0, sigma: 1.0, P: 1.0, update_status: 'active', alarm_cleared_date: null, fast_update_start: null, fast_update_days_remaining: 0 }; }
function _emptySR()   { return { r_pos: 0.0, r_neg: 0.0 }; }
function _emptyCUSUM(){ return { s_pos: 0.0, s_neg: 0.0 }; }
function _emptySAEWMA(interArrDays = 7.0) {
    const lam = 1.0 / Math.max(interArrDays, 0.5);
    return { z: 0.0, mu_z: 0.0, sigma_z: 1.0, lam_customer: lam, alpha: 0.2 };
}
function _emptyBetaCUSUM() { return { s_pos: 0.0, s_neg: 0.0, sigma_y: 1.0 }; }
function _emptySPRT() { return { log_lr: 0.0, n: 0 }; }
function _emptyEWMA(mu = 0.5, sigma = 0.2, lam = 0.2) {
    const half = 3.0 * sigma * Math.sqrt(lam / (2.0 - lam));
    return { z: mu, lam, ucl: mu + half, lcl: mu - half };
}
function _emptyCFSI() { return { overdraft_freq: 0, high_risk_mcc_ratio: 0, balance_min_ratio: 0.5, late_payment: 0, atm_ratio: 0 }; }

// ── Per-agent builders ──────────────────────────────────────────────────────

function _build_sr_transaction(txns, snap) {
    // Daily counts from the last 30 days.
    const counts = new Map();
    for (let i = 0; i < 30; i++) counts.set(_isoDate(_daysAgo(i)), 0);
    for (const t of txns) {
        const d = (t.txn_date || t.date || '').split('T')[0];
        if (counts.has(d)) counts.set(d, counts.get(d) + 1);
    }
    const history = Array.from(counts.values());
    const mu    = history.reduce((a, b) => a + b, 0) / Math.max(history.length, 1);
    const sigma = Math.sqrt(history.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(history.length, 1)) || 1.0;

    const bag = _states(snap.customer_id);
    if (!bag.sr_txn) {
        bag.sr_txn = {
            tempo: { ..._emptyTEMP(), signal_type: 'sr_transaction', mu, sigma, P: sigma * sigma },
            sr:    _emptySR(),
        };
    }
    return {
        history: history.slice(-30),
        tempo_state: bag.sr_txn.tempo,
        sr_state:    bag.sr_txn.sr,
    };
}

function _build_sa_ewma_recency(txns, snap) {
    // Days since most recent transaction.
    const dates = txns.map(t => new Date(t.txn_date || t.date)).filter(d => !isNaN(d));
    dates.sort((a, b) => b.getTime() - a.getTime());
    const days = dates.length ? Math.max(0, _diffDays(_today(), dates[0])) : 30;
    // Mean inter-arrival for baseline.
    const gaps = [];
    for (let i = 1; i < dates.length && i < 12; i++) gaps.push(_diffDays(dates[i - 1], dates[i]));
    const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 7.0;
    const bag = _states(snap.customer_id);
    if (!bag.sa_rec) bag.sa_rec = _emptySAEWMA(meanGap);
    return { days_since_last_txn: days, sa_state: bag.sa_rec };
}

function _build_cusum_salary(salaryTxns, snap) {
    const amounts = salaryTxns.map(t => Number(t.amount || 0));
    const latest  = amounts[0] || 0;
    const mu      = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
    const sigma   = amounts.length
        ? Math.sqrt(amounts.reduce((a, b) => a + (b - mu) ** 2, 0) / amounts.length) || 1.0
        : 1.0;
    const refCounts = new Map();
    for (const t of salaryTxns) {
        const r = (t.payment_ref || t.merchant_name || '').toUpperCase();
        if (r) refCounts.set(r, (refCounts.get(r) || 0) + 1);
    }
    let modalRef = ''; let maxCount = 0;
    for (const [r, c] of refCounts) if (c > maxCount) { modalRef = r; maxCount = c; }
    const employerRef = (salaryTxns[0] && (salaryTxns[0].payment_ref || salaryTxns[0].merchant_name)) || modalRef;

    const bag = _states(snap.customer_id);
    if (!bag.cusum_sal) {
        bag.cusum_sal = {
            cusum: _emptyCUSUM(),
            sr:    _emptySR(),
            tempo: { ..._emptyTEMP(), signal_type: 'cusum_salary', mu, sigma, P: sigma * sigma },
        };
    }
    return {
        salary_amount:        latest,
        employer_ref:         employerRef,
        modal_employer_ref:   modalRef,
        cusum_state:          bag.cusum_sal.cusum,
        sr_state:             bag.cusum_sal.sr,
        tempo_state:          bag.cusum_sal.tempo,
        employer_dist_history: bag.cusum_sal.dist_history || (bag.cusum_sal.dist_history = []),
    };
}

function _build_beta_cusum_sentiment(notes, snap) {
    const sentiments = notes.map(n => Number(n.sentiment_score || 0));
    const mean       = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
    const latest     = sentiments[0] || 0;
    const bag = _states(snap.customer_id);
    if (!bag.beta_cusum) {
        bag.beta_cusum = {
            beta: _emptyBetaCUSUM(),
            sprt: _emptySPRT(),
        };
    }
    return {
        sentiment_score:  latest,
        complaint_count:  notes.length,
        beta_cusum_state: bag.beta_cusum.beta,
        sprt_state:       bag.beta_cusum.sprt,
        lambda0:          0.5,
        lambda1:          2.0,
    };
}

function _build_ewma_engagement(loginSeries, snap) {
    // loginSeries is [{ date, count }] — convert to daily engagement score
    // 1.0 if logged in that day, else 0.0.
    const counts = new Map();
    for (let i = 0; i < 30; i++) counts.set(_isoDate(_daysAgo(i)), 0);
    for (const d of loginSeries) {
        const k = (d.date || d.event_date || '').split('T')[0];
        if (counts.has(k)) counts.set(k, Math.max(counts.get(k), 1));
    }
    const history = Array.from(counts.values());
    const mu    = history.reduce((a, b) => a + b, 0) / Math.max(history.length, 1);
    const sigma = Math.sqrt(history.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(history.length, 1)) || 0.2;

    const bag = _states(snap.customer_id);
    if (!bag.ewma_eng) bag.ewma_eng = _emptyEWMA(mu, sigma, 0.2);
    return {
        engagement_history: history,
        ewma_state:         bag.ewma_eng,
        tempo_mu:           mu,
        tempo_sigma:        sigma,
    };
}

function _build_cfsi_stress(txns, snap) {
    // Approximate CFSI from the last 30 days of card transactions.
    const recent = txns.slice(0, 30);
    const atm     = recent.filter(t => (t.channel || '').toLowerCase() === 'atm').length;
    const highRiskMcc = recent.filter(t => [6141, 6099, 6051, 6012, 7299].includes(Number(t.mcc_code))).length;
    const overdraft = recent.filter(t => Number(t.amount) > 50_000).length;
    const latePmt  = 0; // not directly observable in the bank CSV
    const minBal   = 0.4; // placeholder
    const components = {
        overdraft_freq:     Math.min(1, overdraft / 5),
        high_risk_mcc_ratio: highRiskMcc / Math.max(recent.length, 1),
        balance_min_ratio:  minBal,
        late_payment:       latePmt,
        atm_ratio:          atm / Math.max(recent.length, 1),
    };
    const cfsi =
        0.30 * components.overdraft_freq +
        0.25 * components.high_risk_mcc_ratio +
        0.20 * (1 - components.balance_min_ratio) +
        0.15 * components.late_payment +
        0.10 * components.atm_ratio;
    const mu = 0.0, sigma = 0.2;
    const bag = _states(snap.customer_id);
    if (!bag.cfsi) {
        bag.cfsi = {
            cusum: _emptyCUSUM(),
            tempo: { ..._emptyTEMP(), signal_type: 'cfsi_stress', mu, sigma, P: sigma * sigma },
        };
    }
    return {
        components: { ...components, _cfsi: cfsi },
        cusum_state: bag.cfsi.cusum,
        tempo_state: bag.cfsi.tempo,
    };
}

function _build_location_rule(txns, snap) {
    const city = snap.city || 'Unknown';
    const txns30 = txns.slice(0, 30);
    const totalAmt = txns30.reduce((a, t) => a + Number(t.amount || 0), 0) || 1;
    const newCityAmt = txns30.filter(t => (t.merchant_city || '') !== city)
                              .reduce((a, t) => a + Number(t.amount || 0), 0);
    const intlCount = txns30.filter(t => t.is_international === '1' || t.is_international === 1 || t.is_international === true).length;
    const hasRemittance = txns30.some(t => Number(t.mcc_code) === 6099);
    return {
        city_transactions: txns30.map(t => ({
            city:        t.merchant_city || '',
            amount:      Number(t.amount || 0),
            is_new_city: (t.merchant_city || '') !== city,
            // Pass ISO date strings (the agent parses them via
            // datetime.fromisoformat, which handles 'YYYY-MM-DD').
            date:        t.txn_date || t.date || '',
        })),
        home_city:           city,
        intl_fraction:       intlCount / Math.max(txns30.length, 1),
        has_remittance_mcc:  hasRemittance,
    };
}

function _build_lifecycle_mcc(txns, snap) {
    const cutoff = _daysAgo(30);
    const mccs = new Set();
    for (const t of txns) {
        const d = new Date(t.txn_date || t.date || '');
        if (!isNaN(d) && d >= cutoff && t.mcc_code) mccs.add(Number(t.mcc_code));
    }
    return { mccs_30d: Array.from(mccs) };
}

function _build_rci_market(snap) {
    // Static competitor rates — calibrated for the demo.  In production
    // this would come from the market-signals Bank API endpoint.
    return {
        pcop_savings_rate: 3.5,
        competitor_rates: {
            HDFC: 4.0,
            ICICI: 4.1,
            SBI:  3.8,
            Kotak: 3.9,
            Axis:  4.0,
        },
    };
}

// ── Public: buildHeraldData(customerId) ─────────────────────────────────────

async function buildHeraldData(customerId) {
    const from = _isoDate(_daysAgo(60));
    const to   = _isoDate(_today());

    // Parallel-fetch all bank data sources.  Each fetch is independent
    // and tolerant of failure — we fall back to local bank data files
    // (bank/data/*.json) if the Bank API is unreachable or the customer
    // exists only in the orchestrator's local store.
    const [salary, txnsCore, txnsCard, notes, loginSeries, snapshot] = await Promise.allSettled([
        _fetchJson(`${BANK}/api/core-banking/salary-credits?customer_id=${encodeURIComponent(customerId)}&months=6`),
        _fetchJson(`${BANK}/api/core-banking/transactions?customer_id=${encodeURIComponent(customerId)}&from=${from}&to=${to}&limit=200`),
        _fetchJson(`${BANK}/api/card-network/transactions?customer_id=${encodeURIComponent(customerId)}&limit=200`),
        _fetchJson(`${BANK}/api/crm/notes?customer_id=${encodeURIComponent(customerId)}&note_type=complaint&limit=20`),
        _fetchJson(`${BANK}/api/app-events/login-series?customer_id=${encodeURIComponent(customerId)}&from=${from}&to=${to}`),
        _fetchJson(`${BANK}/api/customers/${encodeURIComponent(customerId)}/snapshot`),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { _error: r.reason && r.reason.message }));

    // Normalize shapes — bank API can return either {data: [...]} or a bare array.
    const salaryTxns = (salary && salary.data)  || (Array.isArray(salary) ? salary : []);
    const coreTxns   = (txnsCore && txnsCore.data) || (Array.isArray(txnsCore) ? txnsCore : []);
    const cardTxns   = (txnsCard && txnsCard.data) || (Array.isArray(txnsCard) ? txnsCard : []);
    const allTxns    = [...coreTxns, ...cardTxns];
    const notesList  = (notes && notes.data) || (Array.isArray(notes) ? notes : []);
    const loginList  = (loginSeries && loginSeries.data) || (Array.isArray(loginSeries) ? loginSeries : []);
    const snap       = (snapshot && snapshot.data) || snapshot || { customer_id: customerId, city: '' };

    // ── Fallback chain when the live Bank API returned nothing:
    //   1) bank/data/*.json (local bank dataset)
    //   2) Synthetic data derived from server/data/customers.json
    //      (the orchestrator's own customer profiles — for CUST-001
    //      IDs that don't exist in the bank data files)
    const useLocal = !allTxns.length && !notesList.length && !cardTxns.length;
    if (useLocal) {
        const localCard   = _localCardsForCustomer(customerId);
        const localCore   = _localTxnsForCustomer(customerId);
        const localSalary = _localSalaryForCustomer(customerId);
        const localNotes  = _localCrmForCustomer(customerId);
        const localLogins = _localLoginsForCustomer(customerId);
        if (localCard.length || localCore.length) {
            const allLocal = [...localCore, ...localCard];
            const orch = dataStore.CUSTOMERS_MAP[customerId] || {};
            const localSnap = {
                customer_id: customerId,
                city: orch.city || orch.segment || 'Mumbai',
            };
            return {
                sr_transaction:        _build_sr_transaction(allLocal, localSnap),
                sa_ewma_recency:       _build_sa_ewma_recency(allLocal, localSnap),
                cusum_salary:          _build_cusum_salary(localSalary, localSnap),
                beta_cusum_sentiment:  _build_beta_cusum_sentiment(localNotes, localSnap),
                ewma_engagement:       _build_ewma_engagement(localLogins, localSnap),
                cfsi_stress:           _build_cfsi_stress(localCard, localSnap),
                location_rule:         _build_location_rule(localCard, localSnap),
                lifecycle_mcc:         _build_lifecycle_mcc(localCard, localSnap),
                rci_market:            _build_rci_market(localSnap),
            };
        }

        // Final fallback: synthetic data from orchestrator's customer profile.
        const synth = _synthTxnsForCustomer(customerId);
        if (synth.txns.length || synth.cardTxns.length || synth.notes.length) {
            const allLocal = [...synth.txns, ...synth.cardTxns];
            return {
                sr_transaction:        _build_sr_transaction(allLocal, synth.snap),
                sa_ewma_recency:       _build_sa_ewma_recency(allLocal, synth.snap),
                cusum_salary:          _build_cusum_salary(synth.salary, synth.snap),
                beta_cusum_sentiment:  _build_beta_cusum_sentiment(synth.notes, synth.snap),
                ewma_engagement:       _build_ewma_engagement(synth.logins, synth.snap),
                cfsi_stress:           _build_cfsi_stress(synth.cardTxns, synth.snap),
                location_rule:         _build_location_rule(synth.cardTxns, synth.snap),
                lifecycle_mcc:         _build_lifecycle_mcc(synth.cardTxns, synth.snap),
                rci_market:            _build_rci_market(synth.snap),
            };
        }
    }

    return {
        sr_transaction:        _build_sr_transaction(allTxns, snap),
        sa_ewma_recency:       _build_sa_ewma_recency(allTxns, snap),
        cusum_salary:          _build_cusum_salary(salaryTxns, snap),
        beta_cusum_sentiment:  _build_beta_cusum_sentiment(notesList, snap),
        ewma_engagement:       _build_ewma_engagement(loginList, snap),
        cfsi_stress:           _build_cfsi_stress(cardTxns, snap),
        location_rule:         _build_location_rule(cardTxns, snap),
        lifecycle_mcc:         _build_lifecycle_mcc(cardTxns, snap),
        rci_market:            _build_rci_market(snap),
    };
}

module.exports = { buildHeraldData };
