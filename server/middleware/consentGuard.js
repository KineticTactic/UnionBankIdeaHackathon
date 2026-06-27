/**
 * consentGuard.js — middleware factory that blocks outreach routes when consent is missing.
 * TRAI TCCCPR 2025 — DCA consent must be verified before commercial communication.
 * DPDPA 2023 §7 — processing requires valid purpose-scoped consent.
 *
 * Usage: router.post('/generate', consentGuard('EMAIL'), handler)
 */

const consentService = require('../services/consentService');
const auditLog       = require('../services/auditLogService');

module.exports = function consentGuard(channel) {
    return async (req, res, next) => {
        const customerId = req.body?.customerId || req.body?.customer_id || req.params?.customerId;
        if (!customerId) return next();

        try {
            const check = consentService.canSendOutreach(customerId, channel);
            if (!check.allowed) {
                await auditLog.logEvent({
                    eventType:    'OUTREACH_BLOCKED',
                    customerId,
                    actor:        req.user?.username || 'system',
                    layer:        'HERALD',
                    payload:      { channel, reason: check.reason },
                    modelVersion: 'N/A',
                });
                return res.status(403).json({
                    error:       'OUTREACH_BLOCKED',
                    reason:      check.reason,
                    customerId,
                    message:     `Outreach on ${channel} blocked: ${check.reason}`,
                });
            }
            next();
        } catch (err) {
            console.error('[ConsentGuard ERROR]', err.message);
            next(); // fail-open to avoid blocking the demo
        }
    };
};
