import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateVideo } from '@/lib/ai/generate-video';
import { AIError } from '@/lib/ai/types';
import { stitchTribute, type AssemblyAspect } from '@/lib/assembly/stitch';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  MotionBriefWire,
  VideoClipStatus,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, sessions, users, type RenderJob } from '@/lib/db/schema';
import { findArtStyle } from '@/lib/library/art-styles';
import { findFormat } from '@/lib/library/formats';
import { findTheme } from '@/lib/library/themes';
import { findMusicTrack } from '@/lib/library/music-tracks';
import { sendTributeReadyEmail } from '@/lib/notifications/tribute-ready-email';
import { normalizeAspect } from '@/lib/prompts/build-preview';
import {
  buildVideoClipPrompt,
  selectSeedPhotoForBeat,
} from '@/lib/prompts/build-video-clip';
import { sendPushToSession } from '@/lib/push/send';
import { shareUrlForSlug } from '@/lib/delivery/slug';
import { getPublicUrl, uploadObject } from '@/lib/storage/s3';

import { claimNextJob, reapStaleJobs } from './claim';
import { enqueueJob } from './enqueue';
import {
  deferJob,
  getSessionJobCounts,
  markJobDone,
  markJobFailed,
  releaseLeasedJobs,
} from './finish';

/**
 * Phase 12 worker loop. Long-lived Node process started via `npm run worker`
 * (entrypoint at `scripts/worker.ts`). Multiple worker processes can run
 * against the same Postgres; SKIP LOCKED makes claim safe.
 *
 * Lifecycle:
 *   1. On boot: release any rows previously leased by this workerId (cheap
 *      recovery after a crash with the same HOSTNAME).
 *   2. Every 2s: claim one queued job. If none, sleep + continue.
 *   3. Every 60s (separately): reap rows whose `locked_at` is older than
 *      the per-kind threshold (`STALE_THRESHOLDS`) — these are dead workers'
 *      orphans. Video clips get a longer ceiling than the default (B3) so a
 *      slow-but-healthy Seedance call doesn't get re-fired and double-billed.
 *   4. Per kind:
 *        - `video_clip`  → call `generateVideo`, persist asset, update
 *          session's `video_clip_asset_ids` + status array.
 *        - `assembly`    → wait for all clips done (else `deferJob`),
 *          then stitch + persist final asset.
 *        - `notify_ready`→ send email (if email known) + web push.
 *      When clips + assembly are all done and no notify_ready row exists
 *      yet, auto-enqueue one.
 *
 * Errors thrown out of a handler mark the job as failed (one attempt — no
 * automatic retry; user can re-trigger via reroll for clips, or the
 * dependency check naturally retries assembly on the next poll).
 */

const POLL_INTERVAL_MS = 2_000;
const REAP_INTERVAL_MS = 60_000;

// Per-kind staleness thresholds for the reaper (B3 in pre-Phase-15 audit).
// Seedance 2.0 image-to-video legitimately takes 60–120s but can exceed 10 min
// under fal queue pressure; a 10-min reap re-fires the vendor call and burns
// $0.50/clip. Bump video_clip well past the worst-case observed; bump assembly
// to cover ffmpeg under contention; keep others on the default short ceiling.
const STALE_THRESHOLDS = {
  defaultStaleAfterMs: 10 * 60_000,
  byKind: {
    video_clip: 25 * 60_000,
    assembly: 15 * 60_000,
  },
};

export type WorkerHandle = {
  stop: () => Promise<void>;
};

export function workerId(): string {
  const host = process.env.HOSTNAME || 'worker';
  return `${host}#${process.pid}`;
}

/**
 * Start the worker loop. Returns a handle that can stop it gracefully
 * (so SIGTERM-aware deployments don't leave a half-done claim).
 */
export function startWorker(): WorkerHandle {
  const id = workerId();
  let stopped = false;

  const claim = async (): Promise<void> => {
    if (stopped) return;
    let job: RenderJob | null = null;
    try {
      job = await claimNextJob(id);
    } catch (err) {
      logError('claim failed', err);
      return;
    }
    if (!job) return;
    try {
      await runJob(job);
    } catch (err) {
      logError(`job ${job.kind} ${job.id} crashed`, err);
      await markJobFailed(job.id, errorMessage(err)).catch((e) =>
        logError('markJobFailed crashed', e),
      );
    }
  };

  const reap = async (): Promise<void> => {
    try {
      const n = await reapStaleJobs(STALE_THRESHOLDS);
      if (n > 0) console.log(`[worker ${id}] reaped ${n} stale job(s)`);
    } catch (err) {
      logError('reaper failed', err);
    }
  };

  releaseLeasedJobs(id).catch((err) => logError('boot release failed', err));

  const pollTimer = setInterval(() => {
    void claim();
  }, POLL_INTERVAL_MS);
  const reapTimer = setInterval(() => {
    void reap();
  }, REAP_INTERVAL_MS);

  return {
    stop: async () => {
      stopped = true;
      clearInterval(pollTimer);
      clearInterval(reapTimer);
    },
  };
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

async function runJob(job: RenderJob): Promise<void> {
  switch (job.kind) {
    case 'video_clip':
      return runVideoClipJob(job);
    case 'assembly':
      return runAssemblyJob(job);
    case 'notify_ready':
      return runNotifyReadyJob(job);
    default:
      await markJobFailed(job.id, `unknown-kind:${job.kind}`);
  }
}

async function runVideoClipJob(job: RenderJob): Promise<void> {
  const beatIdx = (job.payload as { beat_idx?: unknown })?.beat_idx;
  if (typeof beatIdx !== 'number') {
    await markJobFailed(job.id, 'invalid-payload');
    return;
  }

  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, job.sessionId)).limit(1);
  const row = rows[0];
  if (!row) {
    await markJobFailed(job.id, 'session-not-found');
    return;
  }
  const session = serializeSession(row);

  const beats = (session.beat_sheet ?? []) as BeatWire[];
  const beat = beats.find((b) => b.idx === beatIdx);
  const briefs = (session.cinematography_briefs ?? []) as MotionBriefWire[];
  const brief = briefs.find((b) => b.beat_idx === beatIdx);
  const frameAssetIds = session.storyboard_frame_asset_ids ?? null;
  const frameAssetId = frameAssetIds?.[beatIdx];

  if (!beat || !brief || !frameAssetId) {
    await markJobFailed(job.id, 'preconditions-missing');
    await setClipStatus(job.sessionId, beatIdx, 'failed');
    return;
  }

  const format = findFormat(session.format_id ?? '');
  const theme = findTheme(session.theme_id ?? '');
  const style = findArtStyle(session.style_id ?? '');
  if (!format || !theme || !style) {
    await markJobFailed(job.id, 'library-lookup-failed');
    await setClipStatus(job.sessionId, beatIdx, 'failed');
    return;
  }

  const frameRows = await db
    .select({ id: assets.id, publicUrl: assets.publicUrl, kind: assets.kind })
    .from(assets)
    .where(eq(assets.id, frameAssetId));
  const frame = frameRows[0];
  if (!frame || frame.kind !== 'storyboard_frame') {
    await markJobFailed(job.id, 'frame-asset-missing');
    await setClipStatus(job.sessionId, beatIdx, 'failed');
    return;
  }

  await setClipStatus(job.sessionId, beatIdx, 'rendering');

  // Phase 15a — opportunistic with_human seed photo. For memory/companionship
  // beats, we feed Seedance a real photo of pet+person as the start frame
  // instead of the rendered storyboard frame. Selector returns null when the
  // archetype isn't in scope or the session has no with_human photos.
  const withHumanRows = await db
    .select({ url: assets.publicUrl })
    .from(assets)
    .where(
      and(
        eq(assets.sessionId, job.sessionId),
        eq(assets.kind, 'pet_photo'),
        sql`${assets.metadata}->>'photo_role' = 'with_human'`,
      ),
    );
  const seedPhotoOverrideUrl =
    selectSeedPhotoForBeat({
      beatIdx,
      archetype: beat.archetype,
      withHumanPhotoUrls: withHumanRows.map((r) => r.url),
    }) ?? undefined;

  const { prompt, imageUrl, durationSeconds, aspectRatio } = buildVideoClipPrompt({
    session,
    beat,
    brief,
    format,
    theme,
    style,
    storyboardFrameUrl: frame.publicUrl,
    seedPhotoOverrideUrl,
  });

  let result;
  try {
    result = await generateVideo({
      imageUrl,
      prompt,
      durationSeconds,
      aspectRatio,
      sessionId: job.sessionId,
      idempotencyKey: `job-${job.id}`,
      stage: 'video_clip',
    });
  } catch (err) {
    const code = err instanceof AIError ? err.code : 'unknown';
    const reason =
      code === 'content_policy'
        ? 'content-policy-violation'
        : code === 'invalid_input'
          ? 'invalid-input'
          : 'render_failed';
    await setClipStatus(job.sessionId, beatIdx, 'failed');
    await markJobFailed(job.id, reason);
    return;
  }

  const assetId = uuidv7();
  const s3Key = extractS3KeyFromPublicUrl(result.url);
  await db.insert(assets).values({
    id: assetId,
    sessionId: job.sessionId,
    kind: 'video_clip',
    source: 'vendor_render',
    r2Key: s3Key,
    publicUrl: result.url,
    mimeType: 'video/mp4',
    metadata: {
      vendor_served: result.vendorServed,
      vendor_attempted: result.vendorAttempted,
      cost_usd_est: result.costUsdEst,
      duration_ms: result.durationMs,
      beat_idx: beatIdx,
      beat_archetype: beat.archetype,
      format_id: format.id,
      theme_id: theme.id,
      style_id: style.id,
      aspect_ratio: aspectRatio,
      duration_s: durationSeconds,
    },
  });

  await persistClipDone(job.sessionId, beatIdx, assetId, beats.length);
  await markJobDone(job.id, { asset_id: assetId, public_url: result.url });

  await maybeEnqueueNotifyReady(job.sessionId);
}

async function runAssemblyJob(job: RenderJob): Promise<void> {
  const db = getDb();

  const rows = await db.select().from(sessions).where(eq(sessions.id, job.sessionId)).limit(1);
  const row = rows[0];
  if (!row) {
    await markJobFailed(job.id, 'session-not-found');
    return;
  }
  const session = serializeSession(row);

  const counts = await getSessionJobCounts(job.sessionId);
  const beats = (session.beat_sheet ?? []) as BeatWire[];

  // Wait for every clip job to be done. Any failed clip blocks assembly —
  // the user must reroll before we stitch.
  if (counts.videoClipsTotal < beats.length || counts.videoClipsDone < beats.length) {
    if (counts.videoClipsFailed > 0) {
      await markJobFailed(job.id, 'incomplete-clips');
      return;
    }
    // Clips still in flight; defer ourselves and try again on the next poll.
    await deferJob(job.id);
    return;
  }

  const statuses = (session.video_clip_statuses ?? []) as VideoClipStatus[];
  const clipAssetIds = (session.video_clip_asset_ids ?? []) as string[];
  if (
    statuses.length === 0 ||
    statuses.length !== clipAssetIds.length ||
    statuses.some((s) => s !== 'done') ||
    clipAssetIds.some((id) => !id)
  ) {
    await markJobFailed(job.id, 'incomplete-clips');
    return;
  }

  const aspectRatio = session.aspect_ratio;
  if (!aspectRatio) {
    await markJobFailed(job.id, 'invalid-input');
    return;
  }
  const aspect = normalizeAspect(aspectRatio) as AssemblyAspect;

  const clipRows = await db
    .select({
      id: assets.id,
      publicUrl: assets.publicUrl,
      kind: assets.kind,
      sessionId: assets.sessionId,
    })
    .from(assets)
    .where(inArray(assets.id, clipAssetIds));
  const urlByAssetId = new Map<string, string>();
  for (const r of clipRows) {
    if (r.sessionId !== job.sessionId) continue;
    if (r.kind !== 'video_clip') continue;
    urlByAssetId.set(r.id, r.publicUrl);
  }
  const clipUrls: string[] = [];
  for (let i = 0; i < clipAssetIds.length; i++) {
    const url = urlByAssetId.get(clipAssetIds[i]!);
    if (!url) {
      await markJobFailed(job.id, 'incomplete-clips');
      return;
    }
    clipUrls.push(url);
  }

  const cardAssetIds = (session.card_preview_asset_ids ?? []) as string[];
  let openingCardUrl: string | null = null;
  let closingCardUrl: string | null = null;
  if (cardAssetIds.length >= 2 && cardAssetIds[0] && cardAssetIds[1]) {
    const cardRows = await db
      .select({
        id: assets.id,
        publicUrl: assets.publicUrl,
        kind: assets.kind,
        sessionId: assets.sessionId,
      })
      .from(assets)
      .where(inArray(assets.id, [cardAssetIds[0]!, cardAssetIds[1]!]));
    for (const r of cardRows) {
      if (r.sessionId !== job.sessionId) continue;
      if (r.kind !== 'card_preview') continue;
      if (r.id === cardAssetIds[0]) openingCardUrl = r.publicUrl;
      if (r.id === cardAssetIds[1]) closingCardUrl = r.publicUrl;
    }
  }

  const track = findMusicTrack(session.music_track_id);
  const useMusic = Boolean(track && track.id !== 'silence');

  const [clipBuffers, openingCardPng, closingCardPng] = await Promise.all([
    Promise.all(clipUrls.map(fetchAsBuffer)),
    openingCardUrl ? fetchAsBuffer(openingCardUrl) : Promise.resolve(null),
    closingCardUrl ? fetchAsBuffer(closingCardUrl) : Promise.resolve(null),
  ]);

  // Pre-compute the S3 key + URL so we can tell the stitcher where the bytes
  // are going to live — that URL ends up on the renders row alongside the
  // ffmpeg outcome.
  const finalUuid = uuidv7();
  const s3Key = `sessions/${job.sessionId}/final/${finalUuid}.mp4`;
  const publicUrl = getPublicUrl(s3Key);

  let assemblyOut;
  try {
    assemblyOut = await stitchTribute({
      clipBuffers,
      openingCardPng,
      closingCardPng,
      musicBuffer: null,
      narrationBuffer: null,
      aspect,
      sessionId: job.sessionId,
      idempotencyKey: `job-${job.id}`,
      responseUrl: publicUrl,
    });
  } catch (err) {
    logError(`[worker] stitch failed for session ${job.sessionId}`, err);
    await markJobFailed(job.id, 'assembly_failed');
    return;
  }

  await uploadObject({ key: s3Key, body: assemblyOut.bytes, contentType: assemblyOut.mimeType });

  const finalAssetId = uuidv7();
  await db.insert(assets).values({
    id: finalAssetId,
    sessionId: job.sessionId,
    kind: 'final_video',
    source: 'assembly',
    r2Key: s3Key,
    publicUrl,
    mimeType: 'video/mp4',
    bytes: assemblyOut.bytes.length,
    metadata: {
      aspect_ratio: aspect,
      clip_count: clipBuffers.length,
      has_opening_card: Boolean(openingCardPng),
      has_closing_card: Boolean(closingCardPng),
      music_track_id: useMusic ? track?.id ?? null : null,
      stitch_duration_ms: assemblyOut.durationMs,
    },
  });

  await db
    .update(sessions)
    .set({
      assembledVideoAssetId: finalAssetId,
      stage: 'assembly_review',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, job.sessionId));

  await markJobDone(job.id, { asset_id: finalAssetId, public_url: publicUrl });

  await maybeEnqueueNotifyReady(job.sessionId);
}

async function runNotifyReadyJob(job: RenderJob): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, job.sessionId)).limit(1);
  const row = rows[0];
  if (!row) {
    await markJobFailed(job.id, 'session-not-found');
    return;
  }
  const session = serializeSession(row);

  const petName = session.pet_name?.trim() || 'your pet';
  const slug = session.delivery_share_slug;
  const shareUrl = slug ? shareUrlForSlug(slug) : null;

  // Pick the best email target — auth_user > prior delivery email recipient.
  let toEmail: string | null = session.delivery_emailed_to?.trim() || null;
  if (!toEmail && session.user_id) {
    const userRows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.user_id))
      .limit(1);
    toEmail = userRows[0]?.email ?? null;
  }

  const result = { email_sent_to: null as string | null, push_sent_count: 0 };

  if (toEmail && shareUrl) {
    const emailResult = await sendTributeReadyEmail({ to: toEmail, petName, shareUrl });
    if (emailResult.ok) result.email_sent_to = toEmail;
  }

  try {
    const pushResult = await sendPushToSession(job.sessionId, {
      title: `${petName}'s tribute is ready`,
      body: 'Your tribute video has been assembled and is ready to share.',
      url: shareUrl ?? '/dashboard',
    });
    result.push_sent_count = pushResult.delivered;
  } catch (err) {
    logError('push send failed', err);
  }

  await markJobDone(job.id, result);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function setClipStatus(
  sessionId: string,
  beatIdx: number,
  status: VideoClipStatus,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ videoClipStatuses: sessions.videoClipStatuses })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const current = (rows[0]?.videoClipStatuses as VideoClipStatus[] | null) ?? [];
  const next: VideoClipStatus[] = [...current];
  while (next.length <= beatIdx) next.push('queued');
  next[beatIdx] = status;
  await db
    .update(sessions)
    .set({ videoClipStatuses: next, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

async function persistClipDone(
  sessionId: string,
  beatIdx: number,
  assetId: string,
  beatCount: number,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      videoClipAssetIds: sessions.videoClipAssetIds,
      videoClipStatuses: sessions.videoClipStatuses,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const assetIds = [...((rows[0]?.videoClipAssetIds as string[] | null) ?? [])];
  const statuses = [...((rows[0]?.videoClipStatuses as VideoClipStatus[] | null) ?? [])];
  while (assetIds.length < beatCount) assetIds.push('');
  while (statuses.length < beatCount) statuses.push('queued');
  assetIds[beatIdx] = assetId;
  statuses[beatIdx] = 'done';
  await db
    .update(sessions)
    .set({
      videoClipAssetIds: assetIds,
      videoClipStatuses: statuses,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

async function maybeEnqueueNotifyReady(sessionId: string): Promise<void> {
  const counts = await getSessionJobCounts(sessionId);
  if (
    counts.videoClipsTotal > 0 &&
    counts.videoClipsDone === counts.videoClipsTotal &&
    counts.assemblyDone &&
    !counts.notifyReadyExists
  ) {
    await enqueueJob({ sessionId, kind: 'notify_ready', payload: {} });
  }
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${url} failed: HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) return url.slice(base.length + 1);
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 500);
  return String(err).slice(0, 500);
}

function logError(label: string, err: unknown): void {
  console.error(`[worker] ${label}`, err instanceof Error ? err.stack ?? err.message : err);
}
