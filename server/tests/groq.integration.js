/**
 * groq.integration.js — OPTIONAL manual integration test.
 *
 *   npm run test:integration          (from server/, with GROQ_API_KEY set)
 *
 * Makes ONE real request to Groq only when GROQ_API_KEY is explicitly supplied.
 * Uses a synthetic demo customer — never send real customer data.
 * Skipped (exit 0) when no key is configured, so it is safe to run anywhere.
 */

'use strict';

const config = require('../config');
const { callLLM, isConfigured } = require('../services/llmClient');
const { buildHeraldPrompts, parseHeraldResponse } = require('../services/heraldPrompt');

(async () => {
    if (!isConfigured()) {
        console.log('SKIP: GROQ_API_KEY is not set — integration test not run.');
        return;
    }

    const snapshot = {
        customer: {
            customer_id: 'C-SYNTH0001',
            full_name: 'Asha Rao',
            first_name: 'Asha',
            age: 34,
            city: 'Pune',
            segment: 'Priority',
            tenure_months: 42,
            balance: 185000,
            nps: 6,
            risk_tier: 'ESCALATE',
        },
        score: { risk_tier: 'ESCALATE', final_score: 0.71 },
        signals: [
            { signal_type: 'inactivity', method: 'rules', confidence: 0.8, days_active: 21 },
        ],
        plan: { offer_display: 'a personalised savings review', channel: 'email' },
    };

    const { systemPrompt, userPrompt } = buildHeraldPrompts(snapshot);
    console.log(`Calling Groq (model=${config.groq.model}) …`);

    const resp = await callLLM([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
    ], 1200);

    const raw = resp.choices?.[0]?.message?.content || '';
    const content = parseHeraldResponse(raw);

    if (!content?.email?.body || !content?.sms?.body || !content?.push?.body) {
        console.error('FAIL: completion missing one or more channels.');
        process.exit(1);
    }

    console.log('PASS: live Groq generation returned email/sms/push content.');
    console.log('--- email.subject ---\n' + content.email.subject);
    console.log('--- email.body (first 200 chars) ---\n' + content.email.body.slice(0, 200));
})().catch(err => {
    console.error(`FAIL: ${err.category || 'error'} (${err.status || 'n/a'})`);
    process.exit(1);
});
