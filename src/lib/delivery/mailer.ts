import 'server-only';

/**
 * Brevo transactional-email wrapper. Used by:
 *   - `/api/delivery/email` to send the "your tribute is ready" message.
 *   - `/api/auth/magic-link/request` (Phase 10) to send the sign-in link.
 *
 * Wraps Brevo's transactional REST endpoint (`POST /v3/smtp/email`) — no SMTP
 * client needed, no new npm dependency.
 *
 * Env:
 *   - BREVO_API_KEY: required to actually send. Missing key → returns
 *     `{ ok: false, error: 'mailer-not-configured' }` so a dev who hasn't
 *     wired Brevo locally doesn't see an opaque 500.
 *   - DELIVERY_EMAIL_FROM: required when BREVO_API_KEY is set. Should be a
 *     verified sender on the Brevo account (e.g. `tributes@peterna.com`).
 *   - DELIVERY_EMAIL_FROM_NAME: optional friendly name (defaults to "Peterna").
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

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
export async function sendBrevoEmail(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'mailer-not-configured' };
  }
  const fromEmail = process.env.DELIVERY_EMAIL_FROM?.trim();
  if (!fromEmail) {
    return { ok: false, error: 'mailer-not-configured' };
  }
  const fromName = process.env.DELIVERY_EMAIL_FROM_NAME?.trim() || 'Peterna';

  let resp: Response;
  try {
    resp = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.textBody,
        htmlContent: input.htmlBody,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: 'send-failed',
      details: { message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (!resp.ok) {
    let detail: unknown = null;
    try {
      detail = await resp.json();
    } catch {
      try {
        detail = await resp.text();
      } catch {
        /* ignore */
      }
    }
    return {
      ok: false,
      error: 'send-failed',
      details: { status: resp.status, body: detail },
    };
  }

  let messageId: string | null = null;
  try {
    const json = (await resp.json()) as { messageId?: string };
    messageId = json.messageId ?? null;
  } catch {
    // Brevo always returns JSON on 2xx; if parse fails we still consider
    // it a success — the email went out.
  }
  return { ok: true, messageId };
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
