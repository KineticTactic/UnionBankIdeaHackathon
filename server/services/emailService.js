'use strict';
/**
 * Email delivery service — stub implementation.
 * Credentials will be wired via env vars when provided.
 * Currently logs the send intent and returns a simulated receipt.
 *
 * To wire real sending:
 *   npm install nodemailer (or @sendgrid/mail)
 *   Set EMAIL_PROVIDER=smtp|sendgrid
 *   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for smtp)
 *   Set SENDGRID_API_KEY (for sendgrid)
 */

const config = require('../config');

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'stub';
const FROM_EMAIL     = process.env.FROM_EMAIL     || 'noreply@unionbank.pcop.demo';
const FROM_NAME      = process.env.FROM_NAME      || 'Union Bank';

async function sendEmail({ to, subject, body, customerId, channel = 'email', metadata = {} }) {
  const receipt = {
    messageId:  `MSG-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    to,
    subject,
    from:       `${FROM_NAME} <${FROM_EMAIL}>`,
    provider:   EMAIL_PROVIDER,
    status:     'stub_sent',
    timestamp:  new Date().toISOString(),
    customerId,
    metadata,
  };

  if (EMAIL_PROVIDER === 'stub') {
    console.log(`[EmailService] STUB send to=${to} subject="${subject}" customerId=${customerId}`);
    receipt.status = 'stub_sent';
    return receipt;
  }

  if (EMAIL_PROVIDER === 'smtp') {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to, subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    receipt.messageId = info.messageId;
    receipt.status    = 'sent';
    return receipt;
  }

  if (EMAIL_PROVIDER === 'sendgrid') {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const [response] = await sgMail.send({
      to, from: { email: FROM_EMAIL, name: FROM_NAME },
      subject, text: body, html: body.replace(/\n/g, '<br>'),
    });
    receipt.messageId = response.headers?.['x-message-id'] || receipt.messageId;
    receipt.status    = 'sent';
    return receipt;
  }

  throw new Error(`Unknown EMAIL_PROVIDER: ${EMAIL_PROVIDER}`);
}

module.exports = { sendEmail };
