import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { renderJobs } from '@/lib/db/schema';

/**
 * Mark a claimed job as finished — either `done` (with optional result)
 * or `failed` (with an error string). Both paths clear the worker lock
 * so the row can be inspected without holding a postgres lock open.
 */
export async function markJobDone(
  jobId: string,
  result: Record<string, unknown> | null = null,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(renderJobs)
    .set({
      status: 'done',
      result,
      finishedAt: now,
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    })
    .where(eq(renderJobs.id, jobId));
}

export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(renderJobs)
    .set({
      status: 'failed',
      error,
      finishedAt: now,
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    })
    .where(eq(renderJobs.id, jobId));
}

/**
 * Send a `running` job back to `queued` without touching the attempts counter —
 * used when a job's dependencies aren't met yet (e.g. `assembly` claimed
 * before all clips done). Different from the reaper, which clears stale locks.
 */
export async function deferJob(jobId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(renderJobs)
    .set({
      status: 'queued',
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    })
    .where(eq(renderJobs.id, jobId));
}

/**
 * Query helpers used by the worker to decide whether siblings have finished.
 */
export async function getSessionJobCounts(sessionId: string): Promise<{
  videoClipsTotal: number;
  videoClipsDone: number;
  videoClipsFailed: number;
  assemblyDone: boolean;
  notifyReadyExists: boolean;
}> {
  const db = getDb();
  const rows = await db
    .select({
      id: renderJobs.id,
      kind: renderJobs.kind,
      status: renderJobs.status,
    })
    .from(renderJobs)
    .where(eq(renderJobs.sessionId, sessionId));

  let videoClipsTotal = 0;
  let videoClipsDone = 0;
  let videoClipsFailed = 0;
  let assemblyDone = false;
  let notifyReadyExists = false;
  for (const r of rows) {
    if (r.kind === 'video_clip') {
      videoClipsTotal += 1;
      if (r.status === 'done') videoClipsDone += 1;
      else if (r.status === 'failed') videoClipsFailed += 1;
    } else if (r.kind === 'assembly' && r.status === 'done') {
      assemblyDone = true;
    } else if (r.kind === 'notify_ready') {
      notifyReadyExists = true;
    }
  }
  return { videoClipsTotal, videoClipsDone, videoClipsFailed, assemblyDone, notifyReadyExists };
}

/**
 * Reset stuck-but-running rows when a worker reboots and wants to clear its
 * own previous lease. Bounded to the workerId so we never steal another
 * worker's in-flight job.
 */
export async function releaseLeasedJobs(workerId: string): Promise<void> {
  const db = getDb();
  await db
    .update(renderJobs)
    .set({ status: 'queued', lockedAt: null, lockedBy: null, updatedAt: new Date() })
    .where(and(eq(renderJobs.lockedBy, workerId), inArray(renderJobs.status, ['running'])));
}
