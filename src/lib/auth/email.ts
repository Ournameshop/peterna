import 'server-only';

import { escapeHtml, sendBrevoEmail, type SendMailResult } from '@/lib/delivery/mailer';

/**
 * Magic-link sign-in email. Same Brevo transport as the delivery mailer,
 * different subject + body. The link itself is the auth — keep the body
 * tight, warm, and explicit about expiry so a user who didn't request the
 * email isn't worried about anything lingering.
 */

export type SendMagicLinkEmailInput = {
  to: string;
  signinUrl: string;
};

export async function sendMagicLinkEmail(input: SendMagicLinkEmailInput): Promise<SendMailResult> {
  const subject = 'Sign in to Peterna';

  const textBody = [
    'Click the link below to sign in to your Peterna account:',
    '',
    input.signinUrl,
    '',
    'This link expires in 30 minutes and can only be used once.',
    '',
    "If you didn't request this, you can safely ignore this email — no account changes were made.",
    '',
    '— Peterna',
  ].join('\n');

  const htmlBody = renderHtmlBody({ signinUrl: input.signinUrl });

  return sendBrevoEmail({ to: input.to, subject, textBody, htmlBody });
}

function renderHtmlBody(input: { signinUrl: string }): string {
  const safeUrl = escapeHtml(input.signinUrl);
  return [
    '<!doctype html>',
    '<html><body style="font-family: Georgia, \'Times New Roman\', serif; color: #1a1a1a; background: #fdfcf8; padding: 24px;">',
    `<p style="font-size: 18px; margin-bottom: 16px;">Sign in to your Peterna account.</p>`,
    `<p style="margin-bottom: 24px;"><a href="${safeUrl}" style="display: inline-block; padding: 12px 20px; background: #8a7a4a; color: #fdfcf8; text-decoration: none; border-radius: 4px;">Sign in</a></p>`,
    `<p style="margin-bottom: 16px; font-size: 14px; color: #6a6a6a;">Or copy and paste this URL into your browser:</p>`,
    `<p style="margin-bottom: 24px; word-break: break-all;"><a href="${safeUrl}" style="color: #8a7a4a;">${safeUrl}</a></p>`,
    `<p style="margin-bottom: 16px; font-size: 14px; color: #6a6a6a;">This link expires in 30 minutes and can only be used once.</p>`,
    `<p style="margin-bottom: 16px; font-size: 14px; color: #6a6a6a;">If you didn't request this, you can safely ignore this email — no account changes were made.</p>`,
    `<p style="font-style: italic; color: #6a6a6a;">— Peterna</p>`,
    '</body></html>',
  ].join('');
}
