'use strict';
/**
 * WhatsApp delivery service backed by Twilio.
 *
 * Sends free-form WhatsApp messages via the Twilio Programmable Messaging
 * API.  Free-form messages can only be delivered within a 24-hour
 * customer-service window once the recipient has messaged the sender.
 * For the demo we point `from` at the Twilio sandbox number
 * (`whatsapp:+14155238886`) and the recipient at the demo's number
 * (`whatsapp:+919874618487`) — the recipient must first text
 * `join <keyword>` to the sandbox to opt in.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID   — AC…
 *   TWILIO_AUTH_TOKEN    — …
 *
 * Optional env (defaults match the Twilio sandbox):
 *   TWILIO_WHATSAPP_FROM — "whatsapp:+14155238886"
 *
 * Sandbox override (set RESEND_SANDBOX_OVERRIDE / WA_SANDBOX_OVERRIDE
 * to false in production to send to the customer's real phone):
 *   WA_SANDBOX_OVERRIDE_TO — recipient override (default: whatsapp:+919874618487)
 *   WA_SANDBOX_OVERRIDE    — "false" to disable the override
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN  || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

const WA_SANDBOX_OVERRIDE_TO  = process.env.WA_SANDBOX_OVERRIDE_TO  || 'whatsapp:+919874618487';
const WA_SANDBOX_OVERRIDE_ON  = process.env.WA_SANDBOX_OVERRIDE !== 'false';

function _getClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    const err = new Error(
      'Twilio is not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in server/.env.'
    );
    err.code = 'TWILIO_NOT_CONFIGURED';
    throw err;
  }
  const twilio = require('twilio');
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

function _normaliseWhatsappAddress(num) {
  if (!num) return null;
  const trimmed = String(num).trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  // Strip common separators and assume it's an E.164 number without "+"
  const digits = trimmed.replace(/[^0-9+]/g, '');
  return `whatsapp:${digits.startsWith('+') ? digits : '+' + digits.replace(/^\+/, '')}`;
}

/**
 * Send a WhatsApp message via Twilio.
 *
 * @param {Object} opts
 * @param {string} opts.to        — recipient phone or whatsapp:+… address
 * @param {string} opts.body      — free-form message body
 * @param {string} [opts.from]    — override TWILIO_WHATSAPP_FROM
 * @param {string} [opts.customerId]
 * @param {Object} [opts.metadata]
 *
 * @returns {Promise<{messageSid:string,to:string,from:string,provider:'twilio-whatsapp',status:string,timestamp:string,customerId?:string,metadata?:Object}>}
 */
async function sendWhatsapp({ to, body, from, customerId, metadata = {} }) {
  if (!to)   throw new Error('sendWhatsapp: `to` is required');
  if (!body) throw new Error('sendWhatsapp: `body` is required');

  const client  = _getClient();
  const sender  = from || TWILIO_WHATSAPP_FROM;
  const finalTo = _normaliseWhatsappAddress(to);

  const msg = await client.messages.create({
    from: sender,
    to:   finalTo,
    body,
  });

  return {
    messageSid: msg.sid,
    to:         finalTo,
    from:       sender,
    provider:   'twilio-whatsapp',
    status:     msg.status || 'queued',
    timestamp:  new Date().toISOString(),
    customerId,
    metadata,
  };
}

module.exports = {
  sendWhatsapp,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  WA_SANDBOX_OVERRIDE_TO,
  WA_SANDBOX_OVERRIDE_ON,
};
