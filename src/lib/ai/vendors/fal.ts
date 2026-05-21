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
