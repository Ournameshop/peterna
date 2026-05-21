import { and, eq, inArray } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  VideoClipStatus,
  VideoClipWire,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, renderJobs } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/video/status?session_id=<id>
 *
 * Phase 12 — reads canonical progress from `render_jobs` (the queue table)
 * rather than the cached `sessions.video_clip_statuses` array. The session
 * column lags by one DB round-trip behind the job; the job table is what
 * the worker writes first.
 *
 * Returned shape:
 *   {
 *     clips: VideoClipWire[],     // one per beat (covers queued + done + failed)
 *     all_done: boolean,          // true when assembly job is done
 *   }
 *
 * "all_done" reflects the assembly job, not the per-clip array, because
 * the FE uses it to navigate to /assembly_review (which needs the final
 * MP4, not just the clips).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = serializeSession(auth.session);
  const db = getDb();

  // Pull every render_job for this session and bucket by kind. The queue is
  // small (≤ N+2 rows per session), so one round-trip is fine.
  const jobs = await db
    .select({
      id: renderJobs.id,
      kind: renderJobs.kind,
      status: renderJobs.status,
      payload: renderJobs.payload,
      result: renderJobs.result,
      error: renderJobs.error,
    })
    .from(renderJobs)
    .where(eq(renderJobs.sessionId, sessionId));

  // Map of beat_idx → latest video_clip job (latest by createdAt insertion
  // order — drizzle returns them in insertion order which matches our use).
  const clipJobByBeat = new Map<
    number,
    { status: string; error: string | null; result: unknown }
  >();
  let assemblyJobStatus: string | null = null;
  for (const j of jobs) {
    if (j.kind === 'video_clip') {
      const beatIdx = (j.payload as { beat_idx?: unknown })?.beat_idx;
      if (typeof beatIdx === 'number') {
        clipJobByBeat.set(beatIdx, { status: j.status, error: j.error, result: j.result });
      }
    } else if (j.kind === 'assembly') {
      // Assume one assembly row per session in the steady-state.
      assemblyJobStatus = j.status;
    }
  }

  // The session's stored arrays still drive the beat count + asset-id
  // backfill (the worker writes them after each clip completes, so they're
  // the authoritative source for `public_url`).
  const sessionStatuses = (session.video_clip_statuses ?? []) as VideoClipStatus[];
  const sessionAssetIds = (session.video_clip_asset_ids ?? []) as string[];
  const beatCount = Math.max(
    sessionStatuses.length,
    sessionAssetIds.length,
    clipJobByBeat.size,
  );

  if (beatCount === 0) {
    return okJson({ clips: [] as VideoClipWire[], all_done: false });
  }

  // Resolve public_url for any done clips.
  const knownAssetIds = sessionAssetIds.filter((id) => Boolean(id));
  const urlByAssetId = new Map<string, string>();
  if (knownAssetIds.length > 0) {
    const rows = await db
      .select({ id: assets.id, publicUrl: assets.publicUrl, kind: assets.kind, sessionId: assets.sessionId })
      .from(assets)
      .where(and(inArray(assets.id, knownAssetIds), eq(assets.sessionId, sessionId)));
    for (const r of rows) {
      if (r.kind === 'video_clip') urlByAssetId.set(r.id, r.publicUrl);
    }
  }

  const clips: VideoClipWire[] = [];
  for (let i = 0; i < beatCount; i++) {
    const job = clipJobByBeat.get(i);
    const sessionStatus = sessionStatuses[i] ?? null;
    const assetId = sessionAssetIds[i] || null;
    const status = mapJobToClipStatus(job?.status ?? null, sessionStatus);
    const publicUrl =
      assetId && status === 'done' ? urlByAssetId.get(assetId) ?? null : null;
    const clip: VideoClipWire = {
      beat_idx: i,
      status,
      asset_id: status === 'done' ? assetId : null,
      public_url: publicUrl,
    };
    if (status === 'failed' && job?.error) clip.error = job.error;
    clips.push(clip);
  }

  // "all_done" reflects the assembly job — not the clip array — because
  // the FE waits for the stitched MP4 before advancing to the review screen.
  const allDone = assemblyJobStatus === 'done';

  return okJson({ clips, all_done: allDone });
}

/**
 * Map a `render_jobs.status` value to the FE-facing `VideoClipStatus`.
 * `running` in queue-speak == `rendering` to the FE. Falls back to the
 * session-cached value if the job row isn't present for this beat (e.g.
 * the FE polled mid-enqueue).
 */
function mapJobToClipStatus(
  jobStatus: string | null,
  sessionStatus: VideoClipStatus | null,
): VideoClipStatus {
  if (jobStatus === 'done') return 'done';
  if (jobStatus === 'failed') return 'failed';
  if (jobStatus === 'running') return 'rendering';
  if (jobStatus === 'queued') return 'queued';
  return sessionStatus ?? 'queued';
}
