import { errJson, okJson } from '@/lib/api/respond';
import { tryReadVapid } from '@/lib/push/vapid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/push/vapid-public-key
 *
 * Returns the server's VAPID public key. The browser passes this to
 * `pushManager.subscribe({ applicationServerKey })`. Public-by-design —
 * the private key never leaves the server.
 *
 * Returns 503 `mailer-not-configured`-style error when VAPID env isn't set
 * locally so the FE prompt can degrade gracefully (hide the "enable
 * notifications" button) without a hard 500.
 */
export async function GET(): Promise<Response> {
  const v = tryReadVapid();
  if (!v.ok) {
    return errJson('push-not-configured', {
      status: 503,
      details: { missing: v.missing },
    });
  }
  return okJson({ public_key: v.config.publicKey });
}
