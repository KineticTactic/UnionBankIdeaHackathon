'use strict';
/**
 * HERALD prompt construction — extracted from routes/outreach.js so both the
 * HTTP route and the BullMQ worker use exactly one copy.
 */

const SYSTEM_PROMPT = `You are HERALD, the AI personalisation engine for Union Bank's customer retention platform.
Write hyper-personalised, empathetic, compliance-safe outreach content.
STRICT RULES:
1. NEVER use: churn, risk, score, monitored, flagged, alert, detected, warning, attrition
2. NEVER make specific interest rate or return promises
3. Every sentence must feel written specifically for this person
4. Address customer by first name throughout
5. All content must be complete — no ellipsis as placeholder
6. Sign off warmly as Union Bank

OUTPUT FORMAT — return ONLY a single raw JSON object (no markdown, no commentary) with EXACTLY this shape:
{
  "email":   {"subject": "<= 80 chars, personal>", "body": "<= 1200 chars, 2-3 short paragraphs>"},
  "sms":     {"body":   "<= 320 chars, conversational>"},
  "push":    {"title":  "<= 60 chars>", "body": "<= 180 chars, action-oriented>"}
}
All three channels are required for every customer.`;

const SIGNAL_DESCRIPTIONS = {
    balance_decline:    (c) => 'account balance has been steadily declining over the past weeks',
    inactivity:         (c) => `no transactions for ${c.inactivity_days} days — account appears dormant`,
    login_drop:         (c) => `app logins dropped to ${c.app_logins_30d} in the last 30 days`,
    salary_miss:        (c) => `salary credits have stopped — only ${c.salary_credit_count} credits in last 3 months`,
    complaint_spike:    (c) => `${c.complaint_count} service complaint(s) filed recently`,
    digital_ratio_drop: (c) => `digital channel usage has dropped to ${Math.round(c.digital_ratio * 100)}%`,
    competitor_transfer:(c) => 'large outward transfers detected to competitor bank accounts',
    txn_frequency_drop: (c) => `transaction frequency dropped to ${c.txn_freq_90d} in last 90 days`,
    atm_spike:          (c) => `unusual ATM withdrawal activity — ${c.atm_withdrawals_90d} withdrawals in 90 days`,
};

/**
 * buildHeraldPrompts({ customer, score, signals, plan }) → { systemPrompt, userPrompt }
 */
function buildHeraldPrompts(snapshot) {
    const { customer: c, score, signals = [], plan } = snapshot;

    const firstName    = c.first_name || c.full_name.split(' ')[0];
    const tier         = score?.risk_tier || c.risk_tier;
    const offerText    = plan?.offer_display || plan?.offer_code?.replace(/_/g, ' ') || 'a personalised banking offer';
    const channel      = plan?.channel || 'email';

    const signalDetails = signals.length > 0
        ? signals.map(s => {
            const descFn = SIGNAL_DESCRIPTIONS[s.signal_type];
            const desc   = descFn ? descFn(c) : s.signal_type.replace(/_/g, ' ');
            return `  • ${s.signal_type.replace(/_/g, ' ')} (${s.method}, confidence ${Math.round(s.confidence * 100)}%, active ${s.days_active} days): ${desc}`;
          }).join('\n')
        : '  • No active behavioural signals detected';

    const lifeEventContext = c.life_event
        ? `LIFE EVENT DETECTED: ${c.life_event.replace(/_/g, ' ')} — acknowledge sensitively.`
        : '';

    const urgencyInstruction = tier === 'PRIORITY'
        ? 'URGENCY: HIGH. Multiple strong distress signals. Write with genuine warmth and urgency.'
        : tier === 'ESCALATE'
        ? 'URGENCY: MEDIUM. Engagement declining. Reconnection message focusing on loyalty value.'
        : 'URGENCY: LOW. Stable but engagement could improve. Appreciative, value-adding message.';

    const userPrompt = `Write personalised retention outreach for this customer.
Return ONLY valid raw JSON. No markdown fences, no explanation.

CUSTOMER: ${c.full_name} (${c.customer_id}) | Age: ${c.age} | City: ${c.city} | Segment: ${c.segment}
TENURE: ${c.tenure_months} months | Balance: ₹${c.balance?.toLocaleString('en-IN')} | NPS: ${c.nps}/10
SIGNALS:\n${signalDetails}
${lifeEventContext}
OFFER: ${offerText} | CHANNEL: ${channel}
${urgencyInstruction}

Return:
{"email":{"subject":"...","body":"...","compliance_status":"APPROVED","word_count":0},"sms":{"body":"...","compliance_status":"APPROVED","char_count":0},"push":{"title":"...","body":"...","compliance_status":"APPROVED"}}`;

    return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * parseHeraldResponse(raw) — strips markdown fences, parses JSON, fills word/char counts.
 */
function parseHeraldResponse(raw) {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const content = JSON.parse(cleaned);
    if (content.email?.body) content.email.word_count = content.email.body.trim().split(/\s+/).length;
    if (content.sms?.body)   content.sms.char_count   = content.sms.body.length;
    return content;
}

module.exports = { buildHeraldPrompts, parseHeraldResponse };
