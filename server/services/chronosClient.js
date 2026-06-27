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
 */
async function rescoreCustomer(customerId) {
    return _fetch(`/scores/${encodeURIComponent(customerId)}/rescore`, { method: 'POST' });
}

/** Expose circuit state for /readyz */
function getCircuitStatus() {
    return {
        open:      _isOpen(),
        failCount: CB.failCount,
        openUntil: CB.openUntil ? new Date(CB.openUntil).toISOString() : null,
    };
}

module.exports = {
    getScores, getScore, getReasonCodes, getModelHealth,
    getSchedulerStatus, getTokenSequence, analyzeScore,
    rescoreCustomer, getCircuitStatus,
};
