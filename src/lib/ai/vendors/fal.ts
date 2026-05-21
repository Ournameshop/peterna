import 'server-only';

import { ApiError, createFalClient, type FalClient } from '@fal-ai/client';

/**
 * fal.ai image vendor — fallback for `generateImage()` per `vendor-layer.md`.
 *
 * Endpoint: `openai/gpt-image-2` — fal proxies OpenAI's GPT Image 2 with the
 * same multi-image reference contract. We pass the same `image_urls` array
 * (subject reference photos) and the same prompt; fal returns a CDN URL we
 * subsequently fetch + rehost to our own S3 bucket so we don't depend on the
 * fal CDN for any persistent storage.
 *
 * The fal SDK auth picks up `FAL_KEY` from process.env automatically. We
 * intentionally don't pin the model version — fal sometimes rolls the
 * underlying snapshot independently of OpenAI's tag.
 *
 * Errors are classified into transport vs. status so the hybrid policy in
 * `generate-image.ts` can decide whether to retry.
 */

export const FAL_IMAGE_ENDPOINT = 'fal-ai/openai-gpt-image-2/edit-image';
/** Used when no reference images are supplied — gpt-image-2 generate path on fal. */
export const FAL_IMAGE_GENERATE_ENDPOINT = 'fal-ai/openai-gpt-image-2/text-to-image';
/** Stamp emitted to `renders.model` so QA can attribute cost to fal's pinned snapshot. */
export const FAL_IMAGE_MODEL_TAG = 'fal:openai/gpt-image-2';

let cachedClient: FalClient | undefined;
function getClient(): FalClient {
  if (cachedClient) return cachedClient;
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is not set. Add it to .env (see .env.example).');
  }
  cachedClient = createFalClient({ credentials: process.env.FAL_KEY });
  return cachedClient;
}

export type FalImageInput = {
  prompt: string;
  /** Public S3 URLs of subject reference photos. Empty array → use the text-to-image endpoint. */
  imageUrls: string[];
  size: '1024x1024' | '1024x1536' | '1536x1024' | '2048x2048';
  quality: 'low' | 'medium' | 'high';
  timeoutMs: number;
  signal?: AbortSignal;
};

export type FalImageOutput = {
  bytes: Buffer;
  mimeType: 'image/png';
  costUsdEst: number;
  model: string;
};

/**
 * Call fal.ai's gpt-image-2 endpoint. References go in via `image_urls` (the
 * fal proxy supports the same multi-image contract as OpenAI's images.edit).
 */
export async function runFalGenerateImage(input: FalImageInput): Promise<FalImageOutput> {
  const client = getClient();

  const useEdit = input.imageUrls.length > 0;
  const endpoint = useEdit ? FAL_IMAGE_ENDPOINT : FAL_IMAGE_GENERATE_ENDPOINT;

  // gpt-image-2 supports up to 16 references via fal too — we don't clip here
  // because the hybrid wrapper already does it, but bound to be safe.
  const bounded = input.imageUrls.slice(0, 16);

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    image_size: mapSize(input.size),
    quality: input.quality,
    output_format: 'png',
  };
  if (useEdit) {
    payload.image_urls = bounded;
    payload.input_fidelity = 'high'; // Stage 2 mandates high fidelity for likeness.
  }

  let result;
  try {
    result = await client.subscribe(endpoint, {
      input: payload,
      abortSignal: input.signal,
      // fal's subscribe loop polls every ~1s by default; the upstream call itself takes
      // 15–40s for high-quality renders. The vendor-layer's outer timeout (30s) is the cutoff.
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new FalStatusError(err.message, err.status ?? 500);
    }
    if (isAbortError(err)) {
      throw new FalTransportError(err.message || 'aborted');
    }
    throw new FalTransportError(err instanceof Error ? err.message : 'unknown fal error');
  }

  const data = result.data as { images?: Array<{ url?: string }>; image?: { url?: string } };
  const url = data?.images?.[0]?.url ?? data?.image?.url;
  if (!url) {
    throw new FalStatusError('fal response missing image url', 502);
  }

  // Fetch the bytes off fal's CDN — we rehost to S3 in `generate-image.ts` so the
  // call site never sees a vendor URL.
  let bytes: Buffer;
  try {
    const resp = await fetch(url, { signal: input.signal });
    if (!resp.ok) {
      throw new FalStatusError(`fal CDN fetch failed: HTTP ${resp.status}`, resp.status);
    }
    bytes = Buffer.from(await resp.arrayBuffer());
  } catch (err) {
    if (err instanceof FalStatusError) throw err;
    if (isAbortError(err)) {
      throw new FalTransportError(err.message || 'aborted');
    }
    throw new FalTransportError(
      err instanceof Error ? err.message : 'unknown fal CDN fetch error',
    );
  }

  return {
    bytes,
    mimeType: 'image/png',
    costUsdEst: estimateCostUsd(input.size, input.quality),
    model: FAL_IMAGE_MODEL_TAG,
  };
}

/**
 * fal's image_size accepts named presets (`landscape_16_9`, `square_hd`, …) or
 * a `{ width, height }` object. We pass exact dimensions to keep parity with
 * OpenAI's `size` semantic.
 */
function mapSize(size: string): { width: number; height: number } {
  const [w, h] = size.split('x').map((n) => parseInt(n, 10));
  return { width: w!, height: h! };
}

/**
 * Mirror of the OpenAI cost model in `vendors/openai.ts`. fal proxies the
 * underlying OpenAI billing; the architecture doc accepts a 15% variance.
 */
function estimateCostUsd(
  size: '1024x1024' | '1024x1536' | '1536x1024' | '2048x2048',
  quality: 'low' | 'medium' | 'high',
): number {
  if (quality === 'high' && size === '2048x2048') return 0.4;
  if (quality === 'high') return 0.2;
  if (quality === 'medium') return 0.04;
  return 0.01;
}

export class FalStatusError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FalStatusError';
    this.status = status;
  }
}

export class FalTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FalTransportError';
  }
}

function isAbortError(err: unknown): err is Error {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

// -----------------------------------------------------------------------------
// Seedance 2.0 video generation — Phase 7 (Stage 6).
//
// fal endpoint: `bytedance/seedance-2.0/image-to-video` — Phase 7 path. The
// approved storyboard frame is passed as the start image; the cinematography
// brief is composed into the prompt by `build-video-clip.ts`. fal returns a
// short-lived CDN URL; we fetch the bytes and rehost to S3 in
// `generate-video.ts` so callers never see a vendor URL.
//
// Sole vendor (no fallback) — see `risk-register.md` Risk #4.
// -----------------------------------------------------------------------------

export const FAL_VIDEO_ENDPOINT = 'bytedance/seedance-2.0/image-to-video';
/** Stamp emitted to `renders.model` so QA can attribute cost to fal's pinned snapshot. */
export const FAL_VIDEO_MODEL_TAG = 'fal:bytedance/seedance-2.0/image-to-video';

/**
 * Seedance 2.0 per-clip cost estimate. fal's posted rate for the
 * `bytedance/seedance-2.0/image-to-video` endpoint is ~$0.50 / 15s 1080p
 * clip as of 2026-05-21. We mirror that as a flat per-clip number — the
 * spec only generates 15s clips, so a more elaborate size/quality table
 * would be over-engineering.
 *
 * Used both by `renders.cost_usd_est` and by the per-session budget cap
 * check in `generate-video.ts`. Confirm against the fal dashboard if the
 * 20%-fallback-rate alarm in observability ever fires from drift.
 */
export const FAL_VIDEO_CLIP_USD_EST = 0.5;

export type FalVideoInput = {
  /** Public S3 URL of the storyboard frame used as the start image. */
  imageUrl: string;
  prompt: string;
  durationSeconds: 5 | 10 | 15;
  aspectRatio: '9:16' | '16:9' | '1:1';
  timeoutMs: number;
  signal?: AbortSignal;
};

export type FalVideoOutput = {
  bytes: Buffer;
  mimeType: 'video/mp4';
  costUsdEst: number;
  model: string;
};

/**
 * Call fal's Seedance 2.0 image-to-video endpoint. Subscribes through the
 * fal client (long-poll) — typical latency 30–60s. Errors are classified
 * into transport vs. status so `generate-video.ts` can decide whether the
 * single allowed retry should fire.
 */
export async function runFalGenerateVideo(input: FalVideoInput): Promise<FalVideoOutput> {
  const client = getClient();

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    image_url: input.imageUrl,
    duration: String(input.durationSeconds),
    aspect_ratio: input.aspectRatio,
    resolution: '1080p',
    // Seedance defaults audio to on for image-to-video; pass explicit so
    // the contract doesn't drift if fal flips the default.
    generate_audio: true,
  };

  let result;
  try {
    result = await client.subscribe(FAL_VIDEO_ENDPOINT, {
      input: payload,
      abortSignal: input.signal,
      // fal's subscribe loop polls every ~1s; the upstream Seedance call
      // itself runs 30–60s. The vendor-layer's outer 180s timeout is the
      // cutoff in `generate-video.ts`.
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new FalStatusError(err.message, err.status ?? 500);
    }
    if (isAbortError(err)) {
      throw new FalTransportError(err.message || 'aborted');
    }
    throw new FalTransportError(err instanceof Error ? err.message : 'unknown fal error');
  }

  const data = result.data as {
    video?: { url?: string };
    videos?: Array<{ url?: string }>;
  };
  const url = data?.video?.url ?? data?.videos?.[0]?.url;
  if (!url) {
    throw new FalStatusError('fal seedance response missing video url', 502);
  }

  let bytes: Buffer;
  try {
    const resp = await fetch(url, { signal: input.signal });
    if (!resp.ok) {
      throw new FalStatusError(`fal CDN video fetch failed: HTTP ${resp.status}`, resp.status);
    }
    bytes = Buffer.from(await resp.arrayBuffer());
  } catch (err) {
    if (err instanceof FalStatusError) throw err;
    if (isAbortError(err)) {
      throw new FalTransportError(err.message || 'aborted');
    }
    throw new FalTransportError(
      err instanceof Error ? err.message : 'unknown fal CDN fetch error',
    );
  }

  return {
    bytes,
    mimeType: 'video/mp4',
    costUsdEst: FAL_VIDEO_CLIP_USD_EST,
    model: FAL_VIDEO_MODEL_TAG,
  };
}
