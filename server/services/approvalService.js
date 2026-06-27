/**
 * approvalService.js — human-in-the-loop approval gate for HERALD outreach.
 * RBI AI Governance 2024 — Human override required before adverse customer-facing AI actions.
 * GDPR Article 22 — right not to be subject to solely automated decisions.
 */

const path   = require('path');
const crypto = require('crypto');
const { readJson, writeJson } = require('../utils/jsonStore');
const auditLog = require('./auditLogService');
const compliance = require('../config/compliance');

const APPROVALS_FILE = path.join(__dirname, '..', 'data', 'pendingApprovals.json');

function loadApprovals() { return readJson(APPROVALS_FILE, []); }
function saveApprovals(list) { return writeJson(APPROVALS_FILE, list); }

async function createApprovalRequest(customerId, requestedBy, compassRecommendation, heraldContent) {
    const approvals = loadApprovals();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + compliance.approvalExpiryHours * 3600 * 1000).toISOString();

    const entry = {
        approvalId:             crypto.randomUUID(),
        customerId,
        requestedBy,
        requestedAt:            now.toISOString(),
        status:                 'PENDING',
        compassRecommendation:  compassRecommendation || {},
        heraldContent:          heraldContent         || {},
        reviewedBy:             null,
        reviewedAt:             null,
        rejectionReason:        null,
        expiresAt,
    };

    approvals.push(entry);
    await saveApprovals(approvals);

    await auditLog.logEvent({
        eventType:    'OUTREACH_PENDING_APPROVAL',
        customerId,
        actor:        requestedBy,
        layer:        'HERALD',
        payload:      { approvalId: entry.approvalId, channel: compassRecommendation?.channel },
        modelVersion: 'HERALD-v1.0',
    });

    return entry.approvalId;
}

async function approveOutreach(approvalId, reviewedBy) {
    const approvals = loadApprovals();
    const idx = approvals.findIndex(a => a.approvalId === approvalId);
    if (idx < 0) throw new Error(`Approval ${approvalId} not found`);

    const entry = approvals[idx];
    if (entry.status !== 'PENDING') throw new Error(`Approval already ${entry.status}`);
    if (new Date() > new Date(entry.expiresAt)) {
        entry.status = 'EXPIRED';
        await saveApprovals(approvals);
        throw new Error('Approval has expired');
    }

    entry.status     = 'APPROVED';
    entry.reviewedBy = reviewedBy;
    entry.reviewedAt = new Date().toISOString();
    await saveApprovals(approvals);

    await auditLog.logEvent({
        eventType:    'HUMAN_APPROVAL',
        customerId:   entry.customerId,
        actor:        reviewedBy,
        layer:        'HERALD',
        payload:      { approvalId },
        modelVersion: 'HERALD-v1.0',
    });

    return entry;
}

async function rejectOutreach(approvalId, reviewedBy, rejectionReason) {
    if (!rejectionReason) throw new Error('rejectionReason is required');
    const approvals = loadApprovals();
    const idx = approvals.findIndex(a => a.approvalId === approvalId);
    if (idx < 0) throw new Error(`Approval ${approvalId} not found`);

    const entry = approvals[idx];
    if (entry.status !== 'PENDING') throw new Error(`Approval already ${entry.status}`);

    entry.status          = 'REJECTED';
    entry.reviewedBy      = reviewedBy;
    entry.reviewedAt      = new Date().toISOString();
    entry.rejectionReason = rejectionReason;
    await saveApprovals(approvals);

    await auditLog.logEvent({
        eventType:    'HUMAN_REJECTION',
        customerId:   entry.customerId,
        actor:        reviewedBy,
        layer:        'HERALD',
        payload:      { approvalId, rejectionReason },
        modelVersion: 'HERALD-v1.0',
    });

    return entry;
}

function getPendingApprovals(filters = {}) {
    const approvals = loadApprovals();
    let list = [...approvals];
    if (filters.customerId) list = list.filter(a => a.customerId  === filters.customerId);
    if (filters.requestedBy)list = list.filter(a => a.requestedBy === filters.requestedBy);
    if (filters.status)     list = list.filter(a => a.status      === filters.status);
    return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

async function expireStaleApprovals() {
    const approvals = loadApprovals();
    const now = new Date().toISOString();
    let changed = false;
    for (const a of approvals) {
        if (a.status === 'PENDING' && a.expiresAt < now) {
            a.status = 'EXPIRED';
            changed = true;
        }
    }
    if (changed) await saveApprovals(approvals);
}

function getApprovalById(approvalId) {
    const approvals = loadApprovals();
    return approvals.find(a => a.approvalId === approvalId) || null;
}

async function expireApprovalsForCustomer(customerId) {
    const approvals = loadApprovals();
    let changed = false;
    for (const a of approvals) {
        if (a.customerId === customerId && a.status === 'PENDING') {
            a.status = 'EXPIRED';
            changed = true;
        }
    }
    if (changed) await saveApprovals(approvals);
}

module.exports = {
    createApprovalRequest,
    approveOutreach,
    rejectOutreach,
    getPendingApprovals,
    expireStaleApprovals,
    getApprovalById,
    expireApprovalsForCustomer,
};
