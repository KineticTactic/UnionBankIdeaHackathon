/**
 * /api/outreach — HERALD content generation + approval gate + campaign endpoints.
 * RBI AI Governance 2024 — Human override required before adverse customer-facing AI actions.
 * DPDPA 2023 + TRAI TCCCPR 2025 — consent verified before every outreach action.
 */
const router   = require('express').Router();
const https    = require('https');
const crypto   = require('crypto');
const { verifyToken } = require('../middleware/auth');
const ds             = require('../services/dataStore');
const consentSvc     = require('../services/consentService');
const approvalSvc    = require('../services/approvalService');
const traiSvc        = require('../services/traiComplianceService');
const auditLog       = require('../services/auditLogService');
const compliance     = require('../config/compliance');

// ── NVIDIA DeepSeek helper ─────────────────────────────────────────────────────
const NVIDIA_ENDPOINT = process.env.NVIDIA_ENDPOINT ||
    'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_KEY   = process.env.NVIDIA_API_KEY || '';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL   || 'deepseek-ai/deepseek-v4-pro';

function callNvidia(messages, maxTokens = 600) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ model: NVIDIA_MODEL, messages, max_tokens: maxTokens, temperature: 0.7 });
        const url  = new URL(NVIDIA_ENDPOINT);
        const opts = {
            hostname: url.hostname,
            path:     url.pathname + url.search,
            method:   'POST',
            headers:  {
                'Content-Type':   'application/json',
                'Authorization':  `Bearer ${NVIDIA_KEY}`,
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const req = https.request(opts, (r) => {
            let data = '';
            r.on('data', d => { data += d; });
            r.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error(`JSON parse error: ${data.slice(0,200)}`)); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── In-memory outreach log (seeded from herald data) ─────────────────────────
const outreachLog = ds.HERALD.map((h, i) => ({
    id:              `OR-${String(i+1).padStart(4,'0')}`,
    customer_id:     h.customer_id,
    channel:         h.risk_tier === 'PRIORITY' ? 'phone' :
                     h.risk_tier === 'ESCALATE' ? 'email' : 'sms',
    risk_tier:       h.risk_tier,
    status:          ['sent','delivered','opened','clicked'][Math.floor(Math.random()*4)],
    offer_code:      ds.PLANS_MAP[h.customer_id]?.offer_code || 'NONE',
    dispatched_at:   new Date(Date.now() - Math.random()*7*86400_000).toISOString(),
    content_preview: h.email?.body?.slice(0, 120) + '...',
}));

const CAMPAIGNS = [
    { id: 'C001', name: 'Q1 Retention Drive',   status: 'active',    channel: 'email', customers: 18, opens: 11, conversions: 4 },
    { id: 'C002', name: 'High-Risk SMS Blitz',   status: 'active',    channel: 'sms',   customers: 10, opens: 7,  conversions: 2 },
    { id: 'C003', name: 'VIP Loyalty Programme', status: 'completed', channel: 'phone', customers: 8,  opens: 8,  conversions: 6 },
];

// ── Existing list/campaign routes (unchanged) ─────────────────────────────────

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
    res.json({ status: 'ok', total: list.length, page: p, limit: l, records: list.slice((p-1)*l, p*l) });
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

router.get('/:id', verifyToken, (req, res) => {
    // Must come after named routes above
    if (['campaigns','pending'].includes(req.params.id))
        return res.status(404).json({ status: 'error', message: 'Not found' });
    const record = outreachLog.find(o => o.id === req.params.id);
    if (!record) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: { ...record, full_content: ds.getHerald(record.customer_id) } });
});

// ── POST /api/outreach/generate — HERALD with human-in-the-loop gate ──────────
router.post('/generate', verifyToken, async (req, res) => {
    const { customer_id } = req.body;
    if (!customer_id)
        return res.status(400).json({ status: 'error', message: 'customer_id required' });

    const snap = ds.getCustomerSnapshot(customer_id);
    if (!snap)
        return res.status(404).json({ status: 'error', message: 'Customer not found' });

    const { customer: c, score, signals, plan } = snap;

    // Check consent for all channels before generating
    const channels = ['EMAIL', 'SMS', 'PUSH'];
    const consentStatus = {};
    for (const ch of channels) {
        consentStatus[ch] = consentSvc.canSendOutreach(customer_id, ch);
    }
    const allowedChannels = channels.filter(ch => consentStatus[ch].allowed);

    // If no NVIDIA key, queue with cached content
    let heraldContent;
    if (!NVIDIA_KEY) {
        const cached = ds.getHerald(customer_id);
        heraldContent = cached || { email: { body: '' }, sms: { body: '' }, push: { body: '' } };
    } else {
        const firstName  = c.first_name || c.full_name.split(' ')[0];
        const tier       = score?.risk_tier || c.risk_tier;
        const offerText  = plan?.offer_display || plan?.offer_code?.replace(/_/g,' ') || 'a personalised banking offer';
        const channel    = plan?.channel || 'email';

        const signalDetails = signals.length > 0
            ? signals.map(s => {
                const desc = {
                    balance_decline:      'account balance has been steadily declining over the past weeks',
                    inactivity:           `no transactions for ${c.inactivity_days} days — account appears dormant`,
                    login_drop:           `app logins dropped to ${c.app_logins_30d} in the last 30 days`,
                    salary_miss:          `salary credits have stopped — only ${c.salary_credit_count} credits in last 3 months`,
                    complaint_spike:      `${c.complaint_count} service complaint(s) filed recently`,
                    digital_ratio_drop:   `digital channel usage has dropped to ${Math.round(c.digital_ratio*100)}%`,
                    competitor_transfer:  'large outward transfers detected to competitor bank accounts',
                    txn_frequency_drop:   `transaction frequency dropped to ${c.txn_freq_90d} in last 90 days`,
                    atm_spike:            `unusual ATM withdrawal activity — ${c.atm_withdrawals_90d} withdrawals in 90 days`,
                }[s.signal_type] || s.signal_type.replace(/_/g,' ');
                return `  • ${s.signal_type.replace(/_/g,' ')} (${s.method}, confidence ${Math.round(s.confidence*100)}%, active ${s.days_active} days): ${desc}`;
              }).join('\n')
            : '  • No active behavioural signals detected';

        const lifeEventContext = c.life_event
            ? `LIFE EVENT DETECTED: ${c.life_event.replace(/_/g,' ')} — acknowledge sensitively.`
            : '';

        const urgencyInstruction = tier === 'PRIORITY'
            ? 'URGENCY: HIGH. Multiple strong distress signals. Write with genuine warmth and urgency.'
            : tier === 'ESCALATE'
            ? 'URGENCY: MEDIUM. Engagement declining. Reconnection message focusing on loyalty value.'
            : 'URGENCY: LOW. Stable but engagement could improve. Appreciative, value-adding message.';

        const systemPrompt = `You are HERALD, the AI personalisation engine for Union Bank's customer retention platform.
Write hyper-personalised, empathetic, compliance-safe outreach content.
STRICT RULES:
1. NEVER use: churn, risk, score, monitored, flagged, alert, detected, warning, attrition
2. NEVER make specific interest rate or return promises
3. Every sentence must feel written specifically for this person
4. Address customer by first name throughout
5. All content must be complete — no ellipsis as placeholder
6. Sign off warmly as Union Bank`;

        const userPrompt = `Write personalised retention outreach for this customer.
Return ONLY valid raw JSON. No markdown fences, no explanation.

CUSTOMER: ${c.full_name} (${customer_id}) | Age: ${c.age} | City: ${c.city} | Segment: ${c.segment}
TENURE: ${c.tenure_months} months | Balance: ₹${c.balance?.toLocaleString('en-IN')} | NPS: ${c.nps}/10
SIGNALS:\n${signalDetails}
${lifeEventContext}
OFFER: ${offerText} | CHANNEL: ${channel}
${urgencyInstruction}

Return:
{"email":{"subject":"...","body":"...","compliance_status":"APPROVED","word_count":0},"sms":{"body":"...","compliance_status":"APPROVED","char_count":0},"push":{"title":"...","body":"...","compliance_status":"APPROVED"}}`;

        try {
            const resp = await callNvidia([
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt },
            ], 1200);

            const raw = resp?.choices?.[0]?.message?.content || '';
            const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            heraldContent = JSON.parse(cleaned);
            if (heraldContent.email?.body)
                heraldContent.email.word_count = heraldContent.email.body.trim().split(/\s+/).length;
            if (heraldContent.sms?.body)
                heraldContent.sms.char_count = heraldContent.sms.body.length;
        } catch (err) {
            console.error('[HERALD] NVIDIA call failed:', err.message);
            const cached = ds.getHerald(customer_id);
            heraldContent = cached || { email: { body: '' }, sms: { body: '' }, push: { body: '' } };
        }
    }

    const compassRecommendation = {
        offer:     plan?.offer_display || plan?.offer_code || 'personalised_offer',
        channel:   plan?.channel       || 'email',
        timing:    plan?.timing        || 'immediate',
        rationale: plan?.rationale     || 'High churn risk detected by CHRONOS ensemble.',
    };

    // RBI AI Governance 2024 — queue for human approval before sending
    const requestedBy = req.user?.username || 'system';
    const approvalId  = await approvalSvc.createApprovalRequest(
        customer_id, requestedBy, compassRecommendation, heraldContent
    );

    await auditLog.logEvent({
        eventType:    'OUTREACH_QUEUED',
        customerId:   customer_id,
        actor:        requestedBy,
        layer:        'HERALD',
        payload:      { approvalId, allowedChannels, consentStatus },
        modelVersion: 'HERALD-v1.0',
    });

    res.json({
        status:        'ok',
        approvalId,
        pendingApproval: true,
        message:       'Outreach queued for RM review — DPDPA/TRAI compliant approval required before send.',
        compassRecommendation,
        heraldContent,
        consentStatus,
        allowedChannels,
    });
});

// ── POST /api/outreach/approve/:approvalId ─────────────────────────────────────
router.post('/approve/:approvalId', verifyToken, async (req, res) => {
    const { approvalId } = req.params;
    const reviewedBy = req.body?.reviewedBy || req.user?.username || 'rm_user';

    try {
        const approval = await approvalSvc.approveOutreach(approvalId, reviewedBy);
        const { customerId, heraldContent, compassRecommendation } = approval;
        const customer = ds.getCustomerById(customerId);

        // Re-check consent after approval (consent may have changed in the interim)
        const channels = ['EMAIL', 'SMS', 'PUSH'];
        const sentChannels    = [];
        const blockedChannels = [];
        const traiMetadata    = [];

        for (const ch of channels) {
            const check = consentSvc.canSendOutreach(customerId, ch);
            if (!check.allowed) {
                blockedChannels.push({ channel: ch, reason: check.reason });
                await auditLog.logEvent({
                    eventType:    'OUTREACH_BLOCKED',
                    customerId,
                    actor:        reviewedBy,
                    layer:        'HERALD',
                    payload:      { approvalId, channel: ch, reason: check.reason },
                    modelVersion: 'HERALD-v1.0',
                });
                continue;
            }

            // TRAI TCCCPR 2025 — DND check for SMS
            if (ch === 'SMS' && customer?.phone) {
                const dnd = traiSvc.checkDndRegistry(customer.phone);
                if (dnd.onDnd) {
                    blockedChannels.push({ channel: ch, reason: 'DND_REGISTRY' });
                    continue;
                }
            }

            const contentForChannel = ch === 'EMAIL'
                ? heraldContent?.email?.body || ''
                : ch === 'SMS' ? heraldContent?.sms?.body || '' : heraldContent?.push?.body || '';

            let meta;
            try {
                meta = traiSvc.buildOutreachMetadata(customerId, ch, contentForChannel, 'DEMO-DLT-001');
                traiMetadata.push(meta);
            } catch {
                blockedChannels.push({ channel: ch, reason: 'DLT_NOT_REGISTERED' });
                continue;
            }

            // Log send — content stored as SHA-256 hash only (no real PII in logs)
            const contentHash = crypto.createHash('sha256').update(contentForChannel).digest('hex');
            await auditLog.logEvent({
                eventType:    'OUTREACH_SENT',
                customerId,
                actor:        reviewedBy,
                layer:        'HERALD',
                payload:      { approvalId, channel: ch, contentHash, traiType: meta.outreachType, numberSeries: meta.requiredNumberSeries },
                modelVersion: 'HERALD-v1.0',
            });
            sentChannels.push(ch);
        }

        res.json({ status: 'ok', approvalId, sentChannels, blockedChannels, traiMetadata });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

// ── POST /api/outreach/reject/:approvalId ─────────────────────────────────────
router.post('/reject/:approvalId', verifyToken, async (req, res) => {
    const { approvalId } = req.params;
    const { rejectionReason } = req.body;
    const reviewedBy = req.body?.reviewedBy || req.user?.username || 'rm_user';

    try {
        await approvalSvc.rejectOutreach(approvalId, reviewedBy, rejectionReason || 'No reason provided');
        res.json({ status: 'ok', approvalId });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
