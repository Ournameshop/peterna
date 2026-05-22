import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
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
 *
 * B2 (pre-Phase-15 audit): `notify_ready` is the one kind where two concurrent
 * workers can race the check+insert in `maybeEnqueueNotifyReady` and both
 * decide to enqueue, sending the user duplicate "your tribute is ready"
 * emails + push notifications. The partial unique index on
 * `render_jobs(session_id) WHERE kind='notify_ready'` (migration 0009) is
 * the row-level safety net; here we use `ON CONFLICT DO NOTHING` so the
 * losing INSERT becomes a silent no-op rather than throwing.
 */
export async function enqueueJob<K extends JobKind>(input: EnqueueInput<K>): Promise<string> {
  const id = uuidv7();
  const db = getDb();
  const insert = db.insert(renderJobs).values({
    id,
    sessionId: input.sessionId,
    kind: input.kind,
    payload: input.payload as object,
    status: 'queued',
  });
  if (input.kind === 'notify_ready') {
    await insert.onConflictDoNothing();
  } else {
    await insert;
  }
  return id;
}

/**
 * Idempotent batch enqueue for the video-render entry route.
 *
 * B1 (pre-Phase-15 audit): the previous implementation did the SELECT for
 * in-flight rows and the INSERT outside any transaction — two near-
 * simultaneous render kickoffs (slow first POST + auto-retry + impatient
 * user click) could both find zero in-flight jobs and both INSERT N
 * video_clip rows, burning $0.50/clip × N on duplicate fal calls.
 *
 * Fix (chosen approach): wrap the whole read-then-insert in a transaction
 * holding a Postgres advisory lock keyed by sessionId.
 * `pg_advisory_xact_lock` blocks other transactions trying to acquire the
 * same key until ours commits; the second caller then sees our newly-
 * inserted rows and dedups against them.
 *
 * Why advisory lock vs. the audit's recommended partial unique index on
 * (session_id, kind, payload->>'beat_idx'): the one-migration budget for
 * this fix-set is spent on B2 (notify_ready unique index). The advisory
 * lock is the audit's explicit fallback ("wrap SELECT + INSERT in a
 * transaction with ... advisory lock per session") and requires no schema
 * change. hashtext() is a built-in Postgres function returning int4;
 * collisions are theoretically possible but the blast radius is "two
 * unrelated sessions briefly serialize their kickoff," which is harmless.
 * The Idempotency-Key header from the client is consumed at the route
 * level (logged for forensics); the lock provides the actual race safety.
 *
 * Idempotency is per-beat, not per-batch — a beat that already failed and
 * is being retried via the (separate) reroll route still enqueues a new
 * row; this helper only dedupes against jobs that are still in-flight.
 */
export async function enqueueVideoBatch(input: {
  sessionId: string;
  beatIndices: number[];
}): Promise<{ clipJobIds: Record<number, string>; assemblyJobId: string }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Serialize concurrent kickoffs for the same session. The lock auto-
    // releases at txn commit/rollback. Different sessions hash to different
    // ints and don't contend (modulo rare collisions, which are benign).
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.sessionId}))`);

    // Find any in-flight clip + assembly jobs for the session — race-free
    // now that we hold the lock.
    const existing = await tx
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
      const id = uuidv7();
      await tx.insert(renderJobs).values({
        id,
        sessionId: input.sessionId,
        kind: 'video_clip',
        payload: { beat_idx: beatIdx } as object,
        status: 'queued',
      });
      clipJobIds[beatIdx] = id;
    }

    let assemblyJobId = liveAssemblyId;
    if (!assemblyJobId) {
      const id = uuidv7();
      await tx.insert(renderJobs).values({
        id,
        sessionId: input.sessionId,
        kind: 'assembly',
        payload: {} as object,
        status: 'queued',
      });
      assemblyJobId = id;
    }

    return { clipJobIds, assemblyJobId };
  });
}

export type { RenderJob };
