import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/eulogy/approve (Stage 8 — Eulogy PDF)
 *
 * Body: `EulogyApproveRequest` — `{ session_id }`. Sets `eulogy_approved_at`
 * and advances stage to `delivery_ready` (Phase 9 entry).
 *
 * Preconditions: `eulogy_pdf_asset_id` must be set (i.e. /api/eulogy/render
 * already produced the PDF). 400 `no-pdf` otherwise.
 *
 * Mirrors the assembly/approve pattern: this is the trusted server-side
 * transition, so it writes the new stage verbatim rather than going through
 * the PATCH state-machine guard.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  if (!auth.session.eulogyPdfAssetId) {
    return errJson('no-pdf', { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .update(sessions)
    .set({
      eulogyApprovedAt: new Date(),
      // Phase 9 entry stage. The FE state machine (owned by the frontend
      // agent) wires `delivery_ready` separately; the column is `text` so
      // this server-side write is the source of truth for the transition.
      stage: 'delivery_ready',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (rows.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(rows[0]!) });
}
