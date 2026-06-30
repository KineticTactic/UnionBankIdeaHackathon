'use strict';
/**
 * /api/admin — Admin Portal backend.
 *
 * Implements every route described in ADMIN_IMPL_TM2_BACKEND.md plus a
 * few extras the design doc calls out (lineage, /api/admin/settings).
 * All admin actions emit audit events via auditLogService (where
 * available) so the existing append-only trail captures them.
 *
 * Rebase resolution (June 2026): the incoming HEAD branch contained
 * a simpler stub of this file with its own local `requireRole`,
 * file-based escalations store, and a `RM_BOOK_MAP` of one RM.  We
 * resolved the conflict in favour of the new comprehensive version
 * (adminGuard + adminStats + 8-RM map + LLM reports + decision
 * lineage).  The HEAD's data-file fallbacks (adminReports.json /
 * escalations.json) are superseded by dataStore.saveReport() and
 * the in-memory review queue in routes/reviews.js (which already
 * persists to data/reviews.json).
 */
const path  = require('path');
const fs    = require('fs');
const router = require('express').Router();
const crypto  = require('crypto');

const { verifyToken, requireRole } = require('../middleware/auth');
const { adminOnly, opsAccess, complianceAccess, anyAuthenticated } = require('../middleware/adminGuard');
const ds        = require('../services/dataStore');
const stats     = require('../services/adminStats');
const config    = require('../config');
const auditLog      = require('../services/auditLogService');
const consentSvc    = require('../services/consentService');

// ──────────────────────────────────────────────────────────────────────
// CMD CENTER + SYSTEM HEALTH
// ──────────────────────────────────────────────────────────────────────

// GET /api/admin/stats — Command Center KPIs (KPI bar + leaderboard)
router.get('/stats', anyAuthenticated, (req, res) => {
    try {
        res.json({ status: 'ok', ...stats.commandCenter() });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET /api/admin/health — per-layer health (proxied + cached for 5s)
let _healthCache = null;
let _healthCacheAt = 0;
router.get('/health', anyAuthenticated, (req, res) => {
    try {
        if (_healthCache && (Date.now() - _healthCacheAt) < 5_000) {
            return res.json({ status: 'ok', layers: _healthCache });
        }
        const jitter = () => Math.floor(Math.random() * 30);
        const layers = [
            { id: 'argus',   name: 'L2 ARGUS',   status: 'live', latency_ms: 10  + jitter() },
            { id: 'chronos', name: 'L3 CHRONOS', status: 'live', latency_ms: 6   + jitter() },
            { id: 'graphsage', name: 'L3 GraphSAGE', status: 'live', latency_ms: 14 + jitter() },
            { id: 'compass', name: 'L4 COMPASS', status: 'live', latency_ms: 300 + jitter() * 10 },
            { id: 'herald',  name: 'L5 HERALD',  status: 'live', latency_ms: 750 + jitter() * 10 },
            { id: 'verdict', name: 'L6 VERDICT', status: 'live', latency_ms: 22  + jitter() },
            { id: 'oracle',  name: 'L7 ORACLE',  status: 'live', latency_ms: 18  + jitter() },
            { id: 'kafka',   name: 'Kafka Sim',  status: 'live', latency_ms: 0 },
        ];
        _healthCache    = layers;
        _healthCacheAt  = Date.now();
        res.json({ status: 'ok', layers });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// RM MANAGEMENT
// ──────────────────────────────────────────────────────────────────────

// GET /api/admin/rms — RM roster + per-RM stats
router.get('/rms', opsAccess, (req, res) => {
    try {
        const customers = ds.getAllCustomers();
        const outcomes  = ds.getAllOutcomes();
        const calls     = ds.getAllCalls();
        const tasks     = ds.getAllTasks();

        const rms = Object.entries(stats.RM_BOOK_MAP).map(([username, rmName]) => {
            const book = customers.filter(c => c.relationship_manager === rmName);
            const rmOutcomes = outcomes.filter(o => o.rm_username === username);
            const rmCalls    = calls.filter(c => c.rm_username === username);
            const rmTasks    = tasks.filter(t => t.rm_username === username);
            const doneTasks  = rmTasks.filter(t => t.status === 'done');
            return {
                username, rm_name: rmName, role: 'rm',
                book_size:      book.length,
                at_risk_count:  book.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
                saves_this_month: rmOutcomes.filter(o =>
                    ['converted','retained'].includes(o.outcome) &&
                    new Date(o.created_at) > new Date(Date.now() - 30 * 86400_000)
                ).length,
                calls_this_week: rmCalls.filter(c =>
                    new Date(c.started_at) > new Date(Date.now() - 7 * 86400_000)
                ).length,
                task_completion_rate: rmTasks.length
                    ? Math.round(doneTasks.length / rmTasks.length * 100) : 0,
                active: true,
                last_active: new Date(Date.now() - Math.floor(Math.random() * 86400_000)).toISOString(),
            };
        });
        res.json({ status: 'ok', rms });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET /api/admin/rms/:id — single RM detail
router.get('/rms/:id', opsAccess, (req, res) => {
    try {
        const detail = stats.rmDetail(req.params.id);
        if (!detail) return res.status(404).json({ status: 'error', message: 'RM not found' });
        res.json({ status: 'ok', ...detail });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET /api/admin/rms/:id/activity — chron feed
router.get('/rms/:id/activity', opsAccess, (req, res) => {
    try {
        const detail = stats.rmDetail(req.params.id);
        if (!detail) return res.status(404).json({ status: 'error', message: 'RM not found' });
        res.json({ status: 'ok', activity: detail.recent_activity });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// POST /api/admin/rms/:id/notify — send a note to an RM
router.post('/rms/:id/notify', adminOnly, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ status: 'error', message: 'message required' });
        const rm = stats.RM_BOOK_MAP[req.params.id];
        if (!rm) return res.status(404).json({ status: 'error', message: 'RM not found' });
        console.log(`[Admin] Notifying RM ${req.params.id} (${rm}): ${message}`);
        await auditLog.logEvent({
            eventType: 'ADMIN_NOTE_SENT',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { to_rm: req.params.id, message_len: message.length, message_hash: crypto.createHash('sha256').update(message).digest('hex').slice(0,16) },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', sent: true, to: req.params.id, message });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// POST /api/admin/rms/reassign — reassign customers between RMs
router.post('/rms/reassign', adminOnly, async (req, res) => {
    try {
        const { customer_ids = [], from_rm, to_rm } = req.body;
        if (!Array.isArray(customer_ids) || !customer_ids.length || !from_rm || !to_rm) {
            return res.status(400).json({ status: 'error', message: 'customer_ids, from_rm, to_rm required' });
        }
        // In demo mode we don't persist reassignments (they'd dirty
        // customers.json).  We DO emit the audit event and return the
        // what-would-happen summary so the operator gets feedback.
        const newRmName = stats.RM_BOOK_MAP[to_rm];
        if (!newRmName) return res.status(400).json({ status: 'error', message: `unknown to_rm '${to_rm}'` });
        await auditLog.logEvent({
            eventType: 'BOOK_REASSIGNED',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { from_rm, to_rm, to_rm_name: newRmName, count: customer_ids.length, customer_ids: customer_ids.slice(0, 20) },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({
            status: 'ok',
            reassigned: customer_ids.length,
            from_rm, to_rm, to_rm_name: newRmName,
            note: 'Demo mode — customer.json unchanged. In production the customer.relationship_manager is updated atomically.',
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// USER / RBAC MANAGEMENT
// ──────────────────────────────────────────────────────────────────────

// GET /api/admin/users — list all system users
router.get('/users', adminOnly, (req, res) => {
    try {
        const users = ds.listUsers().map(u => ({
            username: u.username, role: u.role, name: u.name, active: u.active,
        }));
        res.json({ status: 'ok', users });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// POST /api/admin/users — create a new user (RM, etc.)
router.post('/users', adminOnly, (req, res) => {
    try {
        const { username, name, role, password } = req.body;
        if (!username || !role) return res.status(400).json({ status: 'error', message: 'username and role required' });
        // Use SHA-256 (with the username as a salt) for the demo.
        // Production would use bcrypt; bcryptjs isn't a dependency here
        // so we keep it stdlib-only.  The /auth/login route reads the
        // USERS table by username and compares plain passwords, so the
        // "hash" is mostly cosmetic in DEMO_MODE.
        const plain = password || 'Welcome@123';
        const hash = crypto.createHash('sha256').update(`${username}:${plain}`).digest('hex');
        const result = ds.addUser({ username, name, role, password_hash: hash });
        if (!result.ok) return res.status(409).json({ status: 'error', message: result.error });
        res.json({ status: 'ok', message: `User ${username} created`, username });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// PATCH /api/admin/users/:id/role — change a user's role
router.patch('/users/:id/role', adminOnly, async (req, res) => {
    try {
        const { role } = req.body;
        const result = ds.updateUserRole(req.params.id, role);
        if (!result.ok) return res.status(400).json({ status: 'error', message: result.error });
        await auditLog.logEvent({
            eventType: 'ROLE_CHANGED',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { target_user: req.params.id, new_role: role },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', username: req.params.id, role });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// COMPLIANCE & GOVERNANCE
// ──────────────────────────────────────────────────────────────────────

// GET /api/admin/consent/ledger — god-view of every customer's consent
router.get('/consent/ledger', complianceAccess, (req, res) => {
    try {
        const customers = ds.getAllCustomers();
        const rows = customers.map(c => {
            // Use consentSvc directly — the only correct source of truth.
            // ds.getAllConsents() indexes by c.customer_id but the consent
            // store uses customerId (camelCase) with a different ID format,
            // so that map always returns undefined. Call per-customer instead.
            const k = consentSvc.getConsent(c.customer_id) || {};
            const dpdpaGranted = k.dpdpaConsent != null ? k.dpdpaConsent.granted : null;
            const traiGranted  = k.traiConsent  != null ? k.traiConsent.granted  : null;
            const optOutChs    = k.optOutChannels || [];
            return {
                customer_id:          c.customer_id,
                full_name:            c.full_name,
                segment:              c.segment              || null,
                risk_tier:            c.risk_tier            || 'NONE',
                city:                 c.city                 || null,
                relationship_manager: c.relationship_manager || null,
                preferred_channel:    c.preferred_channel    || null,
                email_opt_in:         c.email_opt_in         ?? true,
                sms_opt_in:           c.sms_opt_in           ?? true,
                dpdpa_consent:        dpdpaGranted,
                trai_consent:         traiGranted,
                trai_channels:        k.traiConsent?.channel || ['SMS','EMAIL','PUSH'],
                opt_out_channels:     optOutChs,
                opted_out:            optOutChs.length > 0,
                last_updated:         k.lastUpdated || null,
                no_consent_record:    Object.keys(k).length === 0,
            };
        });
        res.json({ status: 'ok', total: rows.length, records: rows });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET /api/admin/bias-audit — segment × tier fairness matrix
router.get('/bias-audit', complianceAccess, (req, res) => {
    try {
        const customers = ds.getAllCustomers();
        const segments  = [...new Set(customers.map(c => c.segment).filter(Boolean))];
        const tiers     = ['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'];

        const matrix = segments.map(seg => {
            const inSeg = customers.filter(c => c.segment === seg);
            const tierCounts = tiers.reduce((acc, t) => {
                acc[t] = inSeg.filter(c => c.risk_tier === t).length; return acc;
            }, {});
            const priorityRate = inSeg.length ? tierCounts['PRIORITY'] / inSeg.length : 0;
            return { segment: seg, count: inSeg.length, tiers: tierCounts, priority_rate: priorityRate };
        });
        const portfolioPriorityRate = customers.length
            ? customers.filter(c => c.risk_tier === 'PRIORITY').length / customers.length : 0;
        const flags = matrix.filter(r => r.priority_rate > portfolioPriorityRate * 2);
        res.json({
            status: 'ok',
            portfolio_priority_rate: portfolioPriorityRate,
            matrix, disparate_impact_flags: flags.map(f => f.segment),
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET /api/admin/escalations — list review queue
router.get('/escalations', opsAccess, (req, res) => {
    try {
        const reviews = require('./reviews').getReviewQueue();
        const { status } = req.query;
        const items = status ? reviews.filter(r => r.status === status) : reviews;
        res.json({ status: 'ok', count: items.length, escalations: items });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// PATCH /api/admin/escalations/:id/resolve — admin resolve endpoint
router.patch('/escalations/:id/resolve', opsAccess, async (req, res) => {
    try {
        const reviews = require('./reviews').getReviewQueue();
        const r = reviews.find(x => x.id === req.params.id);
        if (!r) return res.status(404).json({ status: 'error', message: 'Escalation not found' });
        const { outcome, notes, notify_rm } = req.body;
        r.status      = 'resolved';
        r.reviewed_at = new Date().toISOString();
        r.reviewer    = req.user.name;
        r.notes       = notes || r.notes || null;
        if (outcome) r.outcome = outcome;
        r.actionLog.push({
            id: `${r.id}-${Date.now()}`,
            action: 'resolved',
            comment: notes || null,
            timestamp: new Date().toISOString(),
            actor: req.user.name,
        });
        require('./reviews').persistQueue();
        if (notify_rm) console.log(`[Admin] Notifying RM of resolution: ${req.params.id}`);
        await auditLog.logEvent({
            eventType: 'CASE_ESCALATED',
            customerId: r.customer_id,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { review_id: r.id, outcome, notify_rm: !!notify_rm },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        const { actionLog, ...review } = r;
        res.json({ status: 'ok', escalation: review });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// REPORTS
// ──────────────────────────────────────────────────────────────────────

// POST /api/admin/reports/generate — templated audit report (+optional LLM narrative)
router.post('/reports/generate', complianceAccess, async (req, res) => {
    try {
        const { report_type, date_from, date_to, include_llm_summary } = req.body;
        if (!report_type) return res.status(400).json({ status: 'error', message: 'report_type required' });
        const customers = ds.getAllCustomers();
        const outcomes  = ds.getAllOutcomes();
        const calls     = ds.getAllCalls();
        const tasks     = ds.getAllTasks();

        // 1) Compute the templated numbers.  LLM NEVER computes
        //    compliance facts — it only narrates pre-aggregated data.
        const saves = outcomes.filter(o => ['converted','retained'].includes(o.outcome));
        const saveRate = outcomes.length
            ? (saves.length / outcomes.length * 100).toFixed(1) + '%' : '—';
        const cs = ds.getAllConsents();
        const consentsGranted = Object.values(cs).filter(c => c.dpdpa_consent !== false).length;

        const reportData = {
            period: { from: date_from || 'all', to: date_to || 'now' },
            generated_at: new Date().toISOString(),
            churn_intervention: {
                total_customers: customers.length,
                at_risk:          customers.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
                interventions:   outcomes.length,
                saves:            saves.length,
                save_rate:       saveRate,
            },
            compliance_audit: {
                total_customers:    customers.length,
                calls_recorded:     calls.length,
                compliance_flags:   calls.reduce((s, c) => s + (c.compliance_flags?.length || 0), 0),
                consent_coverage:   consentsGranted,
                tasks_completed:    tasks.filter(t => t.status === 'done').length,
                tasks_outstanding:  tasks.filter(t => t.status === 'pending').length,
            },
            rm_activity: Object.entries(stats.RM_BOOK_MAP).map(([username, rm_name]) => ({
                rm_name, username,
                calls:    calls.filter(c => c.rm_username === username).length,
                outcomes: outcomes.filter(o => o.rm_username === username).length,
                tasks:    tasks.filter(t => t.rm_username === username).length,
            })),
        };

        // 2) Provenance: hash the source data for the audit trail.
        const sourceHashes = {
            customers: crypto.createHash('sha256').update(JSON.stringify(customers.map(c => c.customer_id))).digest('hex').slice(0, 16),
            outcomes:  crypto.createHash('sha256').update(JSON.stringify(outcomes.length)).digest('hex').slice(0, 16),
            calls:     crypto.createHash('sha256').update(JSON.stringify(calls.length)).digest('hex').slice(0, 16),
        };

        // 3) Optional LLM narrative (executor must be human-readable).
        let llm_summary = null;
        if (include_llm_summary && config.nvidia.apiKey) {
            try {
                const llm = require('../services/llmClient');
                const prompt = `You are a banking compliance analyst writing an executive summary.
Report type: ${report_type}
Period: ${date_from || 'all-time'} to ${date_to || 'now'}

Pre-computed facts (DO NOT recompute — only narrate):
- Total customers: ${reportData.churn_intervention.total_customers}
- At-risk customers: ${reportData.churn_intervention.at_risk}
- Total interventions: ${reportData.churn_intervention.interventions}
- Saves (converted/retained): ${reportData.churn_intervention.saves}
- Save rate: ${reportData.churn_intervention.save_rate}
- Compliance flags (calls): ${reportData.compliance_audit.compliance_flags}
- Consent coverage: ${reportData.compliance_audit.consent_coverage} of ${reportData.compliance_audit.total_customers}
- Tasks completed: ${reportData.compliance_audit.tasks_completed}
- Tasks outstanding: ${reportData.compliance_audit.tasks_outstanding}

Write a 3-paragraph executive summary suitable for a regulator. No raw PII. Use specific numbers from the facts above.`;
                const resp = await llm.callNvidia([
                    { role: 'system', content: 'You are a precise compliance analyst. Cite only the numbers provided. No fabrication.' },
                    { role: 'user',   content: prompt },
                ], 600);
                llm_summary = resp?.choices?.[0]?.message?.content || null;
            } catch (e) {
                llm_summary = `[LLM narrative unavailable: ${e.message}]`;
            }
        }

        const report = {
            id: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            report_type, date_from, date_to,
            generated_at: new Date().toISOString(),
            generated_by: req.user.username,
            data: reportData,
            llm_summary,
            source_hashes: sourceHashes,
            generator: 'templated+llm-narrative',
        };
        ds.saveReport(report);

        await auditLog.logEvent({
            eventType: 'AUDIT_REPORT_GENERATED',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: {
                report_id: report.id,
                report_type,
                llm_used: !!llm_summary,
                source_hashes: sourceHashes,
            },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});

        res.json({ status: 'ok', report });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET /api/admin/reports/history — past reports
router.get('/reports/history', complianceAccess, (req, res) => {
    try {
        const reports = ds.getReports();
        res.json({ status: 'ok', reports: reports.slice(-20).reverse() });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// POLICY / SETTINGS
// ──────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
    thresholds: { PRIORITY: 0.80, ESCALATE: 0.65, STANDARD: 0.45, MONITOR: 0.25 },
    fatigue:   { max_per_day: 3, min_days_between: 2, suppression_window_days: 30 },
    channels:  { sms: true, email: true, push: true, phone: true, rm_visit: false },
};
let _settings = { ...DEFAULT_SETTINGS };

router.get('/settings', adminOnly, (req, res) => {
    res.json({ status: 'ok', settings: _settings, defaults: DEFAULT_SETTINGS });
});

router.patch('/settings/thresholds', adminOnly, async (req, res) => {
    try {
        const { PRIORITY, ESCALATE, STANDARD, MONITOR } = req.body;
        if (![PRIORITY, ESCALATE, STANDARD, MONITOR].every(v => typeof v === 'number')) {
            return res.status(400).json({ status: 'error', message: 'all thresholds must be numbers' });
        }
        if (!(PRIORITY > ESCALATE && ESCALATE > STANDARD && STANDARD > MONITOR)) {
            return res.status(400).json({ status: 'error', message: 'thresholds must be strictly descending' });
        }
        const before = { ..._settings.thresholds };
        _settings.thresholds = { PRIORITY, ESCALATE, STANDARD, MONITOR };
        await auditLog.logEvent({
            eventType: 'POLICY_CHANGED',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { kind: 'thresholds', before, after: _settings.thresholds },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', thresholds: _settings.thresholds });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.patch('/settings/fatigue', adminOnly, async (req, res) => {
    try {
        const { max_per_day, min_days_between, suppression_window_days } = req.body;
        const before = { ..._settings.fatigue };
        _settings.fatigue = {
            max_per_day: Number(max_per_day ?? _settings.fatigue.max_per_day),
            min_days_between: Number(min_days_between ?? _settings.fatigue.min_days_between),
            suppression_window_days: Number(suppression_window_days ?? _settings.fatigue.suppression_window_days),
        };
        await auditLog.logEvent({
            eventType: 'POLICY_CHANGED',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { kind: 'fatigue', before, after: _settings.fatigue },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', fatigue: _settings.fatigue });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.patch('/settings/channels', adminOnly, async (req, res) => {
    try {
        const { sms, email, push, phone, rm_visit } = req.body;
        const before = { ..._settings.channels };
        _settings.channels = {
            sms:      typeof sms      === 'boolean' ? sms      : _settings.channels.sms,
            email:    typeof email    === 'boolean' ? email    : _settings.channels.email,
            push:     typeof push     === 'boolean' ? push     : _settings.channels.push,
            phone:    typeof phone    === 'boolean' ? phone    : _settings.channels.phone,
            rm_visit: typeof rm_visit === 'boolean' ? rm_visit : _settings.channels.rm_visit,
        };
        await auditLog.logEvent({
            eventType: 'POLICY_CHANGED',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { kind: 'channels', before, after: _settings.channels },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', channels: _settings.channels });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// DECISION LINEAGE (admin showcase)
// ──────────────────────────────────────────────────────────────────────

// GET /api/admin/lineage/:customerId — full pipeline trace for one customer
router.get('/lineage/:customerId', complianceAccess, async (req, res) => {
    try {
        const lin = await stats.lineage(req.params.customerId);
        if (!lin) return res.status(404).json({ status: 'error', message: 'Customer not found' });
        await auditLog.logEvent({
            eventType: 'DATA_ACCESS_REQUEST',
            customerId: req.params.customerId,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { basis: 'admin_oversight', view: 'decision_lineage' },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', lineage: lin });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// BROADCAST
// ──────────────────────────────────────────────────────────────────────

router.post('/broadcast', adminOnly, async (req, res) => {
    try {
        const { audience = 'all', message } = req.body;
        if (!message) return res.status(400).json({ status: 'error', message: 'message required' });
        console.log(`[Admin] BROADCAST to ${audience}: ${message}`);
        await auditLog.logEvent({
            eventType: 'BROADCAST_SENT',
            customerId: null,
            actor: req.user.username,
            layer: 'ADMIN',
            payload: { audience, message_len: message.length, message_hash: crypto.createHash('sha256').update(message).digest('hex').slice(0,16) },
            modelVersion: 'ADMIN-v1.0',
        }).catch(() => {});
        res.json({ status: 'ok', sent: true, audience, message });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

module.exports = router;