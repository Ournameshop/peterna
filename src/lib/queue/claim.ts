import 'server-only';

import { getSql } from '@/lib/db/client';
import type { RenderJob } from '@/lib/db/schema';

/**
 * Atomically claim the next queued job using
 * `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1`. The combination of
 * `FOR UPDATE` (row-level lock) and `SKIP LOCKED` (don't block) is what
 * gives us a safe multi-worker queue without a coordinator process.
 *
 * Ordering: oldest queued first (`created_at ASC`), so the queue behaves
 * FIFO under load.
 *
 * Dependency rules are NOT enforced here — the worker's per-kind handler
 * does the dependency check (e.g. assembly waits for all `video_clip` jobs
 * in the same session to be `done` before doing work; otherwise it
 * re-queues itself by failing-with-retry). Keeping the SQL claim simple
 * makes the lock window short.
 */
export async function claimNextJob(workerId: string): Promise<RenderJob | null> {
  const sql = getSql();

  // postgres-js: tagged template with `${...}` interpolates safely as params.
  // We use SQL NOW() for the timestamp assignments (the driver can't bind
  // a JS Date object directly into a parameter slot), and a CTE so the UPDATE
  // returns the freshly-claimed row in one round-trip.
  const rows = await sql<RenderJob[]>`
    WITH next_job AS (
      SELECT id
      FROM render_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE render_jobs r
    SET
      status = 'running',
      locked_at = NOW(),
      locked_by = ${workerId},
      started_at = COALESCE(r.started_at, NOW()),
      attempts = r.attempts + 1,
      updated_at = NOW()
    FROM next_job
    WHERE r.id = next_job.id
    RETURNING
      r.id,
      r.session_id      AS "sessionId",
      r.kind,
      r.payload,
      r.status,
      r.attempts,
      r.locked_at       AS "lockedAt",
      r.locked_by       AS "lockedBy",
      r.started_at      AS "startedAt",
      r.finished_at     AS "finishedAt",
      r.error,
      r.result,
      r.created_at      AS "createdAt",
      r.updated_at      AS "updatedAt"
  `;

  return rows[0] ?? null;
}

/**
 * Reaper — reclaim jobs whose worker died mid-run. If `locked_at` is older
 * than the kind-specific staleness threshold, flip the job back to `queued`
 * so the next worker poll picks it up. The retry budget (max `attempts`) is
 * enforced inside `markJobFailed` in `./finish.ts`.
 *
 * Per-kind thresholds (B3): video_clip can legitimately take 20+ minutes
 * under fal queue pressure on Seedance 2.0. A blanket 10-minute reap would
 * re-queue a still-in-flight vendor call and waste $0.50/clip. Each kind gets
 * its own ceiling; unknown kinds fall back to `defaultStaleAfterMs`. We run
 * a small UPDATE per kind so the SQL stays simple and the cutoffs are
 * explicit (no JSON aggregation gymnastics).
 *
 * Caller (worker loop) should run this on a slower cadence than the main
 * poll — once a minute is fine.
 */
export type StaleThresholds = {
  /** Default for kinds not listed in `byKind`. */
  defaultStaleAfterMs: number;
  /** Per-kind override; key matches `render_jobs.kind`. */
  byKind: Record<string, number>;
};

export async function reapStaleJobs(thresholds: StaleThresholds): Promise<number> {
  const sql = getSql();
  let total = 0;

  // Per-kind sweeps — one UPDATE per configured kind. This is N=2–3 queries
  // today (video_clip, assembly, etc.); cheap, predictable, and easy to read.
  for (const [kind, staleAfterMs] of Object.entries(thresholds.byKind)) {
    const cutoffIso = new Date(Date.now() - staleAfterMs).toISOString();
    const rows = await sql<{ id: string }[]>`
      UPDATE render_jobs
      SET
        status = 'queued',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
      WHERE status = 'running'
        AND locked_at IS NOT NULL
        AND locked_at < ${cutoffIso}::timestamptz
        AND kind = ${kind}
      RETURNING id
    `;
    total += rows.length;
  }

  // Catch-all sweep for any kind not covered above. NOT IN (...) keeps the
  // configured kinds from being double-reaped under a tighter default.
  const knownKinds = Object.keys(thresholds.byKind);
  const defaultCutoffIso = new Date(Date.now() - thresholds.defaultStaleAfterMs).toISOString();
  const defaultRows = knownKinds.length > 0
    ? await sql<{ id: string }[]>`
        UPDATE render_jobs
        SET
          status = 'queued',
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
        WHERE status = 'running'
          AND locked_at IS NOT NULL
          AND locked_at < ${defaultCutoffIso}::timestamptz
          AND kind NOT IN ${sql(knownKinds)}
        RETURNING id
      `
    : await sql<{ id: string }[]>`
        UPDATE render_jobs
        SET
          status = 'queued',
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
        WHERE status = 'running'
          AND locked_at IS NOT NULL
          AND locked_at < ${defaultCutoffIso}::timestamptz
        RETURNING id
      `;
  total += defaultRows.length;

  return total;
}
