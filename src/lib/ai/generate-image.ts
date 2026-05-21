import 'server-only';

import { randomUUID } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import { getPublicUrl, uploadObject } from '@/lib/storage/s3';

import { logRender, startTimer } from './observability';
import {
  AIError,
  type GenerateImageInput,
  type GenerateImageResult,
  type VendorAttempt,
  type VendorTag,
} from './types';
import {
  OPENAI_IMAGE_MODEL,
  OpenAIStatusError,
  OpenAITransportError,
  runOpenAIGenerateImage,
} from './vendors/openai';
import {
  FAL_IMAGE_MODEL_TAG,
  FalStatusError,
  FalTransportError,
  runFalGenerateImage,
} from './vendors/fal';

const IMAGE_TIMEOUT_MS = 30_000; // vendor-layer.md §"Hybrid policy" item 1 — image timeout
const RETRY_BACKOFF_1_MS = 1_000;
const RETRY_BACKOFF_2_MS = 3_000;

/**
 * Phase-2 implementation of the image-gen capability.
 *
 * Policy (per `vendor-layer.md`):
 *   1. Call OpenAI primary with a 30s timeout.
 *   2. Retry primary once on 5xx / transport / timeout (1s → 3s backoff).
 *   3. Fall to fal.ai on 429 / 5xx after retry, transport timeout, quota_exceeded.
 *      4xx (content_policy, invalid_input) skip the fallback — surface cleanly.
 *   4. Both fail → throw AIError(both_vendors_failed).
 *
 * The returned bytes are rehosted to S3 inside this function (vendor URLs expire — OpenAI's
 * b64_json is in-band, fal returns a time-limited CDN URL). Call sites get back an S3 public
 * URL and store that as `assets.public_url` — durable.
 *
 * S3 rehost format: PNG. OpenAI's GPT Image 2 returns PNG by default; we don't transcode to
 * webp because the character sheet is rendered straight back to the user inside the gate
 * review UI, and PNG is the cheapest path (no quality loss on transcode, no extra CPU,
 * client-side bandwidth difference is small for our render sizes).
 */
export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const attempts: VendorAttempt[] = [];
  const override = process.env.AI_VENDOR_OVERRIDE as VendorTag | undefined;
  const order: VendorTag[] =
    override === 'fal' ? ['fal'] : override === 'openai' ? ['openai'] : ['openai', 'fal'];

  const totalTimer = startTimer();
  let modelTag: string | undefined;
  let lastError: Error | undefined;
  let bytes: Buffer | undefined;
  let mimeType: 'image/png' | undefined;
  let costUsdEst = 0;
  let servedBy: VendorTag | undefined;

  for (const vendor of order) {
    try {
      const out = await callVendorWithRetry(vendor, input, attempts);
      bytes = out.bytes;
      mimeType = out.mimeType;
      costUsdEst = out.costUsdEst;
      modelTag = out.model;
      servedBy = vendor;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('unknown error');
      // Content-policy errors don't trampoline to fallback — same prompt fails the same way
      // on fal. Surface cleanly and let the route map to `content-policy-violation`.
      if (isContentPolicy(err)) {
        await logRender({
          sessionId: input.sessionId,
          stage: input.stage,
          capability: 'generate_image',
          vendorAttempted: attempts.map((a) => a.vendor),
          vendorServed: null,
          model: modelTag,
          durationMs: totalTimer(),
          idempotencyKey: input.idempotencyKey,
          error: lastError.message,
        });
        throw new AIError(lastError.message, 'content_policy', attempts);
      }
      // Invalid input is also non-retryable across vendors.
      if (isInvalidInput(err)) {
        await logRender({
          sessionId: input.sessionId,
          stage: input.stage,
          capability: 'generate_image',
          vendorAttempted: attempts.map((a) => a.vendor),
          vendorServed: null,
          model: modelTag,
          durationMs: totalTimer(),
          idempotencyKey: input.idempotencyKey,
          error: lastError.message,
        });
        throw new AIError(lastError.message, 'invalid_input', attempts);
      }
      // Otherwise: try the next vendor in `order`.
    }
  }

  const durationMs = totalTimer();

  if (!bytes || !mimeType || !servedBy) {
    await logRender({
      sessionId: input.sessionId,
      stage: input.stage,
      capability: 'generate_image',
      vendorAttempted: order,
      vendorServed: null,
      model: modelTag,
      durationMs,
      idempotencyKey: input.idempotencyKey,
      error: lastError?.message ?? 'both vendors failed',
    });
    throw new AIError(
      lastError?.message ?? 'both vendors failed',
      'both_vendors_failed',
      attempts,
    );
  }

  // Rehost to S3. Key shape: `sessions/<id>/renders/<uuid>.png`.
  const renderUuid = uuidv7();
  const s3Key = `sessions/${input.sessionId}/renders/${renderUuid}.png`;
  await uploadObject({ key: s3Key, body: bytes, contentType: mimeType });
  const publicUrl = getPublicUrl(s3Key);

  await logRender({
    sessionId: input.sessionId,
    stage: input.stage,
    capability: 'generate_image',
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    vendorServed: servedBy,
    model: modelTag,
    requestBody: {
      size: input.size,
      quality: input.quality,
      ref_count: input.references?.length ?? 0,
      prompt_chars: input.prompt.length,
    },
    responseUrl: publicUrl,
    costUsdEst,
    durationMs,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    url: publicUrl,
    vendorServed: servedBy,
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    costUsdEst,
    durationMs,
  };
}

type CallOutput = {
  bytes: Buffer;
  mimeType: 'image/png';
  costUsdEst: number;
  model: string;
};

async function callVendorWithRetry(
  vendor: VendorTag,
  input: GenerateImageInput,
  attempts: VendorAttempt[],
): Promise<CallOutput> {
  let firstErr: { status?: number; message: string } | undefined;
  try {
    return await callOne(vendor, input);
  } catch (err) {
    const classified = classifyError(err);
    firstErr = classified;
    if (!shouldRetry(classified)) {
      attempts.push({ vendor, error: classified.message, status: classified.status });
      throw err;
    }
  }

  await sleep(RETRY_BACKOFF_1_MS);

  try {
    return await callOne(vendor, input);
  } catch (err) {
    const classified = classifyError(err);
    // One more shot on transport/5xx — the second backoff is 3s per the spec's 1s→3s ladder.
    if (shouldRetry(classified)) {
      await sleep(RETRY_BACKOFF_2_MS);
      try {
        return await callOne(vendor, input);
      } catch (err2) {
        const c2 = classifyError(err2);
        attempts.push({
          vendor,
          error: `${firstErr?.message} (retried twice; then: ${c2.message})`,
          status: c2.status,
        });
        throw err2;
      }
    }
    attempts.push({
      vendor,
      error: `${firstErr?.message} (retried; then: ${classified.message})`,
      status: classified.status,
    });
    throw err;
  }
}

async function callOne(vendor: VendorTag, input: GenerateImageInput): Promise<CallOutput> {
  const referenceUrls = (input.references ?? []).map((r) => r.url);

  if (vendor === 'openai') {
    const out = await runOpenAIGenerateImage({
      prompt: input.prompt,
      referenceUrls,
      size: input.size,
      quality: input.quality,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
    return out;
  }
  if (vendor === 'fal') {
    const out = await runFalGenerateImage({
      prompt: input.prompt,
      imageUrls: referenceUrls,
      size: input.size,
      quality: input.quality,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
    return out;
  }
  // gemini isn't an image vendor — guard for completeness.
  throw new AIError(`vendor ${vendor} is not an image-gen vendor`, 'invalid_input');
}

type Classified = { status?: number; message: string; kind: 'transport' | 'status' | 'unknown' };

function classifyError(err: unknown): Classified {
  if (err instanceof OpenAIStatusError || err instanceof FalStatusError) {
    return { status: err.status, message: err.message, kind: 'status' };
  }
  if (err instanceof OpenAITransportError || err instanceof FalTransportError) {
    return { message: err.message, kind: 'transport' };
  }
  return { message: err instanceof Error ? err.message : 'unknown error', kind: 'unknown' };
}

function shouldRetry(c: Classified): boolean {
  if (c.kind === 'transport') return true;
  if (c.status != null && c.status >= 500) return true;
  // Treat 429 as retryable inside the same vendor too (rate limit may clear).
  if (c.status === 429) return true;
  return false;
}

function isContentPolicy(err: unknown): boolean {
  if (err instanceof OpenAIStatusError || err instanceof FalStatusError) {
    if (err.status === 400 && /content.policy|safety|moderation/i.test(err.message)) return true;
  }
  return false;
}

function isInvalidInput(err: unknown): boolean {
  if (err instanceof OpenAIStatusError || err instanceof FalStatusError) {
    if (err.status === 400 && !isContentPolicy(err)) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-export the model tags so debug helpers can identify which snapshot served them.
export { OPENAI_IMAGE_MODEL, FAL_IMAGE_MODEL_TAG };

/** Generate a fresh UUID for routes that need one but don't have an idempotency key. */
export function freshIdempotencyKey(): string {
  return randomUUID();
}
