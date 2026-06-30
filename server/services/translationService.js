'use strict';
const { callNvidia } = require('./llmClient');

const LANG_NAMES = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali',
  te: 'Telugu', mr: 'Marathi', ml: 'Malayalam', kn: 'Kannada',
  gu: 'Gujarati', pa: 'Punjabi',
};

const TRANSLATE_SYSTEM = `You are a professional transcreation specialist for Indian banking communications.
Your job is to transcreate (not literally translate) retention outreach content into the target language.
STRICT RULES:
1. Preserve the offer, tone, and warmth — do NOT literally translate word-for-word
2. NEVER use: churn, risk, score, monitored, flagged, alert, detected, warning, attrition
3. NEVER make specific interest rate or return promises not in the original
4. Address the customer by first name throughout
5. Keep the content natural and culturally appropriate for the target region
6. Maintain all compliance-safe language from the original`;

async function translateOutreach(content, targetLanguage, customerFirstName) {
  const langName = LANG_NAMES[targetLanguage] || targetLanguage;

  const messages = [
    { role: 'system', content: TRANSLATE_SYSTEM },
    {
      role: 'user',
      content: `Transcreate this Union Bank outreach content into ${langName} for customer ${customerFirstName}.
Return ONLY valid raw JSON. No markdown fences, no explanation.

ORIGINAL ENGLISH CONTENT:
EMAIL SUBJECT: ${content.email?.subject || ''}
EMAIL BODY: ${content.email?.body || ''}
SMS: ${content.sms?.body || ''}
PUSH TITLE: ${content.push?.title || ''}
PUSH BODY: ${content.push?.body || ''}

Return:
{"email":{"subject":"...","body":"..."},"sms":{"body":"..."},"push":{"title":"...","body":"..."}}`,
    },
  ];

  const btMessages = [
    { role: 'system', content: 'You translate text back to English. Return only the JSON, no explanation.' },
    {
      role: 'user',
      content: `Translate this ${langName} banking outreach back to English so the RM can verify it.
Return ONLY valid raw JSON.

TRANSLATED EMAIL SUBJECT: ${content.email?.subject || ''}
TRANSLATED EMAIL BODY: ${content.email?.body || ''}
TRANSLATED SMS: ${content.sms?.body || ''}
TRANSLATED PUSH TITLE: ${content.push?.title || ''}
TRANSLATED PUSH BODY: ${content.push?.body || ''}

Return:
{"email":{"subject":"...","body":"..."},"sms":{"body":"..."},"push":{"title":"...","body":"..."}}`,
    },
  ];

  const resp = await callNvidia(messages, 1500);
  const raw = resp.choices?.[0]?.message?.content || '{}';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const translated = JSON.parse(cleaned);

  const btResp = await callNvidia(btMessages, 1000);
  const btRaw = btResp.choices?.[0]?.message?.content || '{}';
  const btCleaned = btRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const backtranslation = JSON.parse(btCleaned);

  return {
    source_language: 'en',
    target_language: targetLanguage,
    translated,
    backtranslation,
  };
}

module.exports = { translateOutreach, LANG_NAMES };
