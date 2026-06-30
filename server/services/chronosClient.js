'use strict';
const config = require('../config');

// ── Circuit-breaker state ─────────────────────────────────────────────────────
const CB = {
    failCount:    0,
    openUntil:    0,
    FAIL_THRESHOLD: 3,
    OPEN_MS:      30_000,
};

function _isOpen() {
    if (CB.openUntil && Date.now() < CB.openUntil) return true;
    if (CB.openUntil && Date.now() >= CB.openUntil) {
        CB.openUntil  = 0;   // half-open: allow one probe
        CB.failCount  = 0;
    }
    return false;
}

function _recordFailure() {
    CB.failCount += 1;
    if (CB.failCount >= CB.FAIL_THRESHOLD) {
        CB.openUntil = Date.now() + CB.OPEN_MS;
        console.warn(`[chronosClient] circuit OPEN for ${CB.OPEN_MS / 1000}s`);
    }
}

function _recordSuccess() {
    CB.failCount = 0;
    CB.openUntil = 0;
}

async function _fetch(path, opts = {}) {
    if (_isOpen()) {
        const err = new Error('CHRONOS circuit open');
        err.circuitOpen = true;
        throw err;
    }
    const url = `${config.chronosBaseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`CHRONOS ${res.status}: ${body}`);
        }
        _recordSuccess();
        return res.json();
    } catch (err) {
        clearTimeout(timer);
        if (!err.circuitOpen) _recordFailure();
        throw err;
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getScores(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return _fetch(`/scores${qs ? '?' + qs : ''}`);
}

async function getScore(customerId) {
    return _fetch(`/scores/${encodeURIComponent(customerId)}`);
}

async function getReasonCodes(customerId) {
    return _fetch(`/scores/${encodeURIComponent(customerId)}/reason-codes`);
}

async function getModelHealth() {
    return _fetch('/model-health');
}

async function getSchedulerStatus() {
    return _fetch('/model-health/scheduler');
}

async function getTokenSequence(customerId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return _fetch(`/scores/${encodeURIComponent(customerId)}/token-sequence${qs ? '?' + qs : ''}`);
}

async function analyzeScore(customerId) {
    return _fetch(`/scores/${encodeURIComponent(customerId)}/analyze`, { method: 'POST' });
}

/**
 * Trigger CHRONOS to re-score a customer live.
 * CHRONOS writes the new score to Postgres; Node picks it up on next read.
 * Falls back gracefully when circuit is open.
 *
 * Note: CHRONOS exposes /scores/:id/analyze (not /rescore).  We call
 * /analyze so the call actually succeeds.
 */
async function rescoreCustomer(customerId) {
    return _fetch(`/scores/${encodeURIComponent(customerId)}/analyze`, { method: 'POST' });
}

/** Expose circuit state for /readyz */
function getCircuitStatus() {
    return {
        open:      _isOpen(),
        failCount: CB.failCount,
        openUntil: CB.openUntil ? new Date(CB.openUntil).toISOString() : null,
    };
}

/**
 * Cold-start risk scoring for newly onboarded customers (no behavioural history).
 * Uses GENESIS (logistic regression, demographic features only).
 * Falls back to a deterministic heuristic if CHRONOS is unavailable.
 */
async function scoreColdStart(profile) {
    // Deterministic fallback — runs without CHRONOS, never crashes the demo.
    function heuristic() {
        const balance     = profile.balance      || 0;
        const products    = profile.product_count|| 1;
        const age         = profile.age          || 35;
        const income      = profile.income       || 500_000;
        const cityTier    = profile.city_tier    || 2;
        const segment     = profile.segment      || 'Mass Market';

        // Base churn: younger, fewer products, lower balance → higher risk
        let score = 0.50
            - (balance   / 10_000_000) * 0.20
            - (products  / 10)         * 0.08
            + ((35 - Math.min(age, 60)) / 100) * 0.05
            - (income    / 5_000_000)  * 0.05
            - (cityTier === 1 ? 0.05 : 0)  // tier-1 cities → slightly more stable
            + ({ HNW: -0.10, 'Mass Affluent': -0.05, SME: 0.02, 'Mass Market': 0.08 }[segment] || 0);

        score = Math.max(0.05, Math.min(0.95, score));
        const risk_tier = score >= 0.70 ? 'PRIORITY'
                        : score >= 0.50 ? 'ESCALATE'
                        : score >= 0.30 ? 'STANDARD'
                        : score >= 0.15 ? 'MONITOR'
                        : 'NONE';
        return { churn_score: +score.toFixed(3), risk_tier, model: 'genesis-heuristic', confidence: 'cold_start' };
    }

    try {
        const mapped = {
            tenure_days:        profile.tenure_days      || 0,
            product_count:      profile.product_count    || 1,
            age_bucket:         profile.age <= 25 ? '18-25' : profile.age <= 35 ? '26-35'
                                : profile.age <= 45 ? '36-45' : profile.age <= 55 ? '46-55' : '55+',
            income_band:        profile.income >= 2_000_000 ? 'high' : profile.income >= 500_000 ? 'mid' : 'low',
            channel_acquisition: profile.channel_acquisition || 'branch',
            credit_score_band:  profile.credit_score_band || 'good',
            city_tier:          profile.city_tier || 2,
        };
        const result = await _fetch('/score/cold-start', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(mapped),
        });
        return { ...result, model: 'genesis', confidence: 'cold_start' };
    } catch (_) {
        return heuristic();
    }
}

module.exports = {
    getScores, getScore, getReasonCodes, getModelHealth,
    getSchedulerStatus, getTokenSequence, analyzeScore,
    rescoreCustomer, getCircuitStatus, scoreColdStart,
};
