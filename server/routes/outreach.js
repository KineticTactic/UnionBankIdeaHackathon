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
const { verifyToken } = require('../middleware/auth');
const ds          = require('../services/dataStore');
const consentSvc  = require('../services/consentService');
const approvalSvc = require('../services/approvalService');
const traiSvc     = require('../services/traiComplianceService');
const auditLog    = require('../services/auditLogService');
const { enqueueHerald, getJobStatus } = require('../queue/heraldQueue');

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

// ── GET /:id (must come after named routes) ────────────────────────────────────

router.get('/:id', verifyToken, async (req, res) => {
    if (['campaigns', 'pending', 'job'].includes(req.params.id))
        return res.status(404).json({ status: 'error', message: 'Not found' });
    const record = outreachLog.find(o => o.id === req.params.id);
    if (!record) return res.status(404).json({ status: 'error', message: 'Not found' });
    const herald = await ds.getHerald(record.customer_id);
    res.json({ status: 'ok', data: { ...record, full_content: herald } });
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

// Synchronous fallback used when Redis/BullMQ is unavailable (DEMO_MODE)
async function _syncGenerate(req, res, snap, requestedBy) {
    const { customer_id } = snap.customer || snap;
    const id = snap.customer?.customer_id || customer_id;

    const channels     = ['EMAIL', 'SMS', 'PUSH'];
    const consentStatus = {};
    for (const ch of channels) consentStatus[ch] = consentSvc.canSendOutreach(id, ch);
    const allowedChannels = channels.filter(ch => consentStatus[ch].allowed);

    const cached = await ds.getHerald(id);
    const heraldContent = cached || { email: { body: '' }, sms: { body: '' }, push: { body: '' } };

    const plan = snap.plan || {};
    const compassRecommendation = {
        offer:     plan.offer_display || plan.offer_code || 'personalised_offer',
        channel:   plan.channel       || 'email',
        timing:    plan.timing        || 'immediate',
        rationale: plan.rationale     || 'High churn risk detected by CHRONOS ensemble.',
    };

    const approvalId = await approvalSvc.createApprovalRequest(id, requestedBy, compassRecommendation, heraldContent);

    await auditLog.logEvent({
        eventType:    'OUTREACH_QUEUED',
        customerId:   id,
        actor:        requestedBy,
        layer:        'HERALD',
        payload:      { approvalId, allowedChannels, consentStatus },
        modelVersion: 'HERALD-v1.0',
    });

    res.json({
        status:           'ok',
        approvalId,
        pendingApproval:  true,
        message:          'Outreach queued for RM review — DPDPA/TRAI compliant approval required before send.',
        compassRecommendation,
        heraldContent,
        consentStatus,
        allowedChannels,
    });
}

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
