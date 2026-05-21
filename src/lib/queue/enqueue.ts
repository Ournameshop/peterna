import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { getDb } from '@/lib/db/client';
import { renderJobs, type RenderJob } from '@/lib/db/schema';

/**
 * Phase 12 — Postgres-as-queue. Workers poll `render_jobs` with
 * `SELECT ... FOR UPDATE SKIP LOCKED` (see `./claim.ts`) to atomically claim
 * the next queued row. This module is the producer side: enqueue a single
 * job, or atomically enqueue a video batch (one row per beat + one assembly
 * row) so the route handler can return immediately.
 *
 * No Redis, no BullMQ — the Postgres connection we already maintain is
 * sufficient at our volume. If we ever need fanout to multiple workers per
 * node, the SKIP LOCKED claim already supports it.
 */

export type JobKind = 'video_clip' | 'assembly' | 'notify_ready';

export type VideoClipPayload = { beat_idx: number };
export type AssemblyPayload = Record<string, never>;
export type NotifyReadyPayload = Record<string, never>;

export type JobPayloadByKind = {
  video_clip: VideoClipPayload;
  assembly: AssemblyPayload;
  notify_ready: NotifyReadyPayload;
};

export type EnqueueInput<K extends JobKind = JobKind> = {
  sessionId: string;
  kind: K;
  payload: JobPayloadByKind[K];
};

/**
 * Insert one job row. Returns its id. Caller decides whether to enqueue more
 * (e.g. a batch). The job is born `queued`; the worker flips it to `running`
 * via the claim step.
 */
export async function enqueueJob<K extends JobKind>(input: EnqueueInput<K>): Promise<string> {
  const id = uuidv7();
  const db = getDb();
  await db.insert(renderJobs).values({
    id,
    sessionId: input.sessionId,
    kind: input.kind,
    payload: input.payload as object,
    status: 'queued',
  });
  return id;
}

/**
 * Idempotent batch enqueue for the video-render entry route. If there's
 * already a queued OR running `video_clip` job for any of the requested
 * beats (i.e. user double-fired the render button), we skip enqueueing that
 * beat. Same for the assembly row. Returns the ids of every queued/running
 * job for the session keyed by kind so the caller can report progress
 * immediately.
 *
 * NOTE: idempotency is per-beat, not per-batch — a beat that already failed
 * and is being retried via the (separate) reroll route still enqueues a new
 * row; this helper only dedupes against jobs that are still in-flight.
 */
export async function enqueueVideoBatch(input: {
  sessionId: string;
  beatIndices: number[];
}): Promise<{ clipJobIds: Record<number, string>; assemblyJobId: string }> {
  const db = getDb();

  // Find any in-flight clip + assembly jobs for the session.
  const existing = await db
    .select({
      id: renderJobs.id,
      kind: renderJobs.kind,
      status: renderJobs.status,
      payload: renderJobs.payload,
    })
    .from(renderJobs)
    .where(
      and(
        eq(renderJobs.sessionId, input.sessionId),
        inArray(renderJobs.status, ['queued', 'running']),
      ),
    );

  const liveClipByBeat = new Map<number, string>();
  let liveAssemblyId: string | null = null;
  for (const row of existing) {
    if (row.kind === 'video_clip') {
      const beatIdx = (row.payload as { beat_idx?: unknown })?.beat_idx;
      if (typeof beatIdx === 'number') liveClipByBeat.set(beatIdx, row.id);
    } else if (row.kind === 'assembly') {
      liveAssemblyId = row.id;
    }
  }

  const clipJobIds: Record<number, string> = {};
  for (const beatIdx of input.beatIndices) {
    const existingId = liveClipByBeat.get(beatIdx);
    if (existingId) {
      clipJobIds[beatIdx] = existingId;
      continue;
    }
    clipJobIds[beatIdx] = await enqueueJob({
      sessionId: input.sessionId,
      kind: 'video_clip',
      payload: { beat_idx: beatIdx },
    });
  }

  const assemblyJobId =
    liveAssemblyId ??
    (await enqueueJob({
      sessionId: input.sessionId,
      kind: 'assembly',
      payload: {},
    }));

  return { clipJobIds, assemblyJobId };
}

export type { RenderJob };
