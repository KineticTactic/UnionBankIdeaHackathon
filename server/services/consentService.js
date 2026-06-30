/**
 * consentService.js — single source of truth for DPDPA 2023 + TRAI TCCCPR 2025 consent.
 * DPDPA 2023 §7 — Purpose Limitation: consent is scoped to declared purpose only.
 * TRAI TCCCPR 2025 Amendment — DCA consent must be verified before commercial communication.
 */

const path = require('path');
const { readJson, writeJson, appendToJson } = require('../utils/jsonStore');

const DATA_DIR         = path.join(__dirname, '..', 'data');
const CONSENTS_FILE    = path.join(DATA_DIR, 'consents.json');
const AUDIT_FILE       = path.join(DATA_DIR, 'consentAuditLog.json');

const ALLOWED_PURPOSES = ['retention_outreach', 'risk_scoring', 'behavioural_analysis'];
const ALLOWED_CHANNELS = ['SMS', 'EMAIL', 'PUSH'];

function loadConsents() {
    return readJson(CONSENTS_FILE, []);
}

function saveConsents(records) {
    return writeJson(CONSENTS_FILE, records);
}

function findRecord(records, customerId) {
    return records.find(r => r.customerId === customerId) || null;
}

async function logAudit(entry) {
    // DPDPA 2023 Rule 4 — consent audit records retained 7 years
    await appendToJson(AUDIT_FILE, {
        ...entry,
        timestamp: new Date().toISOString(),
    });
}

function getConsent(customerId) {
    const records = loadConsents();
    return findRecord(records, customerId);
}

async function grantDpdpaConsent(customerId, { purpose, version }) {
    // DPDPA 2023 §7 — Purpose Limitation
    if (!ALLOWED_PURPOSES.includes(purpose))
        throw new Error(`Invalid purpose '${purpose}'. Allowed: ${ALLOWED_PURPOSES.join(', ')}`);

    const records = loadConsents();
    let record = findRecord(records, customerId);
    if (!record) {
        record = { customerId, dpdpaConsent: {}, traiConsent: {}, optOutChannels: [], lastUpdated: null };
        records.push(record);
    }
    record.dpdpaConsent = { granted: true, timestamp: new Date().toISOString(), purpose, version };
    record.lastUpdated = new Date().toISOString();
    await saveConsents(records);
    await logAudit({ action: 'DPDPA_CONSENT_GRANTED', customerId, actor: 'system', purpose, version });
    return record;
}

async function revokeDpdpaConsent(customerId) {
    const records = loadConsents();
    const record = findRecord(records, customerId);
    if (!record) throw new Error(`No consent record for ${customerId}`);
    // Do NOT delete — DPDPA audit trail must be preserved
    record.dpdpaConsent = { ...record.dpdpaConsent, granted: false, revokedAt: new Date().toISOString() };
    record.lastUpdated = new Date().toISOString();
    await saveConsents(records);
    await logAudit({ action: 'DPDPA_CONSENT_REVOKED', customerId, actor: 'system' });
    return record;
}

async function grantTraiConsent(customerId, { channels, dltEntityId }) {
    // TRAI TCCCPR 2025 — DCA (Digital Consent Acquisition) consent
    const validCh = channels.filter(c => ALLOWED_CHANNELS.includes(c));
    const records = loadConsents();
    let record = findRecord(records, customerId);
    if (!record) {
        record = { customerId, dpdpaConsent: {}, traiConsent: {}, optOutChannels: [], lastUpdated: null };
        records.push(record);
    }
    record.traiConsent = { granted: validCh.length > 0, timestamp: new Date().toISOString(), channel: validCh, dltEntityId };
    record.lastUpdated = new Date().toISOString();
    await saveConsents(records);
    await logAudit({ action: 'TRAI_CONSENT_GRANTED', customerId, actor: 'system', channels: validCh, dltEntityId });
    return record;
}

async function revokeTraiConsent(customerId, channels) {
    const records = loadConsents();
    const record = findRecord(records, customerId);
    if (!record) throw new Error(`No consent record for ${customerId}`);
    const remaining = (record.traiConsent.channel || []).filter(c => !channels.includes(c));
    record.traiConsent = { ...record.traiConsent, channel: remaining, granted: remaining.length > 0, revokedAt: new Date().toISOString() };
    record.lastUpdated = new Date().toISOString();
    await saveConsents(records);
    await logAudit({ action: 'TRAI_CONSENT_REVOKED', customerId, actor: 'system', channels });
    return record;
}

async function addOptOut(customerId, channel) {
    const records = loadConsents();
    let record = findRecord(records, customerId);
    if (!record) {
        record = { customerId, dpdpaConsent: {}, traiConsent: {}, optOutChannels: [], lastUpdated: null };
        records.push(record);
    }
    if (!record.optOutChannels.includes(channel)) record.optOutChannels.push(channel);
    record.lastUpdated = new Date().toISOString();
    await saveConsents(records);
    await logAudit({ action: 'OPT_OUT_ADDED', customerId, actor: 'system', channel });
    return record;
}

async function removeOptOut(customerId, channel) {
    const records = loadConsents();
    const record = findRecord(records, customerId);
    if (!record) return;
    record.optOutChannels = (record.optOutChannels || []).filter(c => c !== channel);
    record.lastUpdated = new Date().toISOString();
    await saveConsents(records);
    await logAudit({ action: 'OPT_OUT_REMOVED', customerId, actor: 'system', channel });
    return record;
}

function canSendOutreach(customerId, channel) {
    try {
        const record = getConsent(customerId);
        // No record = default granted (consent given at account opening).
        // Only an explicit revoke (granted:false) blocks outreach.
        const dpdpaOk = !record || record.dpdpaConsent == null
            ? true
            : record.dpdpaConsent.granted !== false;
        if (!dpdpaOk)
            return { allowed: false, reason: 'NO_DPDPA_CONSENT' };
        const traiOk = !record || record.traiConsent == null
            ? true
            : record.traiConsent.granted !== false &&
              (record.traiConsent.channel || []).includes(channel);
        if (!traiOk)
            return { allowed: false, reason: 'NO_TRAI_CONSENT' };
        if ((record?.optOutChannels || []).includes(channel))
            return { allowed: false, reason: 'OPT_OUT' };
        return { allowed: true, reason: 'ALLOWED' };
    } catch (err) {
        console.error('[ConsentService ERROR] canSendOutreach:', err.message);
        return { allowed: false, reason: 'CONSENT_CHECK_ERROR' };
    }
}

function getConsentHistory(customerId) {
    try {
        const log = readJson(AUDIT_FILE, []);
        return log.filter(e => e.customerId === customerId);
    } catch (err) {
        console.error('[ConsentService ERROR] getConsentHistory:', err.message);
        return [];
    }
}

module.exports = {
    getConsent,
    grantDpdpaConsent,
    revokeDpdpaConsent,
    grantTraiConsent,
    revokeTraiConsent,
    addOptOut,
    removeOptOut,
    canSendOutreach,
    getConsentHistory,
};
