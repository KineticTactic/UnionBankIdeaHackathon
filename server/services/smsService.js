'use strict';
/**
 * SMS delivery service — stub implementation.
 * Credentials will be wired via env vars when provided.
 *
 * To wire real sending:
 *   npm install twilio (or fast2sms for India)
 *   Set SMS_PROVIDER=twilio|fast2sms
 *   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (for twilio)
 *   Set FAST2SMS_API_KEY (for fast2sms India)
 */

const SMS_PROVIDER    = process.env.SMS_PROVIDER    || 'stub';
const SMS_FROM_NUMBER = process.env.SMS_FROM_NUMBER || '+91XXXXXXXXXX';

async function sendSms({ to, body, customerId, metadata = {} }) {
  const receipt = {
    messageId:  `SMS-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    to,
    from:       SMS_FROM_NUMBER,
    charCount:  body.length,
    provider:   SMS_PROVIDER,
    status:     'stub_sent',
    timestamp:  new Date().toISOString(),
    customerId,
    metadata,
  };

  if (SMS_PROVIDER === 'stub') {
    console.log(`[SmsService] STUB send to=${to} chars=${body.length} customerId=${customerId}`);
    receipt.status = 'stub_sent';
    return receipt;
  }

  if (SMS_PROVIDER === 'twilio') {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({ body, from: SMS_FROM_NUMBER, to });
    receipt.messageId = msg.sid;
    receipt.status    = msg.status;
    return receipt;
  }

  if (SMS_PROVIDER === 'fast2sms') {
    const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method:  'POST',
      headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'dlt', sender_id: 'UNBNK', message: body, language: 'english', numbers: to }),
    });
    const data = await resp.json();
    receipt.messageId = data.request_id || receipt.messageId;
    receipt.status    = data.return ? 'sent' : 'failed';
    return receipt;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${SMS_PROVIDER}`);
}

module.exports = { sendSms };
