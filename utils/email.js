const config = require('../config');
const logger = require('../config/logger');

/**
 * Sends the invite email via whichever provider is configured. Swap the body
 * of this function for your provider's SDK (Resend, SES, Postmark). Keeping
 * it in one place means routes never see raw API keys or provider details.
 */
async function sendInviteEmail({ to, teamId, rawToken }) {
  const acceptUrl = `https://app.collab.app/invite/accept?token=${rawToken}`;

  if (!config.email.apiKey) {
    // Local development: log instead of sending, so the flow is testable
    // without a real provider account.
    logger.info({ to, acceptUrl }, 'Email provider not configured — invite link logged instead of sent');
    return { delivered: false, reason: 'no_provider_configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.email.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.email.from,
      to,
      subject: "You're invited to join a team on Collab",
      html: `<p>You've been invited to join a team on Collab.</p><p><a href="${acceptUrl}">Accept your invite</a></p><p>This link expires in ${config.invite.expiryHours / 24} days and can only be used once.</p>`,
    }),
  });

  if (!res.ok) {
    logger.error({ status: res.status }, 'Invite email failed to send');
    return { delivered: false };
  }
  return { delivered: true };
}

module.exports = { sendInviteEmail };
