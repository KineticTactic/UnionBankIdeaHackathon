'use strict';
/**
 * routes/argus.js — orchestrator → ARGUS bridge.
 *
 * Endpoints
 *   POST /api/argus/evaluate-customer/:id   — full pipeline: bank → ARGUS
 *   GET  /api/argus/evaluate-customer/:id   — same, idempotent alias
 *   GET  /api/argus/signals/:id             — last-evaluated signals (client shape)
 *   GET  /api/argus/state-summary           — admin: tracked customers
 *   POST /api/argus/reset/:id               — admin: drop cached state
 *
 * The shape returned by /signals matches the client TypeScript
 * `Signal` interface exactly:
 *   { signal_type, detected, confidence, cusum_value, alarm_threshold,
 *     method, days_active }
 *
 * ARGUS Python is called via HTTP.  Failures degrade gracefully — the
 * signals endpoint simply returns the last successful evaluation, or an
 * empty list if no evaluation has ever run.
 */

const express  = require('express');
const router   = express.Router();
const http     = require('http');
const config   = require('../config');
const argusState    = require('../services/argusState');
const argusTrans    = require('../services/argusTransformer');
const dataStore     = require('../services/dataStore');
const auditLog      = require('../services/auditLogService');
const { verifyToken } = require('../middleware/auth');

// In-memory cache of last ARGUS evaluation per customer (for GET /signals).
const _lastEval = new Map();   // customer_id -> { evaluated_at, signals, warden, ... }
const MAX_EVAL_CACHE = 500;

// Customers that have been reset and NOT yet re-evaluated.  We use
// this set to suppress the static signals.json fallback so the demo
// flow shows a clean "0 signals" state after reset, instead of
// confusing the user with the pre-seeded demo data.
const _resetCustomers = new Set();

// ── HTTP call to the ARGUS Python shim ─────────────────────────────────────
function callArgus(payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = http.request({
            host: '127.0.0.1',
            port: 8002,
            path: '/evaluate',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 8000,
        }, (resp) => {
            let data = '';
            resp.on('data', (c) => data += c);
            resp.on('end', () => {
                try {
                    if (resp.statusCode === 200) return resolve(JSON.parse(data));
                    return reject(new Error(`ARGUS HTTP ${resp.statusCode}: ${data.slice(0, 200)}`));
                } catch (e) { reject(new Error('ARGUS returned non-JSON: ' + e.message)); }
            });
        });
        req.on('error',   (e) => reject(new Error('ARGUS connection error: ' + (e.code || e.message))));
        req.on('timeout', () => { req.destroy(new Error('ARGUS timeout')); });
        req.write(body);
        req.end();
    });
}

// ── Shape adapter: ARGUS Output → client Signal[] ──────────────────────────
// Maps Python {signal_type, detected, confidence, statistic, threshold,
// method_used, direction, evidence} → client {signal_type, detected,
// confidence, cusum_value, alarm_threshold, method, days_active}.
function _argusToClient(heraldResults, customerId) {
    const now = new Date();
    const list = [];
    for (const [agentType, r] of Object.entries(heraldResults || {})) {
        // Compute days_active from the persisted state in argusState
        // (rises on every re-evaluation of the same customer).
        const bag = argusState.getStates(customerId);
        const state = bag[agentType] || (bag[agentType] = { _first_seen: now.toISOString() });
        const first = new Date(state._first_seen);
        const days_active = Math.max(1, Math.floor((now.getTime() - first.getTime()) / 86_400_000));

        list.push({
            signal_type:     agentType,
            detected:        !!r.detected,
            confidence:      Number(r.confidence ?? 0),
            cusum_value:     Number(r.statistic ?? 0),
            alarm_threshold: Number(r.threshold ?? 0),
            method:          r.method_used || 'unknown',
            days_active,
        });
    }
    return list;
}

// ── POST /api/argus/evaluate-customer/:id ──────────────────────────────────
router.post('/evaluate-customer/:id', verifyToken, async (req, res) => {
    const customerId = req.params.id;
    try {
        // Note: customers can come from either the orchestrator's local
        // store (CUST-001) or the bank API (C-00000001).  We attempt
        // to look up in the orchestrator store as a soft hint, but the
        // real customer data is fetched fresh from the bank API inside
        // argusTransformer.  This lets the bridge evaluate any
        // customer the bank knows about, not just ones pre-seeded in
        // server/data.

        // 2) Build herald_data from bank data.
        let heraldData;
        try {
            heraldData = await argusTrans.buildHeraldData(customerId);
        } catch (e) {
            console.error('[ARGUS-bridge] buildHeraldData failed:', e.message);
            return res.status(502).json({
                error: true, stage: 2, stage_name: 'argus-bridge',
                message: 'Failed to assemble herald_data from Bank API: ' + e.message,
            });
        }

        // 3) Call ARGUS Python service.
        const out = await callArgus({
            customer_id: customerId,
            today:       new Date().toISOString().split('T')[0],
            herald_data: heraldData,
        });

        // 4) Adapt to client Signal shape.
        const clientSignals = _argusToClient(out.herald_results, customerId);

        // 5) Persist the updated state from ARGUS so the next evaluation
        //    sees the same CUSUM/SR/EWMA accumulators instead of starting
        //    from zero.  The Python engine mutates state in place; we
        //    capture the post-evaluation snapshot here.
        if (out.updated_state && typeof out.updated_state === 'object') {
            const bag = argusState.getStates(customerId);
            for (const [agentType, snap] of Object.entries(out.updated_state)) {
                if (snap && typeof snap === 'object') {
                    bag[agentType] = snap;
                }
            }
        }

        // Clear the reset flag — a successful evaluation means the
        // customer now has real signals and the next /signals call
        // should return the ARGUS output.
        _resetCustomers.delete(customerId);

        // 6) Cache the evaluation for /signals GET.
        const evalRec = {
            customer_id:  customerId,
            evaluated_at: out.evaluated_at || new Date().toISOString(),
            signals:      clientSignals,
            warden: {
                alarm:    out.warden_alarm,
                severity: out.warden_severity,
                rejected: out.rejected_tests,
            },
            nexus:   out.nexus_detected,
            oracle:  out.oracle_detected,
            alarm_payload: out.alarm_payload,
            raw_herald: out.herald_results,
        };
        _lastEval.set(customerId, evalRec);
        if (_lastEval.size > MAX_EVAL_CACHE) {
            const first = _lastEval.keys().next().value;
            _lastEval.delete(first);
        }

        // 7) Write detected signals into dataStore so /api/customers/:id/signals
        //    (used by the client tab) returns them.  This is the glue.
        for (const sig of clientSignals) {
            dataStore.applySignalOverride(customerId, sig);
        }

        // 8) Audit log
        auditLog.logEvent({
            eventType:  'ARGUS_EVALUATION',
            customerId,
            actor:      'orchestrator',
            layer:      'ARGUS',
            payload:    {
                detected: clientSignals.filter(s => s.detected).length,
                total:    clientSignals.length,
                severity: out.warden_severity,
            },
            modelVersion: 'ARGUS-v1.0',
        }).catch(err => console.error('[ARGUS-bridge] audit error:', err.message));

        return res.json({
            status: 'ok',
            customer_id: customerId,
            evaluated_at: evalRec.evaluated_at,
            signals:     clientSignals,
            warden:      evalRec.warden,
            nexus:       evalRec.nexus,
            oracle:      evalRec.oracle,
            alarm:       evalRec.alarm_payload,
        });
    } catch (e) {
        console.error('[ARGUS-bridge] evaluation failed:', e.message);
        return res.status(503).json({
            error: true, stage: 2, stage_name: 'argus-bridge',
            message: 'ARGUS service unavailable: ' + e.message,
        });
    }
});

// ── GET /api/argus/evaluate-customer/:id  (idempotent alias) ────────────────
router.get('/evaluate-customer/:id', verifyToken, async (req, res, next) => {
    return router.handle({ ...req, method: 'POST' }, res, next);
});

// ── GET /api/argus/signals/:id ──────────────────────────────────────────────
router.get('/signals/:id', verifyToken, (req, res) => {
    const customerId = req.params.id;
    const evalRec = _lastEval.get(customerId);
    if (!evalRec) {
        return res.json({
            status: 'ok',
            customer_id: customerId,
            signals: [],
            message: 'No ARGUS evaluation has run for this customer yet. POST /api/argus/evaluate-customer/:id to trigger.',
        });
    }
    return res.json({
        status: 'ok',
        customer_id: customerId,
        evaluated_at: evalRec.evaluated_at,
        warden:       evalRec.warden,
        nexus:        evalRec.nexus,
        oracle:       evalRec.oracle,
        signals:      evalRec.signals,
    });
});

// ── GET /api/argus/state-summary (admin) ────────────────────────────────────
router.get('/state-summary', verifyToken, (req, res) => {
    res.json({ status: 'ok', ...argusState.getSummary(), eval_cache_size: _lastEval.size });
});

// ── POST /api/argus/reset/:id (admin) ───────────────────────────────────────
// Wipes the agent state AND the cached evaluation so the customer goes
// back to "no signals" (the next /signals call returns 0 signals
// until a fresh evaluation runs).  This is the clean reset the demo
// flow needs — without it, the client would keep showing stale
// signals from the previous run.
router.post('/reset/:id', verifyToken, (req, res) => {
    argusState.resetStates(req.params.id);
    _lastEval.delete(req.params.id);
    _resetCustomers.add(req.params.id);
    // Also drop the live signal overrides that the previous
    // evaluation wrote to dataStore, so the customer detail endpoint
    // returns the empty (or static) baseline.
    try {
        const kafka = require('../services/kafkaService');
        if (typeof kafka.clearLiveSignals === 'function') {
            kafka.clearLiveSignals(req.params.id);
        }
    } catch (_) { /* kafkaService not loaded */ }
    res.json({
        status: 'ok',
        customer_id: req.params.id,
        message: 'ARGUS state + cached signals cleared — next GET /signals returns 0 until you re-evaluate',
    });
});

// Expose the reset state for the customer route to suppress legacy
// signals after a reset.
module.exports = router;
module.exports.getLastEvaluation = (customerId) => _lastEval.get(customerId);
module.exports.isReset = (id) => _resetCustomers.has(id);

module.exports = router;
module.exports.getLastEvaluation = (customerId) => _lastEval.get(customerId);
