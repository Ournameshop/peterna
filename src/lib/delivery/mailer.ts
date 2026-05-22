import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Brevo transactional-email wrapper (SMTP transport). Used by:
 *   - `/api/delivery/email` to send the "your tribute is ready" message.
 *   - `/api/auth/magic-link/request` (Phase 10) to send the sign-in link.
 *
 * Uses Brevo's SMTP relay (smtp-relay.brevo.com:587 via STARTTLS) so a single
 * SMTP credential set works for everything — and the user can paste their
 * existing Brevo SMTP details from the dashboard rather than provisioning a
 * separate v3 REST API key.
 *
 * Env:
 *   - SMTP_HOST (default: smtp-relay.brevo.com)
 *   - SMTP_PORT (default: 587)
 *   - SMTP_USER (Brevo SMTP login, e.g. 75c23f001@smtp-brevo.com)
 *   - SMTP_PASS (Brevo SMTP key, starts with `xsmtpsib-`)
 *   Missing SMTP_USER / SMTP_PASS → returns `{ ok: false, error: 'mailer-not-configured' }`.
 *
 *   - DELIVERY_EMAIL_FROM: required. Verified sender on the Brevo account.
 *   - DELIVERY_EMAIL_FROM_NAME: optional friendly name (defaults to "Peterna").
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cheap shape check — Brevo will do the authoritative validation. */
export function isLikelyEmail(value: string): boolean {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

export type SendMailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
};

export type SendMailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: 'mailer-not-configured' | 'send-failed'; details?: unknown };

/**
 * Low-level transport. Callers compose subject + bodies; this just talks to
 * Brevo. Returns a discriminated union so the route handler can map to the
 * right envelope error without parsing Brevo's response shape twice.
 */
let cachedTransport: Transporter | null = null;
function getTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST?.trim() || 'smtp-relay.brevo.com';
  const port = Number(process.env.SMTP_PORT?.trim() || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 uses STARTTLS
    auth: { user, pass },
  });
  return cachedTransport;
}

export async function sendBrevoEmail(input: SendMailInput): Promise<SendMailResult> {
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[MAIL-FAIL] SMTP not configured — set SMTP_USER + SMTP_PASS in .env.local',
      );
    }
    return { ok: false, error: 'mailer-not-configured' };
  }
  const fromEmail = process.env.DELIVERY_EMAIL_FROM?.trim();
  if (!fromEmail) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MAIL-FAIL] DELIVERY_EMAIL_FROM not set');
    }
    return { ok: false, error: 'mailer-not-configured' };
  }
  const fromName = process.env.DELIVERY_EMAIL_FROM_NAME?.trim() || 'Peterna';

  try {
    const info = await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      text: input.textBody,
      html: input.htmlBody,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[MAIL-OK]', {
        to: input.to,
        subject: input.subject,
        messageId: info.messageId ?? null,
        response: info.response,
      });
    }
    return { ok: true, messageId: info.messageId ?? null };
  } catch (err) {
    const details = {
      message: err instanceof Error ? err.message : String(err),
      code: (err as { code?: string } | null)?.code,
      response: (err as { response?: string } | null)?.response,
      responseCode: (err as { responseCode?: number } | null)?.responseCode,
    };
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MAIL-FAIL] SMTP send failed:', details);
    }
    return { ok: false, error: 'send-failed', details };
  }
}

export type SendDeliveryEmailInput = {
  to: string;
  petName: string;
  shareUrl: string;
};

export type SendDeliveryEmailResult = SendMailResult;

/**
 * Send the "your tribute is ready" delivery email. Plain-text + HTML
 * multipart so any client can render it; HTML is intentionally minimal
 * (no images, no tracking pixels — matches the spec's restrained tone).
 */
export async function sendDeliveryEmail(
  input: SendDeliveryEmailInput,
): Promise<SendDeliveryEmailResult> {
  const subject = `Your tribute for ${input.petName} is ready`;
  const textBody = [
    `Your tribute for ${input.petName} is ready.`,
    '',
    'You can view, download, and share it here:',
    input.shareUrl,
    '',
    'Take all the time you need with it.',
    '',
    '— Peterna',
  ].join('\n');

  const htmlBody = renderHtmlBody({
    petName: input.petName,
    shareUrl: input.shareUrl,
  });

  return sendBrevoEmail({ to: input.to, subject, textBody, htmlBody });
}

function renderHtmlBody(input: { petName: string; shareUrl: string }): string {
  const safeName = escapeHtml(input.petName);
  const safeUrl = escapeHtml(input.shareUrl);
  return [
    '<!doctype html>',
    '<html><body style="font-family: Georgia, \'Times New Roman\', serif; color: #1a1a1a; background: #fdfcf8; padding: 24px;">',
    `<p style="font-size: 18px; margin-bottom: 16px;">Your tribute for <em>${safeName}</em> is ready.</p>`,
    `<p style="margin-bottom: 16px;">You can view, download, and share it here:</p>`,
    `<p style="margin-bottom: 24px;"><a href="${safeUrl}" style="color: #8a7a4a; word-break: break-all;">${safeUrl}</a></p>`,
    `<p style="margin-bottom: 16px;">Take all the time you need with it.</p>`,
    `<p style="font-style: italic; color: #6a6a6a;">— Peterna</p>`,
    '</body></html>',
  ].join('');
}

/** Exported for the auth magic-link mailer + any other Brevo HTML composers. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
