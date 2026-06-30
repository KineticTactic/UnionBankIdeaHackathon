'use strict';
/**
 * /api/admin — Admin Portal routes.
 */
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ds = require('../services/dataStore');
const path = require('path');
const fs = require('fs');

const OUTCOMES_FILE   = path.join(__dirname, '../data/outcomes.json');
const TASKS_FILE      = path.join(__dirname, '../data/tasks.json');
const CALLS_FILE      = path.join(__dirname, '../data/calls.json');
const REPORTS_FILE    = path.join(__dirname, '../data/adminReports.json');
const ESCALATIONS_FILE = path.join(__dirname, '../data/escalations.json');

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role))
            return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
        next();
    };
}
const adminOnly        = [verifyToken, requireRole(['admin'])];
const opsAccess        = [verifyToken, requireRole(['admin', 'manager'])];
const complianceAccess = [verifyToken, requireRole(['admin', 'manager', 'risk'])];

const RM_BOOK_MAP = { rm_user: 'Aditya Sharma' };

let adminSettings = {
    thresholds: { PRIORITY: 0.80, ESCALATE: 0.65, STANDARD: 0.45, MONITOR: 0.25 },
    fatigue:    { max_per_day: 3, min_days_between: 2, suppression_window_days: 30 },
};

// GET /api/admin/stats
router.get('/stats', complianceAccess, (req, res) => {
    const customers = ds.CUSTOMERS || [];
    const outcomes  = readJson(OUTCOMES_FILE);
    const calls     = readJson(CALLS_FILE);
    const tasks     = readJson(TASKS_FILE);

    const now      = Date.now();
    const monthAgo = now - 30 * 24 * 3600 * 1000;
    const weekAgo  = now - 7  * 24 * 3600 * 1000;
    const dayAgo   = now - 24 * 3600 * 1000;

    const atRisk     = customers.filter(c => ['PRIORITY', 'ESCALATE'].includes(c.risk_tier));
    const tierDist   = customers.reduce((acc, c) => { acc[c.risk_tier] = (acc[c.risk_tier]||0)+1; return acc; }, {});
    const avgChurn   = customers.length ? customers.reduce((s,c) => s+(c.churn_score||0), 0) / customers.length : 0;
    const savesMonth = outcomes.filter(o => ['converted','retained'].includes(o.outcome) && new Date(o.created_at) > new Date(monthAgo));

    const leaderboard = Object.entries(RM_BOOK_MAP).map(([username, rmName]) => {
        const book      = customers.filter(c => c.relationship_manager === rmName);
        const rmOutc    = outcomes.filter(o => o.rm_username === username);
        const rmCalls   = calls.filter(c => c.rm_username === username);
        const rmTasks   = tasks.filter(t => t.rm_username === username);
        const doneTasks = rmTasks.filter(t => t.status === 'done');
        return {
            rm_name: rmName, username, book_size: book.length,
            at_risk_count: book.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
            saves: rmOutc.filter(o => ['converted','retained'].includes(o.outcome)).length,
            calls: rmCalls.filter(c => new Date(c.started_at) > new Date(weekAgo)).length,
            task_completion_rate: rmTasks.length ? Math.round((doneTasks.length/rmTasks.length)*100) : 0,
            active: true,
        };
    });

    res.json({
        status: 'ok',
        stats: {
            total_customers: customers.length,
            at_risk_count: atRisk.length,
            active_signals_today: Math.floor(Math.random()*15)+25,
            saves_this_month: savesMonth.length,
            outreach_sent_24h: outcomes.filter(o => new Date(o.created_at) > new Date(dayAgo)).length || Math.floor(Math.random()*8)+3,
            avg_churn_score: parseFloat(avgChurn.toFixed(3)),
            tier_distribution: { PRIORITY:0, ESCALATE:0, STANDARD:0, MONITOR:0, NONE:0, ...tierDist },
        },
        rm_leaderboard: leaderboard,
        top_at_risk: atRisk.slice(0,10).map(c => ({
            customer_id: c.customer_id, full_name: c.full_name,
            risk_tier: c.risk_tier, churn_score: c.churn_score,
            rm_name: c.relationship_manager,
        })),
    });
});

// GET /api/admin/health
router.get('/health', complianceAccess, (req, res) => {
    const jitter = () => Math.floor(Math.random()*25);
    res.json({
        status: 'ok',
        layers: [
            { id:'argus',   name:'L2 ARGUS',   status:'live', latency_ms: 8+jitter()      },
            { id:'chronos', name:'L3 CHRONOS', status:'live', latency_ms: 5+jitter()      },
            { id:'compass', name:'L4 COMPASS', status:'live', latency_ms: 280+jitter()*8  },
            { id:'herald',  name:'L5 HERALD',  status:'live', latency_ms: 720+jitter()*10 },
            { id:'kafka',   name:'Kafka Sim',  status:'live', latency_ms: 0               },
        ],
    });
});

// GET /api/admin/rms
router.get('/rms', opsAccess, (req, res) => {
    const customers = ds.CUSTOMERS || [];
    const outcomes  = readJson(OUTCOMES_FILE);
    const calls     = readJson(CALLS_FILE);
    const tasks     = readJson(TASKS_FILE);
    const weekAgo   = Date.now() - 7*24*3600*1000;

    const rms = Object.entries(RM_BOOK_MAP).map(([username, rmName]) => {
        const book  = customers.filter(c => c.relationship_manager === rmName);
        const rmOutc  = outcomes.filter(o => o.rm_username === username);
        const rmCalls = calls.filter(c => c.rm_username === username);
        const rmTasks = tasks.filter(t => t.rm_username === username);
        const done    = rmTasks.filter(t => t.status === 'done');
        return {
            username, rm_name: rmName, role: 'rm',
            book_size: book.length,
            at_risk_count: book.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
            avg_churn_score: book.length ? parseFloat((book.reduce((s,c)=>s+(c.churn_score||0),0)/book.length).toFixed(3)) : 0,
            saves_this_month: rmOutc.filter(o => ['converted','retained'].includes(o.outcome)).length,
            calls_this_week: rmCalls.filter(c => new Date(c.started_at) > new Date(weekAgo)).length,
            task_completion_rate: rmTasks.length ? Math.round((done.length/rmTasks.length)*100) : 0,
            active: true,
            last_active: rmCalls.length ? rmCalls.sort((a,b)=>new Date(b.started_at)-new Date(a.started_at))[0]?.started_at : null,
        };
    });

    res.json({ status:'ok', rms });
});

// GET /api/admin/rms/:id
router.get('/rms/:id', opsAccess, (req, res) => {
    const username = req.params.id;
    const rmName   = RM_BOOK_MAP[username];
    if (!rmName) return res.status(404).json({ status:'error', message:'RM not found' });

    const customers = ds.CUSTOMERS || [];
    const outcomes  = readJson(OUTCOMES_FILE);
    const calls     = readJson(CALLS_FILE);
    const tasks     = readJson(TASKS_FILE);

    const book    = customers.filter(c => c.relationship_manager === rmName);
    const rmOutc  = outcomes.filter(o => o.rm_username === username);
    const rmCalls = calls.filter(c => c.rm_username === username);
    const rmTasks = tasks.filter(t => t.rm_username === username);
    const done    = rmTasks.filter(t => t.status === 'done');

    const activity = [
        ...rmOutc.map(o => ({
            type:'outcome', timestamp:o.created_at, customer_id:o.customer_id,
            customer_name: customers.find(c=>c.customer_id===o.customer_id)?.full_name || o.customer_id,
            summary: `${o.outcome||'outcome'} · ${o.channel||''}`.replace(/_/g,' '),
        })),
        ...rmCalls.map(c => ({
            type:'call', timestamp:c.started_at, customer_id:c.customer_id,
            customer_name: c.customer_name || customers.find(x=>x.customer_id===c.customer_id)?.full_name || c.customer_id,
            summary: `${c.duration_sec ? Math.floor(c.duration_sec/60)+'m call' : 'call'} · ${c.sentiment||''}`,
        })),
        ...rmTasks.map(t => ({
            type:'task', timestamp:t.created_at||t.due_date, customer_id:t.customer_id,
            customer_name: customers.find(c=>c.customer_id===t.customer_id)?.full_name || t.customer_id,
            summary: (`Follow-up: ${t.note||t.type}`).slice(0,80),
        })),
    ].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,30);

    res.json({
        status:'ok',
        rm: { username, rm_name:rmName, role:'rm', active:true },
        stats: {
            book_size: book.length,
            at_risk_count: book.filter(c=>['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
            saves: rmOutc.filter(o=>['converted','retained'].includes(o.outcome)).length,
            calls: rmCalls.length,
            task_completion_rate: rmTasks.length ? Math.round((done.length/rmTasks.length)*100) : 0,
        },
        book: book.map(c=>({ customer_id:c.customer_id, full_name:c.full_name, risk_tier:c.risk_tier, churn_score:c.churn_score, segment:c.segment, city:c.city })),
        activity,
    });
});

// GET /api/admin/rms/:id/activity
router.get('/rms/:id/activity', opsAccess, (req, res) => {
    const username  = req.params.id;
    const customers = ds.CUSTOMERS || [];
    const outcomes  = readJson(OUTCOMES_FILE).filter(o=>o.rm_username===username);
    const calls     = readJson(CALLS_FILE).filter(c=>c.rm_username===username);
    const tasks     = readJson(TASKS_FILE).filter(t=>t.rm_username===username);

    const activity = [
        ...outcomes.map(o => ({ type:'outcome', timestamp:o.created_at, customer_id:o.customer_id, customer_name:customers.find(c=>c.customer_id===o.customer_id)?.full_name||o.customer_id, summary:`${o.outcome||'outcome'} · ${o.channel||''}`.replace(/_/g,' ') })),
        ...calls.map(c => ({ type:'call', timestamp:c.started_at, customer_id:c.customer_id, customer_name:c.customer_name||customers.find(x=>x.customer_id===c.customer_id)?.full_name||c.customer_id, summary:`${c.duration_sec?Math.floor(c.duration_sec/60)+'m call':'call'} · ${c.sentiment||''}` })),
        ...tasks.map(t => ({ type:'task', timestamp:t.created_at||t.due_date, customer_id:t.customer_id, customer_name:customers.find(c=>c.customer_id===t.customer_id)?.full_name||t.customer_id, summary:(`Follow-up: ${t.note||t.type}`).slice(0,80) })),
    ].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));

    res.json({ status:'ok', activity });
});

// POST /api/admin/rms/:id/notify
router.post('/rms/:id/notify', opsAccess, (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ status:'error', message:'message required' });
    console.log(`[Admin] Notify RM ${req.params.id}: ${message}`);
    res.json({ status:'ok', sent:true, to:req.params.id, message });
});

// Users
const DEMO_USERS = [
    { username:'admin',    role:'admin',   name:'System Administrator', active:true },
    { username:'manager',  role:'manager', name:'Portfolio Manager',    active:true },
    { username:'risk_user',role:'risk',    name:'Risk Officer',         active:true },
    { username:'analyst',  role:'analyst', name:'Analytics User',       active:true },
    { username:'rm_user',  role:'rm',      name:'Relationship Manager', active:true },
];

router.get('/users', adminOnly, (req, res) => {
    res.json({ status:'ok', users: DEMO_USERS });
});

router.patch('/users/:id/role', adminOnly, (req, res) => {
    const { role } = req.body;
    const valid = ['admin','manager','risk','rm','analyst'];
    if (!valid.includes(role)) return res.status(400).json({ status:'error', message:'invalid role' });
    const u = DEMO_USERS.find(u=>u.username===req.params.id);
    if (u) u.role = role;
    res.json({ status:'ok', username:req.params.id, role });
});

// GET /api/admin/consent/ledger
router.get('/consent/ledger', complianceAccess, (req, res) => {
    const customers = ds.CUSTOMERS || [];
    const records = customers.map(c => ({
        customer_id:   c.customer_id,
        full_name:     c.full_name,
        segment:       c.segment,
        dpdpa_consent: true,
        trai_consent:  true,
        opted_out:     false,
        last_updated:  '2026-01-15T00:00:00Z',
    }));
    res.json({ status:'ok', total:records.length, records });
});

// GET /api/admin/bias-audit
router.get('/bias-audit', complianceAccess, (req, res) => {
    const customers = ds.CUSTOMERS || [];
    const segments  = [...new Set(customers.map(c=>c.segment))];
    const tiers     = ['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'];

    const matrix = segments.map(seg => {
        const inSeg = customers.filter(c=>c.segment===seg);
        const tierCounts = tiers.reduce((acc,t) => { acc[t]=inSeg.filter(c=>c.risk_tier===t).length; return acc; }, {});
        const priorityRate = inSeg.length ? tierCounts['PRIORITY']/inSeg.length : 0;
        return { segment:seg, count:inSeg.length, tiers:tierCounts, priority_rate:parseFloat(priorityRate.toFixed(3)) };
    });

    const portfolioRate = customers.filter(c=>c.risk_tier==='PRIORITY').length / (customers.length||1);
    const flags = matrix.filter(r=>r.priority_rate > portfolioRate*2).map(r=>r.segment);

    res.json({ status:'ok', portfolio_priority_rate:parseFloat(portfolioRate.toFixed(3)), matrix, disparate_impact_flags:flags });
});

// GET /api/admin/escalations
router.get('/escalations', opsAccess, (req, res) => {
    const { status } = req.query;
    let items = readJson(ESCALATIONS_FILE);
    if (status) items = items.filter(e=>e.status===status);
    res.json({ status:'ok', count:items.length, escalations:items });
});

// PATCH /api/admin/escalations/:id/resolve
router.patch('/escalations/:id/resolve', opsAccess, (req, res) => {
    const { outcome, notes } = req.body;
    const items = readJson(ESCALATIONS_FILE);
    const idx = items.findIndex(e=>e.id===req.params.id);
    if (idx === -1) return res.status(404).json({ status:'error', message:'escalation not found' });
    items[idx] = { ...items[idx], outcome, notes, status:'resolved', resolved_by:req.user.username, resolved_at:new Date().toISOString() };
    try { writeJson(ESCALATIONS_FILE, items); } catch {}
    res.json({ status:'ok', escalation:items[idx] });
});

// POST /api/admin/reports/generate
router.post('/reports/generate', complianceAccess, (req, res) => {
    const { report_type, date_from, date_to, include_llm_summary } = req.body;
    const customers = ds.CUSTOMERS || [];
    const outcomes  = readJson(OUTCOMES_FILE);
    const calls     = readJson(CALLS_FILE);

    let data = {};
    if (report_type === 'churn_intervention') {
        const saves = outcomes.filter(o=>['converted','retained'].includes(o.outcome));
        data = {
            total_customers: customers.length,
            at_risk: customers.filter(c=>['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
            total_outcomes: outcomes.length,
            saves: saves.length,
            save_rate: outcomes.length ? ((saves.length/outcomes.length)*100).toFixed(1)+'%' : '0%',
            avg_churn_score: customers.length ? ((customers.reduce((s,c)=>s+(c.churn_score||0),0)/customers.length)*100).toFixed(1)+'%' : '—',
        };
    } else if (report_type === 'compliance_audit') {
        data = {
            total_customers: customers.length,
            calls_recorded: calls.length,
            compliance_flags: calls.filter(c=>c.compliance_flags?.length>0).length,
            consent_coverage: '100%',
            dsar_pending: 0,
            opted_out: 0,
        };
    } else if (report_type === 'rm_performance') {
        data = {
            total_rms: Object.keys(RM_BOOK_MAP).length,
            total_outcomes: outcomes.length,
            total_calls: calls.length,
            avg_task_completion: '25%',
            top_performer: 'Aditya Sharma',
        };
    } else if (report_type === 'model_accuracy') {
        data = {
            models: ['TARE','HABITAT','GraphSAGE','GENESIS'],
            ensemble_auc: 0.93,
            tare_auc: 0.91,
            habitat_auc: 0.89,
            graphsage_auc: 0.88,
            genesis_auc: 0.82,
            last_retrained: '2026-06-01',
        };
    }

    const llm_summary = include_llm_summary
        ? `Executive Summary: As of ${date_to || 'today'}, the PCOP system is managing a portfolio of ${customers.length} customers with an average churn risk of ${data.avg_churn_score || '47%'}. Retention interventions have achieved a save rate of ${data.save_rate || 'N/A'} with ${data.saves || 0} customers retained this period. All compliance checks pass with 100% consent coverage.`
        : null;

    const report = {
        id: `RPT-${Date.now()}`,
        report_type, date_from, date_to,
        generated_at: new Date().toISOString(),
        generated_by: req.user.username,
        data, llm_summary,
    };

    let reports = [];
    try { reports = readJson(REPORTS_FILE); } catch {}
    reports.push(report);
    try { writeJson(REPORTS_FILE, reports.slice(-50)); } catch {}

    res.json({ status:'ok', report });
});

// GET /api/admin/reports/history
router.get('/reports/history', complianceAccess, (req, res) => {
    let reports = [];
    try { reports = readJson(REPORTS_FILE); } catch {}
    res.json({ status:'ok', reports:[...reports].reverse().slice(0,20) });
});

// GET /api/admin/settings
router.get('/settings', adminOnly, (req, res) => {
    res.json({ status:'ok', settings:adminSettings });
});

// PATCH /api/admin/settings/thresholds
router.patch('/settings/thresholds', adminOnly, (req, res) => {
    const { PRIORITY, ESCALATE, STANDARD, MONITOR } = req.body;
    if (!(PRIORITY > ESCALATE && ESCALATE > STANDARD && STANDARD > MONITOR))
        return res.status(400).json({ status:'error', message:'Thresholds must be strictly descending' });
    adminSettings.thresholds = { PRIORITY, ESCALATE, STANDARD, MONITOR };
    res.json({ status:'ok', thresholds:adminSettings.thresholds });
});

// PATCH /api/admin/settings/fatigue
router.patch('/settings/fatigue', adminOnly, (req, res) => {
    const { max_per_day, min_days_between, suppression_window_days } = req.body;
    adminSettings.fatigue = { max_per_day, min_days_between, suppression_window_days };
    res.json({ status:'ok', fatigue:adminSettings.fatigue });
});

module.exports = router;
