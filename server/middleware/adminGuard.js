'use strict';
/**
 * Admin route-guard chains (re-exported from `middleware/auth.js`).
 *
 * Three tiers:
 *   • adminOnly         — admin only.  Provisions, RBAC, policy.
 *   • opsAccess         — admin + manager.  RM roster, escalations, approvals.
 *   • complianceAccess  — admin + manager + risk.  Consent ledger, bias audit,
 *                         audit reports, command center KPIs.
 *
 * The middleware enforces the tiers server-side; the frontend's RBAC is
 * presentational only.  This is a strict invariant of the platform
 * (RBI AI Governance 2024 §8 + DPDPA §6/§8).
 */
const { verifyToken, requireRole } = require('./auth');

const adminOnly        = [verifyToken, requireRole('admin')];
const opsAccess        = [verifyToken, requireRole('admin', 'manager')];
const complianceAccess = [verifyToken, requireRole('admin', 'manager', 'risk')];

// Read-only access for any authenticated user (used by the Command
// Center's KPI strip — everyone signed in can see aggregate numbers).
const anyAuthenticated  = [verifyToken];

module.exports = { adminOnly, opsAccess, complianceAccess, anyAuthenticated };
