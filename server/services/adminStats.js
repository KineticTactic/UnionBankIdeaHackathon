'use strict';
/**
 * adminStats — aggregation helpers for the Admin Portal's Command
 * Center and per-RM dashboards.  Everything runs in-process against
 * the existing dataStore + JSON files; no new persistence is required
 * for the demo.  In production the same surface would query the
 * audit log + outcomes tables in Postgres / BigQuery.
 */
const path = require('path');
const fs   = require('fs');
const ds   = require('./dataStore');
const { RM_BOOK_MAP, RM_NAME_TO_USER } = require('../routes/rm');

const DATA_DIR = path.join(__dirname, '..', 'data');
function _readJson(name, fallback) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }
    catch (e) { return fallback; }
}

/** Live in-memory signal counter — driven by the Kafka simulation
 *  which runs every 8s in DEMO_MODE.  Returns the count of signals
 *  fired in the last 24h (approximated by the static demo value
 *  since we don't tag signal timestamps in the live state).
 */
function activeSignalsToday() {
    // getAllSignals returns {rows, total, ...} in demo mode.  We
    // count the per-customer signal arrays across rows.
    const res = ds.getAllSignals?.() || { rows: [] };
    const rows = Array.isArray(res) ? res : (res.rows || []);
    return rows.reduce((s, x) => s + (x.signals ? x.signals.length : 0), 0);
}

/** Build the Command Center KPI bar.
 *  Returns { stats, rm_leaderboard, top_at_risk }.
 *  `stats.active_signals_today` and `outreach_sent_24h` are demo-
 *  synthesised (deterministic-from-counts) since the live counters
 *  aren't in this server's scope.
 */
function commandCenter() {
    const customers = ds.getAllCustomers();
    const outcomes  = ds.getAllOutcomes();
    const calls     = ds.getAllCalls();
    const tasks     = ds.getAllTasks();

    const atRisk = customers.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier));
    const saves30d = outcomes.filter(o =>
        ['converted', 'retained'].includes(o.outcome) &&
        new Date(o.created_at) > new Date(Date.now() - 30 * 86400_000)
    );
    const tierDist = customers.reduce((acc, c) => {
        acc[c.risk_tier] = (acc[c.risk_tier] || 0) + 1; return acc;
    }, {});
    const avgChurn = customers.length
        ? customers.reduce((s, c) => s + (c.churn_score || 0), 0) / customers.length
        : 0;

    const leaderboard = Object.entries(RM_BOOK_MAP).map(([username, rmName]) => {
        const book = customers.filter(c => c.relationship_manager === rmName);
        const rmOutcomes = outcomes.filter(o => o.rm_username === username);
        const rmCalls    = calls.filter(c => c.rm_username === username);
        const rmTasks    = tasks.filter(t => t.rm_username === username);
        const doneTasks  = rmTasks.filter(t => t.status === 'done');
        const saves      = rmOutcomes.filter(o => ['converted','retained'].includes(o.outcome));
        return {
            rm_name: rmName, username, book_size: book.length,
            at_risk_count: book.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
            saves: saves.length, calls: rmCalls.length,
            task_completion_rate: rmTasks.length ? Math.round(doneTasks.length / rmTasks.length * 100) : 0,
        };
    });

    // Sort leaderboard by saves desc, then by at_risk_count desc.
    leaderboard.sort((a, b) => (b.saves - a.saves) || (b.at_risk_count - a.at_risk_count));

    // Top-at-risk with the live override applied via the orchestrator's
    // dataStore.getScore() (so demo "publish score_update" events move
    // customers into/out of the list in real time).
    const top = customers
        .map(c => {
            const live = ds.getScore(c.customer_id);
            return {
                customer_id: c.customer_id,
                full_name:   c.full_name,
                segment:     c.segment,
                city:        c.city,
                churn_score: live?.final_score ?? c.churn_score,
                risk_tier:   live?.risk_tier    ?? c.risk_tier,
                rm_name:     c.relationship_manager,
            };
        })
        .sort((a, b) => (b.churn_score || 0) - (a.churn_score || 0))
        .slice(0, 10);

    return {
        stats: {
            total_customers:       customers.length,
            at_risk_count:         atRisk.length,
            active_signals_today:  activeSignalsToday(),
            saves_this_month:      saves30d.length,
            outreach_sent_24h:     Math.max(8, calls.length * 2),  // demo: derived
            avg_churn_score:       parseFloat(avgChurn.toFixed(3)),
            tier_distribution:     tierDist,
        },
        rm_leaderboard: leaderboard,
        top_at_risk:    top,
    };
}

/** Per-RM detail rollup. */
function rmDetail(username) {
    const rmName = RM_BOOK_MAP[username];
    if (!rmName) return null;
    const customers = ds.getAllCustomers();
    const outcomes  = ds.getAllOutcomes();
    const calls     = ds.getAllCalls();
    const tasks     = ds.getAllTasks();

    const book = customers.filter(c => c.relationship_manager === rmName);
    const rmOutcomes = outcomes.filter(o => o.rm_username === username);
    const rmCalls    = calls.filter(c => c.rm_username === username);
    const rmTasks    = tasks.filter(t => t.rm_username === username);

    const stats = {
        book_size:      book.length,
        at_risk_count:  book.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier)).length,
        saves:          rmOutcomes.filter(o => ['converted','retained'].includes(o.outcome)).length,
        calls:          rmCalls.length,
        task_rate:      rmTasks.length
            ? Math.round(rmTasks.filter(t => t.status === 'done').length / rmTasks.length * 100) : 0,
    };

    return {
        rm:    { username, rm_name: rmName, role: 'rm' },
        stats,
        book:  book.map(c => ({
            customer_id: c.customer_id,
            full_name:   c.full_name,
            segment:     c.segment,
            risk_tier:   c.risk_tier,
            churn_score: ds.getScore(c.customer_id)?.final_score ?? c.churn_score,
            city:        c.city,
        })),
        recent_activity: [
            ...rmOutcomes.map(o => ({
                type:         'outcome',
                timestamp:    o.created_at,
                customer_id:  o.customer_id,
                customer_name:customers.find(c => c.customer_id === o.customer_id)?.full_name || o.customer_id,
                summary:      `${o.outcome} · ${o.action_taken || ''} · ${o.channel || ''}`.trim(),
            })),
            ...rmCalls.map(c => ({
                type:         'call',
                timestamp:    c.started_at,
                customer_id:  c.customer_id,
                customer_name:customers.find(x => x.customer_id === c.customer_id)?.full_name || c.customer_id,
                summary:      `${c.duration_sec || 0}s call · ${c.sentiment || 'neutral'}`,
            })),
            ...rmTasks.map(t => ({
                type:         'task',
                timestamp:    t.created_at,
                customer_id:  t.customer_id,
                customer_name:customers.find(x => x.customer_id === t.customer_id)?.full_name || t.customer_id,
                summary:      `Task [${t.status}] · due ${t.due_date?.slice(0, 10)} · ${t.type}`,
            })),
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30),
    };
}

/** Build a decision lineage (signal→score→plan→content) for one
 *  customer, suitable for the "Decision Lineage Replay" page.
 *  Async because ds.getScore / ds.getSignals are async.
 *  In demo mode this is computed from static JSON; in production the
 *  audit log would be the source of truth.
 */
async function lineage(customerId) {
    const c    = ds.CUSTOMERS_MAP?.[customerId] || ds.CUSTOMERS.find(x => x.customer_id === customerId);
    if (!c) return null;
    const score = await ds.getScore(customerId);
    const sigs  = (await ds.getSignals?.(customerId) || []).slice(0, 6);
    const plan  = ds.PLANS_MAP?.[customerId] || null;
    const herd  = ds.HERALD_MAP?.[customerId] || null;

    return {
        customer:  { customer_id: c.customer_id, full_name: c.full_name, risk_tier: c.risk_tier, churn_score: c.churn_score },
        score:     score,
        signals:   sigs.map(s => ({
            signal_type: s.signal_type, confidence: s.confidence, method: s.method_used,
        })),
        plan:      plan,
        herald:     herd ? { subject: herd.email?.subject, body_chars: (herd.email?.body || '').length } : null,
        timeline: [
            { stage: 1, label: 'Bank data loaded',  at: c.kyc_status ? 'onboarding' : 'live' },
            { stage: 2, label: 'ARGUS signals',     count: sigs.length },
            { stage: 3, label: 'CHRONOS scored',    final_score: score?.final_score, risk_tier: score?.risk_tier },
            { stage: 4, label: 'COMPASS plan',      action: plan?.action, channel: plan?.channel },
            { stage: 5, label: 'HERALD generated',  has_content: !!herd },
            { stage: 6, label: 'VERDICT  measured', note: 'awaiting 7d outcome window' },
            { stage: 7, label: 'ORACLE   relrn',    note: 'queued for next retrain' },
        ],
    };
}

module.exports = {
    commandCenter,
    rmDetail,
    lineage,
    RM_BOOK_MAP,
    RM_NAME_TO_USER,
};
