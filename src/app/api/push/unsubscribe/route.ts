import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { pushSubscriptions } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/push/unsubscribe
 *
 * Body: `{ endpoint: string }`. Removes the matching subscription row.
 * Idempotent — returns ok even if no row matched.
 *
 * No auth required: knowing the full endpoint URL is itself the
 * authorization (same posture as the resume token + delivery slug
 * patterns elsewhere in the app).
 */
export async function POST(req: Request): Promise<Response> {
  let body: { endpoint?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) {
    return errJson('invalid-input', { status: 400, details: { field: 'endpoint' } });
  }

  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

  return okJson({ unsubscribed: true });
}
