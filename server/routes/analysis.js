const router  = require('express').Router();
const https   = require('https');
const { verifyToken } = require('../middleware/auth');
const config = require('../config');
const ds = require('../services/dataStore');

const NVIDIA_ENDPOINT = config.nvidia.endpoint;
const NVIDIA_KEY      = config.nvidia.apiKey;
const NVIDIA_MODEL    = config.nvidia.model;

function callNvidia(messages) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ model: NVIDIA_MODEL, messages, max_tokens: 400, temperature: 0.4 });
        const url  = new URL(NVIDIA_ENDPOINT);
        const opts = {
            hostname: url.hostname,
            path:     url.pathname + url.search,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NVIDIA_KEY}`,
                        'Content-Length': Buffer.byteLength(body) },
            timeout:  config.nvidia.timeoutMs,
        };
        const req = https.request(opts, (r) => {
            let data = '';
            r.on('data', d => { data += d; });
            r.on('end', () => { try { resolve(JSON.parse(data)); } catch(e){ reject(e); } });
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error(`NVIDIA request timed out after ${config.nvidia.timeoutMs}ms`)));
        req.write(body); req.end();
    });
}

// POST /api/analysis/analyze
router.post('/analyze', verifyToken, async (req, res) => {
    const { customer_id } = req.body;
    if (!customer_id)
        return res.status(400).json({
            error: true, stage: 0, stage_name: 'orchestrator',
            message: 'customer_id required',
        });

    const snap = await ds.getCustomerSnapshot(customer_id);
    if (!snap) return res.status(404).json({
        error: true, stage: 0, stage_name: 'orchestrator',
        message: `Customer ${customer_id} not found`,
    });

    if (!NVIDIA_KEY) {
        // Rule A: never return a hand-written mock analysis.  Surface a
        // structured error so the operator knows to set NVIDIA_API_KEY.
        return res.status(503).json({
            error: true, stage: 0, stage_name: 'analysis',
            message: 'AI analysis unavailable: NVIDIA_API_KEY is not configured. '
                    + 'Set it in the .env file (see .env.example) to enable risk analysis.',
            detail: 'NVIDIA_API_KEY is empty',
        });
    }

    const { customer, score, signals } = snap;
    const sysPrompt = (
        'You are a senior bank risk analyst. Write a concise (max 180 words) ' +
        'risk assessment. Cover: (1) key churn drivers, (2) recommended intervention, ' +
        '(3) urgency. Be specific and cite the signals provided.'
    );
    const userPrompt =
        `Customer: ${customer.full_name} | ${customer.segment} | ${customer.tenure_months}mo tenure\n` +
        `Churn score: ${score?.final_score} (${score?.risk_tier}) | P(churn<30d): ${score?.p30}\n` +
        `Signals: ${signals.map(s=>s.signal_type).join(', ')||'none'}\n` +
        `Life event: ${customer.life_event||'none'} | Balance: ₹${customer.balance?.toLocaleString('en-IN')}\n` +
        `Inactivity: ${customer.inactivity_days}d | Complaints: ${customer.complaint_count}`;

    try {
        const resp = await callNvidia([
            { role: 'system', content: sysPrompt },
            { role: 'user',   content: userPrompt },
        ]);
        const text = resp?.choices?.[0]?.message?.content || 'Analysis unavailable.';
        res.json({ status: 'ok', analysis: text, source: 'nvidia' });
    } catch (err) {
        res.status(502).json({
            error: true, stage: 0, stage_name: 'analysis',
            message: `NVIDIA DeepSeek call failed: ${err.message}`,
        });
    }
});

module.exports = router;
