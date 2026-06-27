/**
 * /api/rights — DPDPA 2023 data subject rights: export, correct, erase.
 * Consent management: DPDPA + TRAI grant/revoke + opt-out.
 * DPDPA 2023 §12–§16 — access, correction, erasure, grievance.
 * GDPR Article 15–17 — access, rectification, erasure (mapped where applicable).
 */
const router     = require('express').Router();
const path       = require('path');
const crypto     = require('crypto');
const { verifyToken } = require('../middleware/auth');
const ds         = require('../services/dataStore');
const consentSvc = require('../services/consentService');
const auditLog   = require('../services/auditLogService');
const approvalSvc = require('../services/approvalService');
const { readJson, writeJson, appendToJson } = require('../utils/jsonStore');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const ERASURE_FILE = path.join(DATA_DIR, 'erasureList.json');
const MODEL_APPROVALS_FILE = path.join(DATA_DIR, 'modelApprovals.json');

// ── GET /api/rights/consent?customerId=C-0000001 ─────────────────────────────
router.get('/consent', verifyToken, (req, res) => {
    const customerId = req.query.customerId;
    if (!customerId) return res.status(400).json({ status: 'error', message: 'customerId required' });

    try {
        const consent  = consentSvc.getConsent(customerId);
        const history  = consentSvc.getConsentHistory(customerId);
        const channels = ['EMAIL', 'SMS', 'PUSH'];
        const channelStatus = {};
        for (const ch of channels) {
            channelStatus[ch] = consentSvc.canSendOutreach(customerId, ch);
        }
        res.json({ status: 'ok', consent, history, channelStatus });
    } catch (err) {
        res.status(404).json({ status: 'error', message: err.message });
    }
});

// ── POST /api/rights/consent/dpdpa ───────────────────────────────────────────
router.post('/consent/dpdpa', verifyToken, async (req, res) => {
    const { customerId, grant, purpose } = req.body;
    if (!customerId) return res.status(400).json({ status: 'error', message: 'customerId required' });

    try {
        const actor = req.user?.username || 'system';
        if (grant) {
            consentSvc.grantDpdpaConsent(customerId, purpose || 'outreach', actor);
        } else {
            consentSvc.revokeDpdpaConsent(customerId, actor);
            // Expire any pending approvals when DPDPA consent withdrawn
            await approvalSvc.expireApprovalsForCustomer(customerId);
        }
        await auditLog.logEvent({
            eventType:  grant ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
            customerId,
            actor,
            layer:      'CONSENT',
            payload:    { type: 'DPDPA', grant, purpose },
            modelVersion: 'N/A',
        });
        res.json({ status: 'ok', customerId, dpdpaConsent: grant });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

// ── POST /api/rights/consent/trai ────────────────────────────────────────────
router.post('/consent/trai', verifyToken, async (req, res) => {
    const { customerId, grant, channels } = req.body;
    if (!customerId) return res.status(400).json({ status: 'error', message: 'customerId required' });

    try {
        const actor = req.user?.username || 'system';
        if (grant) {
            consentSvc.grantTraiConsent(customerId, channels || ['SMS', 'EMAIL', 'PUSH'], actor);
        } else {
            consentSvc.revokeTraiConsent(customerId, actor);
            await approvalSvc.expireApprovalsForCustomer(customerId);
        }
        await auditLog.logEvent({
            eventType:  grant ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
            customerId,
            actor,
            layer:      'CONSENT',
            payload:    { type: 'TRAI', grant, channels },
            modelVersion: 'N/A',
        });
        res.json({ status: 'ok', customerId, traiConsent: grant });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

// ── POST /api/rights/optout ───────────────────────────────────────────────────
router.post('/optout', verifyToken, async (req, res) => {
    const { customerId, channel, remove } = req.body;
    if (!customerId || !channel)
        return res.status(400).json({ status: 'error', message: 'customerId and channel required' });

    try {
        const actor = req.user?.username || 'system';
        if (remove) {
            consentSvc.removeOptOut(customerId, channel, actor);
        } else {
            consentSvc.addOptOut(customerId, channel, actor);
        }
        await auditLog.logEvent({
            eventType:  'OPT_OUT_CHANGED',
            customerId,
            actor,
            layer:      'CONSENT',
            payload:    { channel, optedOut: !remove },
            modelVersion: 'N/A',
        });
        res.json({ status: 'ok', customerId, channel, optedOut: !remove });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

// ── GET /api/rights/export?customerId=C-0000001 ──────────────────────────────
// DPDPA 2023 §12 — data principal right to access a summary of personal data processed.
router.get('/export', verifyToken, async (req, res) => {
    const customerId = req.query.customerId;
    if (!customerId) return res.status(400).json({ status: 'error', message: 'customerId required' });

    const actor = req.user?.username || 'system';

    const customer  = ds.getCustomerById(customerId);
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    // Strip sensitive PII fields before export — export purpose is accountability, not surveillance
    const safeCustomer = { ...customer };
    delete safeCustomer.pan;
    delete safeCustomer.aadhaar;
    delete safeCustomer.phone;  // Include only masked version

    let consentRecord, consentHistory;
    try {
        consentRecord  = consentSvc.getConsent(customerId);
        consentHistory = consentSvc.getConsentHistory(customerId);
    } catch {
        consentRecord  = null;
        consentHistory = [];
    }

    const auditEvents = await auditLog.getEventsByCustomer(customerId, { limit: 100 });
    const approvals   = approvalSvc.getPendingApprovals({ customerId });

    const exportPayload = {
        exportGeneratedAt:   new Date().toISOString(),
        exportRequestedBy:   actor,
        legalBasis:          'DPDPA 2023 §12 — Right to Access',
        customerId,
        profile: {
            name:           customer.full_name,
            city:           customer.city,
            segment:        customer.segment,
            tenure_months:  customer.tenure_months,
            phone_masked:   customer.phone ? '****' + customer.phone.slice(-4) : null,
        },
        consent:              consentRecord,
        consentHistory:       consentHistory.slice(0, 20),
        auditLog:             auditEvents.slice(0, 50),
        approvalHistory:      approvals,
        dataCategoriesHeld:  ['profile', 'behavioural_signals', 'churn_score', 'outreach_history', 'consent_log'],
        retentionPolicy:      'Audit logs: 7 years (DPDPA Rule 4). Signals: 2 years. Scores: 2 years.',
    };

    await auditLog.logEvent({
        eventType:    'DATA_ACCESS_REQUEST',
        customerId,
        actor,
        layer:        'RIGHTS',
        payload:      { exportedAt: exportPayload.exportGeneratedAt },
        modelVersion: 'N/A',
    });

    res.json({ status: 'ok', data: exportPayload });
});

// ── PUT /api/rights/correct ───────────────────────────────────────────────────
// DPDPA 2023 §13 — right to correction of inaccurate personal data.
router.put('/correct', verifyToken, async (req, res) => {
    const { customerId, field, oldValue, newValue, reason } = req.body;
    if (!customerId || !field || newValue === undefined)
        return res.status(400).json({ status: 'error', message: 'customerId, field, and newValue required' });

    const ALLOWED_FIELDS = ['city', 'segment', 'email', 'phone', 'full_name', 'age'];
    if (!ALLOWED_FIELDS.includes(field))
        return res.status(400).json({ status: 'error', message: `Field '${field}' is not correctable via this API` });

    const actor = req.user?.username || 'system';

    await auditLog.logEvent({
        eventType:    'DATA_CORRECTION',
        customerId,
        actor,
        layer:        'RIGHTS',
        payload:      {
            field,
            oldValueHash: oldValue ? crypto.createHash('sha256').update(String(oldValue)).digest('hex') : null,
            newValueHash: crypto.createHash('sha256').update(String(newValue)).digest('hex'),
            reason:       reason || 'customer_request',
        },
        modelVersion: 'N/A',
    });

    res.json({
        status:  'ok',
        customerId,
        field,
        message: 'Correction recorded in audit log. In production this triggers a case with DBA team.',
        note:    'DPDPA 2023 §13 — correction request logged. Verification required before applying.',
    });
});

// ── POST /api/rights/erase ────────────────────────────────────────────────────
// DPDPA 2023 §14 — right to erasure. We anonymise, never hard-delete (audit log must be retained).
router.post('/erase', verifyToken, async (req, res) => {
    const { customerId, reason } = req.body;
    if (!customerId) return res.status(400).json({ status: 'error', message: 'customerId required' });

    const actor = req.user?.username || 'system';

    const erasureList = readJson(ERASURE_FILE, []);
    const existing = erasureList.find(e => e.customerId === customerId && e.status !== 'REJECTED');
    if (existing)
        return res.status(409).json({ status: 'error', message: `Erasure already requested (${existing.status})`, erasureId: existing.erasureId });

    const erasureEntry = {
        erasureId:   crypto.randomUUID(),
        customerId,
        requestedBy: actor,
        requestedAt: new Date().toISOString(),
        status:      'PENDING',
        reason:      reason || 'customer_request',
        note:        'DPDPA 2023 §14 — anonymisation pending DPO review. Audit log entries will NOT be deleted (legal retention obligation).',
    };
    erasureList.push(erasureEntry);
    await writeJson(ERASURE_FILE, erasureList);

    // Revoke all consent immediately upon erasure request
    try { consentSvc.revokeDpdpaConsent(customerId, actor); } catch { /* not in consent store */ }
    try { consentSvc.revokeTraiConsent(customerId, actor); } catch { /* not in consent store */ }
    await approvalSvc.expireApprovalsForCustomer(customerId);

    await auditLog.logEvent({
        eventType:    'DATA_DELETION_REQUEST',
        customerId,
        actor,
        layer:        'RIGHTS',
        payload:      { erasureId: erasureEntry.erasureId, reason },
        modelVersion: 'N/A',
    });

    res.json({
        status:     'ok',
        erasureId:  erasureEntry.erasureId,
        customerId,
        message:    'Erasure request accepted. Consent revoked immediately. Anonymisation pending DPO review.',
        note:       'Audit log entries will be retained for 7 years per DPDPA Rule 4.',
    });
});

// ── GET /api/rights/erasure-status?customerId=C-0000001 ──────────────────────
router.get('/erasure-status', verifyToken, (req, res) => {
    const customerId = req.query.customerId;
    if (!customerId) return res.status(400).json({ status: 'error', message: 'customerId required' });
    const list = readJson(ERASURE_FILE, []);
    const entries = list.filter(e => e.customerId === customerId);
    res.json({ status: 'ok', customerId, erasureRequests: entries });
});

module.exports = router;
