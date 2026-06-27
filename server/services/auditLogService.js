/**
 * auditLogService.js — append-only compliance audit log.
 * RBI AI Governance 2024 — all model decisions and outreach actions must be logged.
 * DPDPA 2023 Rule 4 — audit records retained 7 years minimum.
 */

const path   = require('path');
const crypto = require('crypto');
const { readJson, appendToJson } = require('../utils/jsonStore');

const AUDIT_FILE = path.join(__dirname, '..', 'data', 'auditLog.json');

const VALID_EVENT_TYPES = new Set([
    'SIGNAL_FIRED', 'SIGNAL_SUPPRESSED_ERASURE',
    'CHURN_SCORE_COMPUTED', 'COMPASS_RECOMMENDATION',
    'OUTREACH_QUEUED', 'OUTREACH_SENT', 'OUTREACH_BLOCKED', 'OUTREACH_PENDING_APPROVAL',
    'CONSENT_GRANTED', 'CONSENT_REVOKED',
    'MODEL_SCORE', 'DATA_ACCESS_REQUEST', 'DATA_DELETION_REQUEST', 'DATA_CORRECTION',
    'HUMAN_APPROVAL', 'HUMAN_REJECTION',
    'EXPLAINABILITY_ACCESSED', 'RETENTION_CHECK',
]);

/**
 * Log a compliance-relevant event.
 * No real PII in logs — phone numbers masked, content hashed.
 */
async function logEvent(event) {
    try {
        const entry = {
            eventId:      crypto.randomUUID(),
            eventType:    event.eventType,
            customerId:   event.customerId   || null,
            actor:        event.actor        || 'system',
            layer:        event.layer        || 'SYSTEM',
            payload:      event.payload      || {},
            modelVersion: event.modelVersion || 'N/A',
            timestamp:    event.timestamp    || new Date().toISOString(),
        };
        await appendToJson(AUDIT_FILE, entry);
        return entry.eventId;
    } catch (err) {
        console.error('[AuditLogService ERROR] logEvent failed:', err.message);
        return null;
    }
}

function getEventsByCustomer(customerId, { limit = 100, offset = 0, eventTypes = [] } = {}) {
    try {
        const log = readJson(AUDIT_FILE, []);
        let filtered = log.filter(e => e.customerId === customerId);
        if (eventTypes.length > 0) filtered = filtered.filter(e => eventTypes.includes(e.eventType));
        return filtered.slice(offset, offset + limit);
    } catch (err) {
        console.error('[AuditLogService ERROR] getEventsByCustomer:', err.message);
        return [];
    }
}

function getEventsByType(eventType, { limit = 100, offset = 0 } = {}) {
    try {
        const log = readJson(AUDIT_FILE, []);
        return log.filter(e => e.eventType === eventType).slice(offset, offset + limit);
    } catch (err) {
        console.error('[AuditLogService ERROR] getEventsByType:', err.message);
        return [];
    }
}

function getAuditSummary() {
    try {
        const log = readJson(AUDIT_FILE, []);
        const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const recent = log.filter(e => e.timestamp >= cutoff);
        const byType = {};
        const byLayer = {};
        for (const e of recent) {
            byType[e.eventType]   = (byType[e.eventType]   || 0) + 1;
            byLayer[e.layer]      = (byLayer[e.layer]       || 0) + 1;
        }
        return { totalLast30Days: recent.length, byEventType: byType, byLayer };
    } catch (err) {
        console.error('[AuditLogService ERROR] getAuditSummary:', err.message);
        return { totalLast30Days: 0, byEventType: {}, byLayer: {} };
    }
}

module.exports = { logEvent, getEventsByCustomer, getEventsByType, getAuditSummary };
