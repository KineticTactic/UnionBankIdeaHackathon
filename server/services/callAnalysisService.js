'use strict';
const { callNvidia } = require('./llmClient');

const ANALYSIS_SYSTEM = `You are an expert banking call analyst for Union Bank.
Your job is to extract structured intelligence from RM-customer call transcripts.
Be accurate, concise, and compliance-aware.
NEVER fabricate information not present in the transcript.
NEVER include full names, phone numbers, or account numbers in extracted fields.
Flag any RM statements that could be mis-selling or non-compliant.`;

async function analyzeCall(transcript, customer) {
  const firstName = customer.first_name || customer.full_name?.split(' ')[0] || 'Customer';

  const messages = [
    { role: 'system', content: ANALYSIS_SYSTEM },
    {
      role: 'user',
      content: `Analyze this Union Bank RM-customer call transcript and extract structured intelligence.
Return ONLY valid raw JSON. No markdown fences, no explanation.

CUSTOMER CONTEXT:
- Name: ${firstName} | Segment: ${customer.segment} | City: ${customer.city}
- Risk Tier: ${customer.risk_tier} | Balance: ₹${(customer.balance||0).toLocaleString('en-IN')}

TRANSCRIPT:
${transcript}

Return this exact JSON structure:
{
  "summary": "2-3 sentence neutral summary of the call",
  "detected_language": "en|hi|ta|bn|te|mr|ml|kn|gu|pa",
  "sentiment": "negative|neutral|positive",
  "sentiment_score": -1.0 to 1.0,
  "contacted": true|false,
  "outcome": "converted|retained|neutral|declined|unreachable|churned",
  "offer_presented": "offer code or null",
  "offer_accepted": true|false|null,
  "objections": ["list of customer objections"],
  "rebuttals_that_worked": ["list of RM responses that worked"],
  "commitments": ["list of commitments made"],
  "life_events_mentioned": ["list of life events"],
  "competitor_mentions": ["competitor name and offer if mentioned"],
  "channel_timing_preference": "string or null",
  "risk_drivers_voiced": ["list of risk drivers the customer mentioned"],
  "follow_up_required": true|false,
  "follow_up_date": "ISO date or null",
  "compliance_flags": ["list any potentially non-compliant RM statements"],
  "rm_action_items": ["list of action items for the RM"]
}`,
    },
  ];

  const resp = await callNvidia(messages, 1200);
  const raw = resp.choices?.[0]?.message?.content || '{}';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function generateCallScript(customer, score, signals, plan, ragPassages) {
  const firstName = customer.first_name || customer.full_name?.split(' ')[0] || 'Customer';

  const signalText = (signals || [])
    .filter(s => s.detected)
    .map(s => `  • ${s.signal_type.replace(/_/g,' ')} (confidence ${Math.round((s.confidence||0)*100)}%)`)
    .join('\n') || '  • No active signals';

  const passageText = (ragPassages || []).length > 0
    ? ragPassages.map(p => `  - ${p}`).join('\n')
    : '  - No specific playbook passages found';

  const messages = [
    {
      role: 'system',
      content: `You are HERALD, the AI assistant for Union Bank RMs.
Generate a concise pre-call brief to help the RM have a productive call.
RULES: Be specific to this customer. No guaranteed returns. No churn/risk language.
Use neutral, professional, empathetic language.`,
    },
    {
      role: 'user',
      content: `Generate a pre-call script for RM calling customer ${firstName}.
Return ONLY valid raw JSON. No markdown fences.

CUSTOMER: ${customer.full_name} (${customer.customer_id}) | ${customer.segment} | ${customer.city}
TENURE: ${customer.tenure_months}mo | Balance: ₹${(customer.balance||0).toLocaleString('en-IN')} | NPS: ${customer.nps}/10
RISK TIER: ${score?.risk_tier || customer.risk_tier}
ACTIVE SIGNALS:\n${signalText}
RECOMMENDED OFFER: ${plan?.offer_display || plan?.offer_code || 'Personalised banking offer'}
PLAYBOOK INSIGHTS:\n${passageText}
PREFERRED LANGUAGE: ${customer.preferred_language || 'en'}

Return:
{
  "talking_points": ["3-5 specific conversation starters"],
  "recommended_offer": "one-line offer description",
  "top_risk_drivers": ["2-3 key concern areas to address"],
  "likely_objections": ["2-3 objections the customer may raise"],
  "rebuttals": ["matching rebuttals from playbook"],
  "suggested_language": "${customer.preferred_language || 'en'}",
  "suggested_opening": "one warm opening sentence",
  "compliance_note": "any compliance reminder for this call type"
}`,
    },
  ];

  const resp = await callNvidia(messages, 800);
  const raw = resp.choices?.[0]?.message?.content || '{}';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { analyzeCall, generateCallScript };
