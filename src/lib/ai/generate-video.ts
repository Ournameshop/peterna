import 'server-only';

import { randomUUID } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import { getPublicUrl, uploadObject } from '@/lib/storage/s3';

import { logRender, startTimer } from './observability';
import {
  AIError,
  type GenerateVideoInput,
  type GenerateVideoResult,
  type VendorAttempt,
} from './types';
import {
  FAL_VIDEO_MODEL_TAG,
  FalStatusError,
  FalTransportError,
  runFalGenerateVideo,
} from './vendors/fal';

const VIDEO_TIMEOUT_MS = 180_000; // vendor-layer.md §"Hybrid policy" item 1 — video timeout
const RETRY_BACKOFF_MS = 3_000;

/**
 * Phase-7 implementation of the video-gen capability — Seedance 2.0 via fal.ai.
 *
 * Policy (per `vendor-layer.md` + `risk-register.md` Risk #4):
 *   1. fal.ai is the sole video vendor. No fallback exists — there is no
 *      direct ByteDance / Volcengine API accessible from a US-based Node
 *      server as of 2026-05-21.
 *   2. Per-call timeout 180s.
 *   3. Retry ONCE on 5xx / transport / timeout (3s backoff). 4xx never retries.
 *   4. Both attempts fail → throw `AIError(both_vendors_failed)` so the route
 *      handler can mark this single clip as 'failed' and let the user reroll.
 *
 * Returned MP4 bytes are rehosted to S3 at
 * `sessions/<id>/clips/<uuid>.mp4` so the call site never sees a fal CDN
 * URL (those expire) — durable public URL is what's stored on the asset row.
 */
export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoResult> {
  const attempts: VendorAttempt[] = [];
  const totalTimer = startTimer();

  let bytes: Buffer | undefined;
  let costUsdEst = 0;
  let lastError: Error | undefined;

  try {
    const out = await callFalWithRetry(input, attempts);
    bytes = out.bytes;
    costUsdEst = out.costUsdEst;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error('unknown error');
    if (isContentPolicy(err)) {
      await logRender({
        sessionId: input.sessionId,
        stage: input.stage,
        capability: 'generate_video',
        vendorAttempted: attempts.map((a) => a.vendor),
        vendorServed: null,
        model: FAL_VIDEO_MODEL_TAG,
        durationMs: totalTimer(),
        idempotencyKey: input.idempotencyKey,
        error: lastError.message,
      });
      throw new AIError(lastError.message, 'content_policy', attempts);
    }
    if (isInvalidInput(err)) {
      await logRender({
        sessionId: input.sessionId,
        stage: input.stage,
        capability: 'generate_video',
        vendorAttempted: attempts.map((a) => a.vendor),
        vendorServed: null,
        model: FAL_VIDEO_MODEL_TAG,
        durationMs: totalTimer(),
        idempotencyKey: input.idempotencyKey,
        error: lastError.message,
      });
      throw new AIError(lastError.message, 'invalid_input', attempts);
    }
  }

  const durationMs = totalTimer();

  if (!bytes) {
    await logRender({
      sessionId: input.sessionId,
      stage: input.stage,
      capability: 'generate_video',
      vendorAttempted: ['fal'],
      vendorServed: null,
      model: FAL_VIDEO_MODEL_TAG,
      durationMs,
      idempotencyKey: input.idempotencyKey,
      error: lastError?.message ?? 'fal vendor failed',
    });
    throw new AIError(
      lastError?.message ?? 'fal vendor failed',
      'both_vendors_failed',
      attempts,
    );
  }

  // Rehost to S3 at `sessions/<id>/clips/<uuid>.mp4`.
  const clipUuid = uuidv7();
  const s3Key = `sessions/${input.sessionId}/clips/${clipUuid}.mp4`;
  await uploadObject({ key: s3Key, body: bytes, contentType: 'video/mp4' });
  const publicUrl = getPublicUrl(s3Key);

  await logRender({
    sessionId: input.sessionId,
    stage: input.stage,
    capability: 'generate_video',
    vendorAttempted: ['fal'],
    vendorServed: 'fal',
    model: FAL_VIDEO_MODEL_TAG,
    requestBody: {
      duration_seconds: input.durationSeconds,
      aspect_ratio: input.aspectRatio,
      prompt_chars: input.prompt.length,
      image_url_present: Boolean(input.imageUrl),
    },
    responseUrl: publicUrl,
    costUsdEst,
    durationMs,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    url: publicUrl,
    vendorServed: 'fal',
    vendorAttempted: ['fal'],
    costUsdEst,
    durationMs,
  };
}

type CallOutput = {
  bytes: Buffer;
  costUsdEst: number;
};

async function callFalWithRetry(
  input: GenerateVideoInput,
  attempts: VendorAttempt[],
): Promise<CallOutput> {
  let firstErr: { status?: number; message: string } | undefined;
  try {
    return await callOne(input);
  } catch (err) {
    const classified = classifyError(err);
    firstErr = classified;
    if (!shouldRetry(classified)) {
      attempts.push({ vendor: 'fal', error: classified.message, status: classified.status });
      throw err;
    }
  }

  await sleep(RETRY_BACKOFF_MS);

  try {
    return await callOne(input);
  } catch (err) {
    const c2 = classifyError(err);
    attempts.push({
      vendor: 'fal',
      error: `${firstErr?.message} (retried; then: ${c2.message})`,
      status: c2.status,
    });
    throw err;
  }
}

async function callOne(input: GenerateVideoInput): Promise<CallOutput> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), VIDEO_TIMEOUT_MS);
  try {
    const out = await runFalGenerateVideo({
      imageUrl: input.imageUrl,
      prompt: input.prompt,
      durationSeconds: input.durationSeconds,
      aspectRatio: input.aspectRatio,
      timeoutMs: VIDEO_TIMEOUT_MS,
      signal: controller.signal,
    });
    return { bytes: out.bytes, costUsdEst: out.costUsdEst };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

type Classified = { status?: number; message: string; kind: 'transport' | 'status' | 'unknown' };

function classifyError(err: unknown): Classified {
  if (err instanceof FalStatusError) {
    return { status: err.status, message: err.message, kind: 'status' };
  }
  if (err instanceof FalTransportError) {
    return { message: err.message, kind: 'transport' };
  }
  return { message: err instanceof Error ? err.message : 'unknown error', kind: 'unknown' };
}

function shouldRetry(c: Classified): boolean {
  if (c.kind === 'transport') return true;
  if (c.status != null && c.status >= 500) return true;
  if (c.status === 429) return true;
  return false;
}

function isContentPolicy(err: unknown): boolean {
  if (err instanceof FalStatusError) {
    if (err.status === 400 && /content.policy|safety|moderation/i.test(err.message)) return true;
  }
  return false;
}

function isInvalidInput(err: unknown): boolean {
  if (err instanceof FalStatusError) {
    if (err.status === 400 && !isContentPolicy(err)) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { FAL_VIDEO_MODEL_TAG };

/** Generate a fresh UUID for routes that need one but don't have an idempotency key. */
export function freshIdempotencyKey(): string {
  return randomUUID();
}
