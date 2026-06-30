'use strict';
/**
 * /api/rm — RM Portal routes (book-scoped, role-gated).
 * All routes require authentication. Book-scoped routes require role=rm.
 * Book mapping: rm_user → 'Aditya Sharma' (11 customers in demo data).
 */
const router    = require('express').Router();
const crypto    = require('crypto');
const { verifyToken } = require('../middleware/auth');
const ds        = require('../services/dataStore');
const auditLog  = require('../services/auditLogService');
const path      = require('path');
const fs        = require('fs');

// ── JSON stores ───────────────────────────────────────────────────────────────
const OUTCOMES_FILE = path.join(__dirname, '../data/outcomes.json');
const TASKS_FILE    = path.join(__dirname, '../data/tasks.json');
const CALLS_FILE    = path.join(__dirname, '../data/calls.json');

function readJson(file)          { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return []; } }
function writeJson(file, data)   { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

// ── RM book mapping (demo): username → relationship_manager name in customer data
const RM_BOOK_MAP = {
  rm_user: 'Aditya Sharma',
};

function getRmName(user) {
  return RM_BOOK_MAP[user.username] || user.name;
}

function getBookCustomers(rmName) {
  return ds.CUSTOMERS.filter(c => c.relationship_manager === rmName);
}

// ── Middleware: require rm role ───────────────────────────────────────────────
function requireRm(req, res, next) {
  if (!req.user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  // manager/admin can also access RM portal for oversight
  if (!['rm', 'manager', 'admin'].includes(req.user.role))
    return res.status(403).json({ status: 'error', message: 'RM role required' });
  req.rmName = getRmName(req.user);
  next();
}

// ── GET /api/rm/book — book-scoped customer list ──────────────────────────────
router.get('/book', verifyToken, requireRm, async (req, res) => {
  try {
    const { search, risk_tier, segment } = req.query;
    let customers = getBookCustomers(req.rmName);

    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(c =>
        c.full_name.toLowerCase().includes(q) || c.customer_id.toLowerCase().includes(q)
      );
    }
    if (risk_tier) customers = customers.filter(c => c.risk_tier === risk_tier);
    if (segment)   customers = customers.filter(c => c.segment   === segment);

    // Enrich with live scores
    const enriched = customers.map(c => {
      const score = ds.SCORES_MAP[c.customer_id] || {};
      return { ...c, churn_score: score.final_score || c.churn_score, risk_tier: score.risk_tier || c.risk_tier };
    }).sort((a, b) => (b.churn_score || 0) - (a.churn_score || 0));

    res.json({ status: 'ok', rm_name: req.rmName, total: enriched.length, customers: enriched });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── GET /api/rm/book/summary — book KPIs ─────────────────────────────────────
router.get('/book/summary', verifyToken, requireRm, (req, res) => {
  try {
    const customers = getBookCustomers(req.rmName);
    const withScores = customers.map(c => ({
      ...c,
      ...(ds.SCORES_MAP[c.customer_id] || {}),
      final_score: ds.SCORES_MAP[c.customer_id]?.final_score || c.churn_score || 0,
    }));

    const outcomes = readJson(OUTCOMES_FILE).filter(o => o.rm_username === req.user.username);
    const tasks    = readJson(TASKS_FILE).filter(t => t.rm_username === req.user.username && t.status === 'pending');
    const calls    = readJson(CALLS_FILE).filter(c => c.rm_username === req.user.username);

    const atRisk       = withScores.filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier));
    const avgScore     = withScores.reduce((s, c) => s + (c.final_score||0), 0) / (withScores.length||1);
    const tasksDue     = tasks.filter(t => new Date(t.due_date) <= new Date(Date.now() + 7*86400000));
    const saves        = outcomes.filter(o => ['converted','retained'].includes(o.outcome));
    const callsThisWeek= calls.filter(c => new Date(c.started_at) >= new Date(Date.now() - 7*86400000));

    res.json({
      status: 'ok',
      rm_name: req.rmName,
      summary: {
        book_size:           customers.length,
        at_risk_count:       atRisk.length,
        avg_churn_score:     parseFloat(avgScore.toFixed(3)),
        tasks_due_this_week: tasksDue.length,
        outreach_pending:    0,
        saves_this_month:    saves.length,
        calls_this_week:     callsThisWeek.length,
        top_at_risk:         withScores
          .filter(c => ['PRIORITY','ESCALATE'].includes(c.risk_tier))
          .sort((a,b) => (b.final_score||0) - (a.final_score||0))
          .slice(0, 5)
          .map(c => ({
            customer_id: c.customer_id,
            full_name:   c.full_name,
            risk_tier:   c.risk_tier,
            churn_score: c.final_score || c.churn_score,
            city:        c.city,
            segment:     c.segment,
          })),
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── TASKS ─────────────────────────────────────────────────────────────────────

router.get('/tasks', verifyToken, requireRm, (req, res) => {
  try {
    const tasks = readJson(TASKS_FILE).filter(t => t.rm_username === req.user.username);
    const { status } = req.query;
    const filtered = status ? tasks.filter(t => t.status === status) : tasks;
    res.json({ status: 'ok', total: filtered.length, tasks: filtered.sort((a,b) => new Date(a.due_date) - new Date(b.due_date)) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/tasks', verifyToken, requireRm, (req, res) => {
  try {
    const { customer_id, due_date, note, type = 'callback' } = req.body;
    if (!customer_id || !due_date) return res.status(400).json({ status: 'error', message: 'customer_id and due_date required' });

    const tasks = readJson(TASKS_FILE);
    const newTask = {
      id:          `TASK-${String(tasks.length + 1).padStart(4,'0')}`,
      customer_id,
      rm_username: req.user.username,
      due_date,
      note:        note || '',
      type,
      status:      'pending',
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    };
    tasks.push(newTask);
    writeJson(TASKS_FILE, tasks);
    res.json({ status: 'ok', task: newTask });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.put('/tasks/:id', verifyToken, requireRm, (req, res) => {
  try {
    const tasks = readJson(TASKS_FILE);
    const idx   = tasks.findIndex(t => t.id === req.params.id && t.rm_username === req.user.username);
    if (idx === -1) return res.status(404).json({ status: 'error', message: 'Task not found' });
    tasks[idx] = { ...tasks[idx], ...req.body, id: tasks[idx].id, rm_username: tasks[idx].rm_username, updated_at: new Date().toISOString() };
    writeJson(TASKS_FILE, tasks);
    res.json({ status: 'ok', task: tasks[idx] });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── OUTCOMES ──────────────────────────────────────────────────────────────────

router.get('/outcomes', verifyToken, requireRm, (req, res) => {
  try {
    let outcomes = readJson(OUTCOMES_FILE).filter(o => o.rm_username === req.user.username);
    const { customer_id } = req.query;
    if (customer_id) outcomes = outcomes.filter(o => o.customer_id === customer_id);
    res.json({ status: 'ok', total: outcomes.length, outcomes: outcomes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/outcomes', verifyToken, requireRm, async (req, res) => {
  try {
    const { customer_id, action_taken, contacted, outcome, offer_presented, offer_accepted, channel, language_used, rm_notes, follow_up_date, related_outreach_id } = req.body;
    if (!customer_id || !outcome) return res.status(400).json({ status: 'error', message: 'customer_id and outcome required' });

    const outcomes = readJson(OUTCOMES_FILE);
    const newOutcome = {
      id:                 `OUT-${String(outcomes.length + 1).padStart(4,'0')}`,
      customer_id,
      rm_username:        req.user.username,
      rm_name:            req.rmName,
      action_taken:       action_taken || 'call',
      contacted:          contacted !== undefined ? contacted : true,
      outcome,
      offer_presented:    offer_presented || null,
      offer_accepted:     offer_accepted !== undefined ? offer_accepted : null,
      channel:            channel || 'phone',
      language_used:      language_used || 'en',
      rm_notes:           rm_notes || '',
      related_outreach_id:related_outreach_id || null,
      follow_up_date:     follow_up_date || null,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    };
    outcomes.push(newOutcome);
    writeJson(OUTCOMES_FILE, outcomes);

    const notesHash = crypto.createHash('sha256').update(rm_notes || '').digest('hex');
    await auditLog.logEvent({
      eventType:  'OUTCOME_RECORDED',
      customerId:  customer_id,
      actor:       req.user.username,
      layer:       'RM_PORTAL',
      payload:     { outcome, action_taken, channel, notes_hash: notesHash, offer_presented, offer_accepted },
      modelVersion:'RM-PORTAL-v1.0',
    });

    // Auto-create follow-up task if requested
    if (follow_up_date) {
      const tasks = readJson(TASKS_FILE);
      tasks.push({
        id:          `TASK-${String(tasks.length + 1).padStart(4,'0')}`,
        customer_id,
        rm_username: req.user.username,
        due_date:    follow_up_date,
        note:        `Follow-up from outcome: ${outcome}`,
        type:        'callback',
        status:      'pending',
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      });
      writeJson(TASKS_FILE, tasks);
    }

    res.json({ status: 'ok', outcome: newOutcome });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.put('/outcomes/:id', verifyToken, requireRm, async (req, res) => {
  try {
    const outcomes = readJson(OUTCOMES_FILE);
    const idx = outcomes.findIndex(o => o.id === req.params.id && o.rm_username === req.user.username);
    if (idx === -1) return res.status(404).json({ status: 'error', message: 'Outcome not found' });
    outcomes[idx] = { ...outcomes[idx], ...req.body, id: outcomes[idx].id, rm_username: outcomes[idx].rm_username, updated_at: new Date().toISOString() };
    writeJson(OUTCOMES_FILE, outcomes);
    await auditLog.logEvent({ eventType:'DATA_CORRECTION', customerId:outcomes[idx].customer_id, actor:req.user.username, layer:'RM_PORTAL', payload:{ outcomeId:req.params.id }, modelVersion:'RM-PORTAL-v1.0' });
    res.json({ status: 'ok', outcome: outcomes[idx] });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── CALLS ─────────────────────────────────────────────────────────────────────

router.get('/calls', verifyToken, requireRm, (req, res) => {
  try {
    let calls = readJson(CALLS_FILE).filter(c => c.rm_username === req.user.username);
    const { customer_id, outcome, has_compliance_flag } = req.query;
    if (customer_id) calls = calls.filter(c => c.customer_id === customer_id);
    if (outcome)     calls = calls.filter(c => c.outcome === outcome);
    if (has_compliance_flag === 'true') calls = calls.filter(c => (c.compliance_flags||[]).length > 0);

    // Enrich with customer name
    const enriched = calls.map(c => {
      const cust = ds.CUSTOMERS_MAP?.[c.customer_id] || ds.CUSTOMERS.find(x => x.customer_id === c.customer_id) || {};
      return { ...c, customer_name: cust.full_name || c.customer_id, transcript: undefined };
    });
    res.json({ status: 'ok', total: enriched.length, calls: enriched.sort((a,b) => new Date(b.started_at) - new Date(a.started_at)) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.get('/calls/:id', verifyToken, requireRm, async (req, res) => {
  try {
    const calls = readJson(CALLS_FILE);
    const call  = calls.find(c => c.id === req.params.id && c.rm_username === req.user.username);
    if (!call) return res.status(404).json({ status: 'error', message: 'Call not found' });
    await auditLog.logEvent({ eventType:'CALL_TRANSCRIPT_VIEWED', customerId:call.customer_id, actor:req.user.username, layer:'RM_PORTAL', payload:{ callId:call.id }, modelVersion:'RM-PORTAL-v1.0' });
    res.json({ status: 'ok', call });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/calls/start', verifyToken, requireRm, async (req, res) => {
  try {
    const { customer_id, consent_to_record } = req.body;
    if (!customer_id) return res.status(400).json({ status: 'error', message: 'customer_id required' });
    if (!consent_to_record) return res.status(400).json({ status: 'error', message: 'consent_to_record is required before starting a recorded call' });

    const callId = `CALL-${String(Date.now()).slice(-6)}`;
    await auditLog.logEvent({ eventType:'CALL_STARTED', customerId:customer_id, actor:req.user.username, layer:'RM_PORTAL', payload:{ callId, consent_to_record }, modelVersion:'RM-PORTAL-v1.0' });
    res.json({ status: 'ok', callId, message: 'Call started. Record audio and submit transcript when done.' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/calls/analyze', verifyToken, requireRm, async (req, res) => {
  try {
    const { customer_id, transcript } = req.body;
    if (!customer_id || !transcript) return res.status(400).json({ status: 'error', message: 'customer_id and transcript required' });

    const customer = ds.CUSTOMERS.find(c => c.customer_id === customer_id);
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    const { analyzeCall } = require('../services/callAnalysisService');
    const analysis = await analyzeCall(transcript, customer);

    const transcriptHash = crypto.createHash('sha256').update(transcript).digest('hex');
    await auditLog.logEvent({ eventType:'CALL_ANALYZED', customerId:customer_id, actor:req.user.username, layer:'RM_PORTAL', payload:{ outcome:analysis.outcome, transcript_hash:transcriptHash, summary_hash: crypto.createHash('sha256').update(analysis.summary||'').digest('hex') }, modelVersion:'RM-PORTAL-v1.0' });

    res.json({ status: 'ok', analysis, customer_id, message: 'Review and confirm before committing.' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/calls/commit', verifyToken, requireRm, async (req, res) => {
  try {
    const { customer_id, callId, analysis, transcript, duration_sec, consent_to_record } = req.body;
    if (!customer_id || !analysis) return res.status(400).json({ status: 'error', message: 'customer_id and analysis required' });

    const calls = readJson(CALLS_FILE);
    const newCall = {
      id:                      callId || `CALL-${String(calls.length + 1).padStart(4,'0')}`,
      customer_id,
      rm_username:             req.user.username,
      rm_name:                 req.rmName,
      duration_sec:            duration_sec || 0,
      detected_language:       analysis.detected_language || 'en',
      sentiment:               analysis.sentiment || 'neutral',
      sentiment_score:         analysis.sentiment_score || 0,
      contacted:               analysis.contacted !== undefined ? analysis.contacted : true,
      outcome:                 analysis.outcome || 'neutral',
      offer_presented:         analysis.offer_presented || null,
      offer_accepted:          analysis.offer_accepted !== undefined ? analysis.offer_accepted : null,
      objections:              analysis.objections || [],
      rebuttals_that_worked:   analysis.rebuttals_that_worked || [],
      commitments:             analysis.commitments || [],
      life_events_mentioned:   analysis.life_events_mentioned || [],
      competitor_mentions:     analysis.competitor_mentions || [],
      channel_timing_preference:analysis.channel_timing_preference || null,
      risk_drivers_voiced:     analysis.risk_drivers_voiced || [],
      follow_up_required:      analysis.follow_up_required || false,
      follow_up_date:          analysis.follow_up_date || null,
      compliance_flags:        analysis.compliance_flags || [],
      rm_action_items:         analysis.rm_action_items || [],
      summary:                 analysis.summary || '',
      transcript:              transcript || '',
      consent_to_record:       consent_to_record !== false,
      started_at:              new Date().toISOString(),
      committed_at:            new Date().toISOString(),
    };
    calls.push(newCall);
    writeJson(CALLS_FILE, calls);

    // Auto-create outcome record
    const outcomes = readJson(OUTCOMES_FILE);
    outcomes.push({
      id:          `OUT-${String(outcomes.length + 1).padStart(4,'0')}`,
      customer_id,
      rm_username: req.user.username,
      rm_name:     req.rmName,
      action_taken:'call',
      contacted:   newCall.contacted,
      outcome:     newCall.outcome,
      offer_presented: newCall.offer_presented,
      offer_accepted:  newCall.offer_accepted,
      channel:     'phone',
      language_used:   newCall.detected_language,
      rm_notes:    newCall.summary,
      related_outreach_id: null,
      follow_up_date:  newCall.follow_up_date,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });
    writeJson(OUTCOMES_FILE, outcomes);

    // Auto-create follow-up task
    if (newCall.follow_up_required && newCall.follow_up_date) {
      const tasks = readJson(TASKS_FILE);
      tasks.push({
        id:          `TASK-${String(tasks.length + 1).padStart(4,'0')}`,
        customer_id,
        rm_username: req.user.username,
        due_date:    newCall.follow_up_date,
        note:        `Follow-up from call: ${newCall.summary?.slice(0,80)}`,
        type:        'callback',
        status:      'pending',
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      });
      writeJson(TASKS_FILE, tasks);
    }

    const transcriptHash = crypto.createHash('sha256').update(transcript || '').digest('hex');
    await auditLog.logEvent({ eventType:'CALL_TRANSCRIBED', customerId:customer_id, actor:req.user.username, layer:'RM_PORTAL', payload:{ callId:newCall.id, language:newCall.detected_language, duration_sec, transcript_hash:transcriptHash }, modelVersion:'RM-PORTAL-v1.0' });

    res.json({ status: 'ok', call: { ...newCall, transcript: undefined }, message: 'Call committed. Outcome and tasks updated.' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── PERFORMANCE ───────────────────────────────────────────────────────────────
router.get('/performance', verifyToken, requireRm, (req, res) => {
  try {
    const outcomes = readJson(OUTCOMES_FILE).filter(o => o.rm_username === req.user.username);
    const calls    = readJson(CALLS_FILE).filter(c => c.rm_username === req.user.username);
    const tasks    = readJson(TASKS_FILE).filter(t => t.rm_username === req.user.username);

    const saves       = outcomes.filter(o => ['converted','retained'].includes(o.outcome));
    const withOffer   = outcomes.filter(o => o.offer_presented);
    const accepted    = withOffer.filter(o => o.offer_accepted);
    const doneTasks   = tasks.filter(t => t.status === 'done');
    const allTasks    = tasks.length;

    res.json({
      status: 'ok',
      rm_name: req.rmName,
      performance: {
        total_outcomes:        outcomes.length,
        saves_retained:        saves.length,
        conversion_rate:       withOffer.length ? parseFloat((accepted.length / withOffer.length * 100).toFixed(1)) : 0,
        calls_made:            calls.length,
        avg_sentiment:         calls.length ? parseFloat((calls.reduce((s,c) => s + (c.sentiment_score||0), 0) / calls.length).toFixed(2)) : 0,
        tasks_completion_rate: allTasks ? parseFloat((doneTasks.length / allTasks * 100).toFixed(1)) : 0,
        compliance_flags:      calls.reduce((s,c) => s + (c.compliance_flags||[]).length, 0),
        channel_breakdown:     outcomes.reduce((acc, o) => { acc[o.channel] = (acc[o.channel]||0) + 1; return acc; }, {}),
        outcome_breakdown:     outcomes.reduce((acc, o) => { acc[o.outcome] = (acc[o.outcome]||0) + 1; return acc; }, {}),
        monthly_trend:         [],
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
