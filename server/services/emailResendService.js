'use strict';
/**
 * Resend-backed email service.
 *
 * Resend (https://resend.com) — transactional email API.
 * Sender defaults to the Resend sandbox address `onboarding@resend.dev`
 * which works with any Resend API key without domain verification,
 * making it ideal for the hackathon demo.  For production, set
 * RESEND_FROM to a verified address such as `outreach@unionbank.in`.
 *
 * Required env:
 *   RESEND_API_KEY   — re_…   (https://resend.com/api-keys)
 *
 * Optional env:
 *   RESEND_FROM      — "Union Bank <outreach@unionbank.in>"  (default: onboarding@resend.dev)
 *
 * The Resend SDK is loaded lazily so the server boots even when the
 * key is missing — calls will surface a clear configuration error
 * instead of crashing on import.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM    = process.env.RESEND_FROM    || 'onboarding@resend.dev';

function _getClient() {
  if (!RESEND_API_KEY) {
    const err = new Error(
      'Resend is not configured: set RESEND_API_KEY in server/.env ' +
      '(get a key at https://resend.com/api-keys).'
    );
    err.code = 'RESEND_NOT_CONFIGURED';
    throw err;
  }
  const { Resend } = require('resend');
  return new Resend(RESEND_API_KEY);
}

/**
 * Send an email via Resend.
 *
 * @param {Object} opts
 * @param {string} opts.to        — recipient address (overridden by server to a fixed
 *                                  demo address when SANDBOX_OVERRIDE_TO is set).
 * @param {string} opts.subject
 * @param {string} opts.html      — HTML body
 * @param {string} [opts.text]    — plain-text fallback
 * @param {string} [opts.from]    — overrides RESEND_FROM for this call
 * @param {string} [opts.customerId]
 * @param {Object} [opts.metadata]
 *
 * @returns {Promise<{messageId:string,to:string,from:string,provider:'resend',status:string,timestamp:string,customerId?:string,metadata?:Object}>}
 */
async function sendEmail({ to, subject, html, text, from, customerId, metadata = {} }) {
  if (!to)        throw new Error('sendEmail: `to` is required');
  if (!subject)   throw new Error('sendEmail: `subject` is required');
  if (!html && !text) throw new Error('sendEmail: `html` or `text` is required');

  const client    = _getClient();
  const sender    = from || RESEND_FROM;
  const finalHtml = html || (text || '').replace(/\n/g, '<br>');

  const result = await client.emails.send({
    from:    sender,
    to:      [to],
    subject,
    html:    finalHtml,
    text:    text || undefined,
  });

  if (result?.error) {
    const err = new Error(`Resend send failed: ${result.error.message || 'unknown error'}`);
    err.code    = 'RESEND_SEND_FAILED';
    err.detail  = result.error;
    throw err;
  }

  return {
    messageId:  result?.data?.id || `RESEND-${Date.now()}`,
    to,
    from:       sender,
    provider:   'resend',
    status:     'sent',
    timestamp:  new Date().toISOString(),
    customerId,
    metadata,
  };
}

module.exports = { sendEmail, RESEND_API_KEY, RESEND_FROM };
