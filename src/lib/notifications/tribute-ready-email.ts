import 'server-only';

import {
  escapeHtml,
  sendBrevoEmail,
  type SendMailResult,
} from '@/lib/delivery/mailer';

/**
 * Phase 12 — "your tribute is ready" notification.
 *
 * Sent by the worker's `notify_ready` job once both all video clips AND the
 * assembly job have finished. Reuses the same Brevo transport as the manual
 * delivery email so we don't fork the mailer.
 *
 * Skipped (returns `mailer-not-configured`) when Brevo isn't set up
 * locally — the worker logs but doesn't crash.
 */

export type SendTributeReadyEmailInput = {
  to: string;
  petName: string;
  shareUrl: string;
};

export async function sendTributeReadyEmail(
  input: SendTributeReadyEmailInput,
): Promise<SendMailResult> {
  const subject = `${input.petName}'s tribute is ready`;
  const textBody = [
    `${input.petName}'s tribute is ready.`,
    '',
    'Watch it here:',
    input.shareUrl,
    '',
    'It will live at this link as long as you need it.',
    '',
    '— Peterna',
  ].join('\n');

  const safeName = escapeHtml(input.petName);
  const safeUrl = escapeHtml(input.shareUrl);
  const htmlBody = [
    '<!doctype html>',
    '<html><body style="font-family: Georgia, \'Times New Roman\', serif; color: #1a1a1a; background: #fdfcf8; padding: 24px;">',
    `<p style="font-size: 18px; margin-bottom: 16px;"><em>${safeName}</em>'s tribute is ready.</p>`,
    '<p style="margin-bottom: 16px;">Watch it here:</p>',
    `<p style="margin-bottom: 24px;"><a href="${safeUrl}" style="color: #8a7a4a; word-break: break-all;">${safeUrl}</a></p>`,
    '<p style="margin-bottom: 16px;">It will live at this link as long as you need it.</p>',
    '<p style="font-style: italic; color: #6a6a6a;">— Peterna</p>',
    '</body></html>',
  ].join('');

  return sendBrevoEmail({ to: input.to, subject, textBody, htmlBody });
}
