import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import { getDb } from '@/lib/db/client';
import { assets, renderJobs } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/assembly/render (Phase 12 — deprecated as a manual trigger)
 *
 * Assembly is auto-enqueued by `/api/video/render` and runs in the worker
 * once every `video_clip` job for the session completes. This route is
 * preserved as a lightweight acknowledgment endpoint so any FE that still
 * POSTs here gets a stable response instead of a 404 — it polls the
 * existing `assembly` render_jobs row and returns the final asset's
 * `public_url` once `assembledVideoAssetId` is set.
 *
 * Returns:
 *   - 200 `{ asset_id, public_url }` when the worker has finished assembly
 *   - 202 `{ ok: false, error: 'assembly-in-flight' }` while pending
 *   - 400 `{ ok: false, error: 'incomplete-clips' }` if the worker failed
 *
 * No vendor work happens in this route — kept idempotent + cheap.
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

  const session = serializeSession(auth.session);
  const db = getDb();

  if (session.assembled_video_asset_id) {
    const rows = await db
      .select({ id: assets.id, publicUrl: assets.publicUrl })
      .from(assets)
      .where(eq(assets.id, session.assembled_video_asset_id))
      .limit(1);
    const row = rows[0];
    if (row) {
      return okJson({ asset_id: row.id, public_url: row.publicUrl });
    }
  }

  // Look up the assembly job to report whether the worker is still pending
  // or whether it crashed.
  const jobs = await db
    .select({ kind: renderJobs.kind, status: renderJobs.status, error: renderJobs.error })
    .from(renderJobs)
    .where(eq(renderJobs.sessionId, sessionId));
  const assemblyJob = jobs.find((j) => j.kind === 'assembly');

  if (!assemblyJob) {
    return errJson('incomplete-clips', {
      status: 400,
      details: { reason: 'no-assembly-job' },
    });
  }
  if (assemblyJob.status === 'failed') {
    return Response.json(
      { ok: false, error: 'assembly_failed', details: { reason: assemblyJob.error } },
      { status: 500 },
    );
  }
  // queued or running — assembly is still in flight.
  return Response.json(
    { ok: false, error: 'assembly-in-flight', details: { status: assemblyJob.status } },
    { status: 202 },
  );
}
