/**
 * retentionService.js — data retention scheduler.
 * DPDPA 2023 + RBI data governance: signals/scores archived after 2 years,
 * audit logs retained 7 years (CANNOT be deleted — legal obligation).
 */

const path = require('path');
const { readJson, writeJson, appendToJson } = require('../utils/jsonStore');
const auditLog = require('./auditLogService');
const compliance = require('../config/compliance');

const DATA_DIR       = path.join(__dirname, '..', 'data');
const RETENTION_LOG  = path.join(DATA_DIR, 'retentionLog.json');

function isExpired(timestamp, retentionDays) {
    if (!timestamp) return false;
    const age = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return age > retentionDays;
}

async function archiveExpiredApprovals() {
    const file = path.join(DATA_DIR, 'pendingApprovals.json');
    const approvals = readJson(file, []);
    let archived = 0;
    for (const a of approvals) {
        if (['EXPIRED', 'REJECTED'].includes(a.status) && !a.archived &&
            isExpired(a.reviewedAt || a.expiresAt, compliance.approvalRetentionDays)) {
            a.archived   = true;
            a.archivedAt = new Date().toISOString();
            archived++;
        }
    }
    if (archived > 0) await writeJson(file, approvals);
    return archived;
}

async function runRetentionCheck() {
    console.log('[RetentionService] Running retention check...');
    const summary = { checkedAt: new Date().toISOString(), archived: {}, errors: [] };

    try {
        summary.archived.approvals = await archiveExpiredApprovals();
    } catch (err) {
        console.error('[RetentionService ERROR] approvals:', err.message);
        summary.errors.push({ category: 'approvals', error: err.message });
    }

    // DPDPA Rule 4 — audit log entries are NEVER archived or deleted (7-year legal retention)
    summary.note = 'Audit log entries are retained permanently per DPDPA Rule 4 legal obligation.';

    await appendToJson(RETENTION_LOG, summary);
    await auditLog.logEvent({ eventType: 'RETENTION_CHECK', actor: 'system', layer: 'SYSTEM', payload: summary });

    console.log('[RetentionService] Retention check complete:', summary.archived);
    return summary;
}

function scheduleRetentionChecks() {
    // Run once on startup, then every 24 hours
    setTimeout(async () => {
        try { await runRetentionCheck(); } catch (e) { console.error('[RetentionService ERROR]', e.message); }
    }, 10000);

    setInterval(async () => {
        try { await runRetentionCheck(); } catch (e) { console.error('[RetentionService ERROR]', e.message); }
    }, 24 * 60 * 60 * 1000);
}

module.exports = { runRetentionCheck, scheduleRetentionChecks };
