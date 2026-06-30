'use strict';
/**
 * /api/outreach — HERALD content generation + approval gate + campaign endpoints.
 * RBI AI Governance 2024 — Human override required before adverse customer-facing AI actions.
 * DPDPA 2023 + TRAI TCCCPR 2025 — consent verified before every outreach action.
 *
 * POST /generate now returns 202 + jobId immediately; LLM call is async via BullMQ.
 * GET  /job/:jobId polls job state.
 */
const router      = require('express').Router();
const crypto      = require('crypto');
const config      = require('../config');
const { verifyToken } = require('../middleware/auth');
const ds          = require('../services/dataStore');
const consentSvc  = require('../services/consentService');
const approvalSvc = require('../services/approvalService');
const traiSvc     = require('../services/traiComplianceService');
const auditLog    = require('../services/auditLogService');
const { enqueueHerald, getJobStatus } = require('../queue/heraldQueue');
const emailResend = require('../services/emailResendService');
const waTwilio    = require('../services/whatsappTwilioService');

// Fixed recipient for the Resend sandbox demo.  Resend only delivers
// to the account owner for the default `onboarding@resend.dev` sender,
// so we redirect every send to the demo address the team registered.
// Set RESEND_SANDBOX_OVERRIDE=false to honour the customer's actual email.
const SANDBOX_OVERRIDE_TO = 'rudrajeetpal64@gmail.com';
const SANDBOX_OVERRIDE_ENABLED = process.env.RESEND_SANDBOX_OVERRIDE !== 'false';

// ── In-memory outreach log (seeded from HERALD static data — DEMO_MODE) ───────
// In prod mode this comes from outreachRepo; HERALD and PLANS_MAP are synchronous
// module-level exports so this seeding code runs fine before async routes are hit.
const outreachLog = ds.HERALD.map((h, i) => ({
    id:              `OR-${String(i + 1).padStart(4, '0')}`,
    customer_id:     h.customer_id,
    channel:         h.risk_tier === 'PRIORITY' ? 'phone' : h.risk_tier === 'ESCALATE' ? 'email' : 'sms',
    risk_tier:       h.risk_tier,
    status:          ['sent', 'delivered', 'opened', 'clicked'][i % 4], // deterministic
    offer_code:      ds.PLANS_MAP[h.customer_id]?.offer_code || 'NONE',
    dispatched_at:   new Date(Date.now() - (i % 7) * 86_400_000).toISOString(),
    content_preview: (h.email?.body || '').slice(0, 120) + '...',
}));

const CAMPAIGNS = [
    { id: 'C001', name: 'Q1 Retention Drive',   status: 'active',    channel: 'email', customers: 18, opens: 11, conversions: 4 },
    { id: 'C002', name: 'High-Risk SMS Blitz',   status: 'active',    channel: 'sms',   customers: 10, opens: 7,  conversions: 2 },
    { id: 'C003', name: 'VIP Loyalty Programme', status: 'completed', channel: 'phone', customers: 8,  opens: 8,  conversions: 6 },
];

// ── List / campaign routes (unchanged contract) ───────────────────────────────

router.get('/campaigns', verifyToken, (req, res) => {
    res.json({ status: 'ok', campaigns: CAMPAIGNS });
});

router.get('/', verifyToken, (req, res) => {
    const { customer_id, status, channel, page = 1, limit = 20 } = req.query;
    let list = [...outreachLog];
    if (customer_id) list = list.filter(o => o.customer_id === customer_id);
    if (status)      list = list.filter(o => o.status      === status);
    if (channel)     list = list.filter(o => o.channel     === channel);
    const p = parseInt(page), l = parseInt(limit);
    res.json({ status: 'ok', total: list.length, page: p, limit: l, records: list.slice((p - 1) * l, p * l) });
});

router.get('/pending', verifyToken, (req, res) => {
    const { customer_id, status } = req.query;
    const list = approvalSvc.getPendingApprovals({ customerId: customer_id, status });
    res.json({ status: 'ok', approvals: list, total: list.length });
});

router.get('/approval/:approvalId', verifyToken, (req, res) => {
    const entry = approvalSvc.getApprovalById(req.params.approvalId);
    if (!entry) return res.status(404).json({ status: 'error', message: 'Approval not found' });
    res.json({ status: 'ok', approval: entry });
});

// ── Job status endpoint ───────────────────────────────────────────────────────

router.get('/job/:jobId', verifyToken, async (req, res) => {
    try {
        const status = await getJobStatus(req.params.jobId);
        res.json({ status: 'ok', ...status });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── POST /generate — enqueue async HERALD job (202) ──────────────────────────

router.post('/generate', verifyToken, async (req, res) => {
    const { customer_id } = req.body;
    if (!customer_id)
        return res.status(400).json({ status: 'error', message: 'customer_id required' });

    const snap = await ds.getCustomerSnapshot(customer_id);
    if (!snap)
        return res.status(404).json({ status: 'error', message: 'Customer not found' });

    const requestedBy = req.user?.username || 'system';

    let job;
    try {
        job = await enqueueHerald(customer_id, snap, requestedBy);
    } catch (queueErr) {
        // BullMQ unavailable (DEMO_MODE without Redis) — fall back to synchronous path
        return _syncGenerate(req, res, snap, requestedBy);
    }

    res.status(202).json({
        status:  'queued',
        jobId:   job.id,
        message: 'HERALD generation in progress — poll GET /api/outreach/job/:jobId',
    });
});

// Synchronous HERALD generation — used when BullMQ is unavailable
// (DEMO_MODE without Redis).  When NVIDIA_API_KEY is set, this path
// calls DeepSeek live, so the operator still gets a real LLM response
// without needing the queue.  When the key is missing, the call is
// skipped and a structured 503 is returned (no templated content).
async function _syncGenerate(req, res, snap, requestedBy) {
    console.log('[HERALD] _syncGenerate ENTERED  customer=' + (snap.customer?.customer_id || customer_id));
    const { customer_id } = snap.customer || snap;
    const id = snap.customer?.customer_id || customer_id;

    const channels     = ['EMAIL', 'SMS', 'PUSH'];
    const consentStatus = {};
    for (const ch of channels) consentStatus[ch] = consentSvc.canSendOutreach(id, ch);
    const allowedChannels = channels.filter(ch => consentStatus[ch].allowed);

    let heraldContent  = null;
    let llmError       = null;
    const cached       = await ds.getHerald(id);
    const score        = (snap.score && snap.score.final_score) || (snap.customer && snap.customer.churn_score) || 0.0;
    const tier         = (snap.score && snap.score.risk_tier)   || (snap.customer && snap.customer.risk_tier) || 'NONE';
    const signals      = (snap.signals || []).map(s => s.signal_type).filter(Boolean);

    if (!config.nvidia.apiKey) {
        // Rule A: no key → no content.  Surface a structured error so
        // the client can show it, and bail before the approval gate.
        return res.status(503).json({
            error: true, stage: 5, stage_name: 'herald',
            message: 'HERALD live generation unavailable: NVIDIA_API_KEY is not set. ' +
                     'Set it in server/.env (or via the orchestrator env) to enable real LLM content.',
            detail: 'NVIDIA_API_KEY is empty',
        });
    }

    // Call NVIDIA DeepSeek live.
    try {
        const llm     = require('../services/llmClient');
        const { buildHeraldPrompts, parseHeraldResponse } = require('../services/heraldPrompt');
        const { systemPrompt, userPrompt } = buildHeraldPrompts(snap);
        console.log(`[HERALD] sync LLM call  customer=${id}  model=${config.nvidia.model}  ` +
                    `endpoint=${config.nvidia.endpoint}`);
        const t0     = Date.now();
        const resp   = await llm.callNvidia([
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
        ], 1200);
        const raw    = resp?.choices?.[0]?.message?.content || '';
        heraldContent = parseHeraldResponse(raw);
        const ms     = Date.now() - t0;
        console.log(`[HERALD] sync LLM done   customer=${id}  elapsed=${ms}ms  ` +
                    `email_chars=${heraldContent?.email?.body?.length || 0}  ` +
                    `sms_chars=${heraldContent?.sms?.body?.length || 0}`);
        if (!heraldContent || !heraldContent.email?.body) {
            throw new Error('LLM returned empty/invalid content');
        }
    } catch (err) {
        llmError = err.message;
        console.error(`[HERALD] sync LLM FAILED  customer=${id}  err=${err.message}`);
    }

    // If LLM failed AND we have no cached content, return a clean
    // structured 502 so the client knows it's a real failure (no
    // silent fallback to placeholder text).
    if (!heraldContent) {
        return res.status(502).json({
            error: true, stage: 5, stage_name: 'herald',
            message: `HERALD live generation failed: ${llmError || 'unknown error'}. ` +
                     'Check NVIDIA_API_KEY, network reachability, and NVIDIA rate limits.',
            detail: llmError,
        });
    }

    const plan = snap.plan || {};
    const compassRecommendation = {
        offer:     plan.offer_display || plan.offer_code || 'personalised_offer',
        channel:   plan.channel       || 'email',
        timing:    plan.timing        || 'immediate',
        rationale: plan.rationale     || `AI-personalised content via ${config.nvidia.model} for tier=${tier}.`,
    };

    const approvalId = await approvalSvc.createApprovalRequest(id, requestedBy, compassRecommendation, heraldContent);

    console.log(`[HERALD] sync generate  customer=${id}  tier=${tier}  score=${(score||0).toFixed(3)}  ` +
                `offer=${compassRecommendation.offer}  channel=${compassRecommendation.channel}  ` +
                `source=llm-live  approval=${approvalId}`);

    await auditLog.logEvent({
        eventType:    'OUTREACH_QUEUED',
        customerId:   id,
        actor:        requestedBy,
        layer:        'HERALD',
        payload:      { approvalId, allowedChannels, consentStatus, source: 'llm-live' },
        modelVersion: config.nvidia.model,
    });

    res.json({
        status:           'ok',
        approvalId,
        pendingApproval:  true,
        message:          'Outreach generated by HERALD (live LLM) — DPDPA/TRAI compliant approval required before send.',
        compassRecommendation,
        heraldContent,
        consentStatus,
        allowedChannels,
    });
}

// ── POST /send-email — Resend-backed email send ──────────────────────────────
//
// Single-step "send an email now" path.  Routes through the existing
// approval gate (creates a PENDING approval, then approves it on behalf
// of the caller) so the audit trail is identical to the Composer flow,
// and adds a RESEND-specific dispatch event.
//
// Body:
//   {
//     customer_id : string  (required)
//     subject     : string  (required; if omitted, uses approval email.subject)
//     body        : string  (required; if omitted, uses approval email.body)
//     from        : string? (override RESEND_FROM)
//     to          : string? (override recipient — defaults to SANDBOX_OVERRIDE_TO)
//     approval_id : string? (reuse an existing pending approval instead of
//                             creating a new one)
//     reviewed_by : string? (defaults to req.user.username)
//   }
//
// Returns:
//   { status:'ok', approvalId, dispatch:{messageId,to,from,status,...},
//     customerEmail, subject, bodyPreview, sandboxOverride }

router.post('/send-email', verifyToken, async (req, res) => {
    const {
        customer_id, subject, body, from, to,
        approval_id, reviewed_by,
    } = req.body || {};

    if (!customer_id)
        return res.status(400).json({ status: 'error', message: 'customer_id is required' });

    const actor     = reviewed_by || req.user?.username || 'rm_user';
    const customer  = await ds.getCustomerById(customer_id);
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    // DPDPA + TRAI consent check on EMAIL channel.
    const consentCheck = consentSvc.canSendOutreach(customer_id, 'EMAIL');
    if (!consentCheck.allowed) {
        await auditLog.logEvent({
            eventType:  'OUTREACH_BLOCKED',
            customerId: customer_id,
            actor,
            layer:      'HERALD',
            payload:    { channel: 'EMAIL', reason: consentCheck.reason, source: 'send-email-resend' },
            modelVersion: 'HERALD-v1.0',
        });
        return res.status(403).json({
            status:  'error',
            message: `EMAIL blocked: ${consentCheck.reason}`,
            reason:  consentCheck.reason,
        });
    }

    // Resolve the heraldContent: prefer the supplied subject/body,
    // otherwise reuse the email subject/body from the cached HERALD
    // record, and finally fall back to a templated retention offer.
    let heraldContent;
    if (subject || body) {
        heraldContent = {
            email: {
                subject: subject || '',
                body:    body    || '',
                compliance_status: 'pending',
                word_count: (body || '').split(/\s+/).filter(Boolean).length,
            },
        };
    } else {
        const cached = await ds.getHerald(customer_id);
        const cachedEmail = cached?.email || {};
        heraldContent = {
            email: {
                subject: cachedEmail.subject || '',
                body:    cachedEmail.body    || '',
                compliance_status: cachedEmail.compliance_status || 'pending',
                word_count: cachedEmail.word_count || (cachedEmail.body || '').split(/\s+/).filter(Boolean).length,
            },
        };
    }
    if (!heraldContent.email.subject || !heraldContent.email.body) {
        return res.status(400).json({
            status:  'error',
            message: 'subject and body are required (or generate HERALD content first)',
        });
    }

    const compassRecommendation = {
        offer:     'personalised_retention',
        channel:   'email',
        timing:    'immediate',
        rationale: 'Resend-backed direct email dispatch from the RM Outreach tab.',
    };

    // Route through the approval gate.  If a pending approval_id is
    // supplied, use that — otherwise mint a fresh one.
    let approvalId = approval_id;
    if (approvalId) {
        const existing = approvalSvc.getApprovalById(approvalId);
        if (!existing) return res.status(404).json({ status: 'error', message: `Approval ${approvalId} not found` });
        if (existing.status !== 'PENDING')
            return res.status(409).json({ status: 'error', message: `Approval ${approvalId} is ${existing.status}` });
    } else {
        approvalId = await approvalSvc.createApprovalRequest(customer_id, actor, compassRecommendation, heraldContent);
    }

    // Approve on behalf of the caller (the click is the human-in-the-loop approval).
    let approval;
    try {
        approval = await approvalSvc.approveOutreach(approvalId, actor);
    } catch (err) {
        return res.status(400).json({ status: 'error', message: err.message });
    }

    // Determine the actual recipient.  Resend's `onboarding@resend.dev`
    // sandbox can only deliver to the registered account owner, so we
    // default to that address for the demo.  In production, set
    // RESEND_SANDBOX_OVERRIDE=false to honour customer.email.
    const sandboxOverride = SANDBOX_OVERRIDE_ENABLED;
    const requestedTo     = to || customer.email;
    const finalTo         = sandboxOverride ? SANDBOX_OVERRIDE_TO : requestedTo;

    const htmlBody = heraldContent.email.body.replace(/\n/g, '<br>');

    let dispatch;
    try {
        dispatch = await emailResend.sendEmail({
            to:         finalTo,
            from,
            subject:    heraldContent.email.subject,
            html:       htmlBody,
            text:       heraldContent.email.body,
            customerId: customer_id,
            metadata: {
                approvalId,
                customerEmail: customer.email,
                sandboxOverride,
                provider: 'resend',
            },
        });
    } catch (err) {
        await auditLog.logEvent({
            eventType:  'OUTREACH_BLOCKED',
            customerId: customer_id,
            actor,
            layer:      'HERALD',
            payload:    { channel: 'EMAIL', reason: err.code || 'RESEND_ERROR', detail: err.message, approvalId },
            modelVersion: 'HERALD-v1.0',
        });
        return res.status(502).json({
            status:  'error',
            message: err.message,
            code:    err.code || 'RESEND_ERROR',
            approvalId,
        });
    }

    const contentHash = crypto.createHash('sha256').update(heraldContent.email.body).digest('hex');

    await auditLog.logEvent({
        eventType:  'OUTREACH_EMAIL_DISPATCHED',
        customerId: customer_id,
        actor,
        layer:      'HERALD',
        payload: {
            approvalId,
            provider:     'resend',
            messageId:    dispatch.messageId,
            to:           finalTo,
            requestedTo,
            from:         dispatch.from,
            sandboxOverride,
            subject:      heraldContent.email.subject,
            contentHash,
        },
        modelVersion: 'HERALD-v1.0',
    });

    await auditLog.logEvent({
        eventType:  'OUTREACH_SENT',
        customerId: customer_id,
        actor,
        layer:      'HERALD',
        payload: { approvalId, channel: 'EMAIL', contentHash, provider: 'resend', messageId: dispatch.messageId },
        modelVersion: 'HERALD-v1.0',
    });

    res.json({
        status:           'ok',
        approvalId,
        customerEmail:    customer.email,
        subject:          heraldContent.email.subject,
        bodyPreview:      heraldContent.email.body.slice(0, 240),
        sandboxOverride,
        dispatchedTo:     finalTo,
        dispatch,
    });
});

// ── POST /send-whatsapp — Twilio-backed WhatsApp send ────────────────────────
//
// Single-step "send a WhatsApp message now" path.  Routes through the
// existing approval gate (creates a PENDING approval, then approves it
// on behalf of the caller) so the audit trail is identical to the
// Composer flow, and adds a TWILIO_WHATSAPP-specific dispatch event.
//
// Body:
//   {
//     customer_id : string  (required)
//     body        : string  (required; if omitted, uses approval push.body
//                            or sms.body as a fallback)
//     from        : string? (override TWILIO_WHATSAPP_FROM)
//     to          : string? (override recipient — defaults to sandbox)
//     approval_id : string? (reuse an existing pending approval)
//     reviewed_by : string? (defaults to req.user.username)
//   }
//
// Returns:
//   { status:'ok', approvalId, dispatch:{messageSid,to,from,status,...},
//     customerPhone, bodyPreview, sandboxOverride }

router.post('/send-whatsapp', verifyToken, async (req, res) => {
    const {
        customer_id, body, from, to,
        approval_id, reviewed_by,
    } = req.body || {};

    if (!customer_id)
        return res.status(400).json({ status: 'error', message: 'customer_id is required' });

    const actor    = reviewed_by || req.user?.username || 'rm_user';
    const customer = await ds.getCustomerById(customer_id);
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    // DPDPA + TRAI consent check on PUSH channel (WhatsApp falls under
    // the same DCA framework as SMS / push notifications in the demo).
    const consentCheck = consentSvc.canSendOutreach(customer_id, 'PUSH');
    if (!consentCheck.allowed) {
        await auditLog.logEvent({
            eventType:  'OUTREACH_BLOCKED',
            customerId: customer_id,
            actor,
            layer:      'HERALD',
            payload:    { channel: 'WHATSAPP', reason: consentCheck.reason, source: 'send-whatsapp-twilio' },
            modelVersion: 'HERALD-v1.0',
        });
        return res.status(403).json({
            status:  'error',
            message: `WHATSAPP blocked: ${consentCheck.reason}`,
            reason:  consentCheck.reason,
        });
    }

    // Resolve the body: prefer the supplied body, otherwise reuse the
    // push.body from the cached HERALD record, then sms.body as a
    // fallback, then a templated retention offer.
    let messageBody = body;
    if (!messageBody) {
        const cached = await ds.getHerald(customer_id);
        messageBody = cached?.sms?.body || cached?.push?.body || '';
    }
    if (!messageBody) {
        return res.status(400).json({
            status:  'error',
            message: 'body is required (or generate HERALD content first)',
        });
    }

    const compassRecommendation = {
        offer:     'personalised_retention',
        channel:   'whatsapp',
        timing:    'immediate',
        rationale: 'Twilio-backed direct WhatsApp dispatch from the RM Outreach tab.',
    };

    // Build a synthetic approval record so the audit trail is consistent
    // with the email / multi-channel flows.
    const heraldContent = {
        push: { title: 'Union Bank', body: messageBody, compliance_status: 'pending' },
    };

    let approvalId = approval_id;
    if (approvalId) {
        const existing = approvalSvc.getApprovalById(approvalId);
        if (!existing) return res.status(404).json({ status: 'error', message: `Approval ${approvalId} not found` });
        if (existing.status !== 'PENDING')
            return res.status(409).json({ status: 'error', message: `Approval ${approvalId} is ${existing.status}` });
    } else {
        approvalId = await approvalSvc.createApprovalRequest(customer_id, actor, compassRecommendation, heraldContent);
    }

    let approval;
    try {
        approval = await approvalSvc.approveOutreach(approvalId, actor);
    } catch (err) {
        return res.status(400).json({ status: 'error', message: err.message });
    }

    // Determine the actual recipient.  Twilio's WhatsApp sandbox can
    // only deliver to numbers that have joined the sandbox (by texting
    // the join keyword).  For the demo, default to the number the team
    // registered.  In production, set WA_SANDBOX_OVERRIDE=false.
    const sandboxOverride = waTwilio.WA_SANDBOX_OVERRIDE_ON;
    const requestedTo     = to || customer.phone;
    const finalTo         = sandboxOverride ? waTwilio.WA_SANDBOX_OVERRIDE_TO : requestedTo;

    let dispatch;
    try {
        dispatch = await waTwilio.sendWhatsapp({
            to:         finalTo,
            from,
            body:       messageBody,
            customerId: customer_id,
            metadata: {
                approvalId,
                customerPhone: customer.phone,
                sandboxOverride,
                provider: 'twilio-whatsapp',
            },
        });
    } catch (err) {
        await auditLog.logEvent({
            eventType:  'OUTREACH_BLOCKED',
            customerId: customer_id,
            actor,
            layer:      'HERALD',
            payload:    { channel: 'WHATSAPP', reason: err.code || 'TWILIO_ERROR', detail: err.message, approvalId },
            modelVersion: 'HERALD-v1.0',
        });
        return res.status(502).json({
            status:  'error',
            message: err.message,
            code:    err.code || 'TWILIO_ERROR',
            approvalId,
        });
    }

    const contentHash = crypto.createHash('sha256').update(messageBody).digest('hex');

    await auditLog.logEvent({
        eventType:  'OUTREACH_WHATSAPP_DISPATCHED',
        customerId: customer_id,
        actor,
        layer:      'HERALD',
        payload: {
            approvalId,
            provider:     'twilio-whatsapp',
            messageSid:   dispatch.messageSid,
            to:           finalTo,
            requestedTo,
            from:         dispatch.from,
            sandboxOverride,
            contentHash,
        },
        modelVersion: 'HERALD-v1.0',
    });

    await auditLog.logEvent({
        eventType:  'OUTREACH_SENT',
        customerId: customer_id,
        actor,
        layer:      'HERALD',
        payload: { approvalId, channel: 'WHATSAPP', contentHash, provider: 'twilio-whatsapp', messageSid: dispatch.messageSid },
        modelVersion: 'HERALD-v1.0',
    });

    res.json({
        status:           'ok',
        approvalId,
        customerPhone:    customer.phone,
        bodyPreview:      messageBody.slice(0, 240),
        sandboxOverride,
        dispatchedTo:     finalTo,
        dispatch,
    });
});

// ── POST /approve/:approvalId ─────────────────────────────────────────────────

router.post('/approve/:approvalId', verifyToken, async (req, res) => {
    const { approvalId } = req.params;
    const reviewedBy    = req.body?.reviewedBy || req.user?.username || 'rm_user';

    try {
        const approval = await approvalSvc.approveOutreach(approvalId, reviewedBy);
        const { customerId, heraldContent, compassRecommendation } = approval;
        const customer = await ds.getCustomerById(customerId);

        const channels        = ['EMAIL', 'SMS', 'PUSH'];
        const sentChannels    = [];
        const blockedChannels = [];
        const traiMetadata    = [];

        for (const ch of channels) {
            const check = consentSvc.canSendOutreach(customerId, ch);
            if (!check.allowed) {
                blockedChannels.push({ channel: ch, reason: check.reason });
                await auditLog.logEvent({ eventType: 'OUTREACH_BLOCKED', customerId, actor: reviewedBy, layer: 'HERALD', payload: { approvalId, channel: ch, reason: check.reason }, modelVersion: 'HERALD-v1.0' });
                continue;
            }
            if (ch === 'SMS' && customer?.phone) {
                const dnd = traiSvc.checkDndRegistry(customer.phone);
                if (dnd.onDnd) { blockedChannels.push({ channel: ch, reason: 'DND_REGISTRY' }); continue; }
            }
            const contentForChannel = ch === 'EMAIL' ? heraldContent?.email?.body || '' : ch === 'SMS' ? heraldContent?.sms?.body || '' : heraldContent?.push?.body || '';
            let meta;
            try {
                meta = traiSvc.buildOutreachMetadata(customerId, ch, contentForChannel, 'DEMO-DLT-001');
                traiMetadata.push(meta);
            } catch { blockedChannels.push({ channel: ch, reason: 'DLT_NOT_REGISTERED' }); continue; }

            const contentHash = crypto.createHash('sha256').update(contentForChannel).digest('hex');
            await auditLog.logEvent({ eventType: 'OUTREACH_SENT', customerId, actor: reviewedBy, layer: 'HERALD', payload: { approvalId, channel: ch, contentHash, traiType: meta.outreachType, numberSeries: meta.requiredNumberSeries }, modelVersion: 'HERALD-v1.0' });
            sentChannels.push(ch);
        }

        res.json({ status: 'ok', approvalId, sentChannels, blockedChannels, traiMetadata });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

// ── GET /languages — list supported target languages for the UI ──────
router.get('/languages', verifyToken, async (req, res) => {
  try {
    const { listLanguages } = require('../services/translationService');
    const result = await listLanguages();
    res.json({ status: 'ok', ...result });
  } catch (err) {
    const code = err.httpStatus || 500;
    res.status(code).json({
      status: 'error',
      stage: 5, stage_name: 'translation',
      message: err.message,
    });
  }
});

// ── GET /:id (must come after named routes like /languages /campaigns) ───

router.get('/:id', verifyToken, async (req, res) => {
    if (['campaigns', 'pending', 'job', 'languages', 'approval'].includes(req.params.id))
        return res.status(404).json({ status: 'error', message: 'Not found' });
    const record = outreachLog.find(o => o.id === req.params.id);
    if (!record) return res.status(404).json({ status: 'error', message: 'Not found' });
    const herald = await ds.getHerald(record.customer_id);
    res.json({ status: 'ok', data: { ...record, full_content: herald } });
});

// ── POST /translate — generic GCP translation (legacy API) ───────────────
router.post('/translate', verifyToken, async (req, res) => {
  const { customer_id, content, target_language } = req.body;
  if (!customer_id || !content || !target_language)
    return res.status(400).json({ status: 'error', message: 'customer_id, content, and target_language required' });

  try {
    const customer = await ds.getCustomerById(customer_id);
    if (!customer) return res.status(404).json({ status: 'error', message: 'Customer not found' });
    const firstName = customer.first_name || customer.full_name?.split(' ')[0] || 'Customer';

    const { translateOutreach } = require('../services/translationService');
    const result = await translateOutreach(content, target_language, firstName);

    await auditLog.logEvent({
      eventType:    'OUTREACH_TRANSLATED',
      customerId:   customer_id,
      actor:        req.user?.username || 'rm_user',
      layer:        'HERALD',
      payload:      {
        target_language,
        content_hash: require('crypto').createHash('sha256').update(JSON.stringify(content)).digest('hex'),
      },
      modelVersion: 'HERALD-v1.0',
    });

    res.json({ status: 'ok', ...result });
  } catch (err) {
    const code = err.httpStatus || 500;
    res.status(code).json({
      status: 'error',
      stage: 5, stage_name: 'translation',
      message: err.message,
    });
  }
});

// ── POST /translate-herald — convenience for the dashboard UI ────────────
//   Body: { herald, target }  →  same shape as translateContent().
router.post('/translate-herald', verifyToken, async (req, res) => {
  const { herald, target } = req.body;
  if (!herald || !target)
    return res.status(400).json({ status: 'error', message: 'herald and target are required' });
  try {
    const { translateContent } = require('../services/translationService');
    const result = await translateContent({ herald, target });
    await auditLog.logEvent({
      eventType:    'OUTREACH_TRANSLATED',
      customerId:   null,
      actor:        req.user?.username || 'rm_user',
      layer:        'HERALD',
      payload:      {
        target_language: target,
        mode:            result.mode,
        content_hash:    require('crypto').createHash('sha256').update(JSON.stringify(herald)).digest('hex'),
      },
      modelVersion: 'HERALD-v1.0',
    }).catch(() => {});
    res.json({ status: 'ok', ...result });
  } catch (err) {
    const code = err.httpStatus || 500;
    res.status(code).json({
      status: 'error',
      stage: 5, stage_name: 'translation',
      message: err.message,
    });
  }
});

// ── GET /call-script/:customerId — HERALD pre-call brief ─────────────────────
router.get('/call-script/:customerId', verifyToken, async (req, res) => {
  try {
    const snap = await ds.getCustomerSnapshot(req.params.customerId);
    if (!snap) return res.status(404).json({ status: 'error', message: 'Customer not found' });

    const { generateCallScript } = require('../services/callAnalysisService');
    const script = await generateCallScript(
      snap.customer,
      snap.score,
      snap.signals?.signals || [],
      snap.plan,
      [],  // RAG passages — wired when COMPASS is running
    );

    res.json({ status: 'ok', customer_id: req.params.customerId, script });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /reject/:approvalId ──────────────────────────────────────────────────

router.post('/reject/:approvalId', verifyToken, async (req, res) => {
    const { approvalId }    = req.params;
    const { rejectionReason } = req.body;
    const reviewedBy        = req.body?.reviewedBy || req.user?.username || 'rm_user';
    try {
        await approvalSvc.rejectOutreach(approvalId, reviewedBy, rejectionReason || 'No reason provided');
        res.json({ status: 'ok', approvalId });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
