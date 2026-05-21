import 'server-only';

import OpenAI, { toFile } from 'openai';

// Model snapshot used for the vision pass. Pinned to a date-stamped GPT-4o so prompt-tuning
// stays reproducible; bump when we re-evaluate against a newer snapshot.
export const OPENAI_VISION_MODEL = 'gpt-4o-2024-11-20';

// Model snapshot used for the Stage-4 beat-sheet structured-JSON pass. Same GPT-4o family
// as the vision pass — chosen because it's already the cheapest snapshot with strict
// `response_format: json_schema` support and the prompt is well within its 128k context.
// Bump if/when we evaluate GPT-4o-mini against beat quality in production.
export const OPENAI_BEAT_SHEET_MODEL = 'gpt-4o-2024-11-20';

// Model snapshot used for image generation. GPT Image 2's released snapshot per
// `architecture.md` §1 ("gpt-image-2-2026-04-21"). The unversioned tag would float to
// whatever snapshot OpenAI rolls next — pin so prompt-tuning is reproducible.
export const OPENAI_IMAGE_MODEL = 'gpt-image-2-2026-04-21';

/**
 * GPT Image 2 supports up to 16 reference images per `images.edit` call (see
 * `node_modules/openai/resources/images.d.ts` line ~440-447 — "you can provide up to 16
 * images"). Spec mandates ALL of the user's pet photos go in as references; we clip at 16
 * with a warning log if a user somehow gets more than that into the session.
 */
export const OPENAI_IMAGE_MAX_REFERENCES = 16;

let cachedClient: OpenAI | undefined;
function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env (see .env.example).');
  }
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export type OpenAIVisionInput = {
  /** Final prompt text (after `[PET_NAME]` substitution by the caller). */
  prompt: string;
  /** Public S3 URLs of the user's pet photos. */
  photoUrls: string[];
  /** JSON Schema object (e.g. PET_PROFILE_SCHEMA) used with `response_format` strict mode. */
  schema: object;
  /** Per-call timeout in ms (vendor-layer.md hybrid policy: 12000 for vision). */
  timeoutMs: number;
  /** Optional AbortSignal so the route can cut the call short. */
  signal?: AbortSignal;
};

export type OpenAIVisionOutput = {
  /** Raw parsed JSON object. May be `{ vision_failure: true }` per the spec's hard fallback. */
  raw: Record<string, unknown>;
  /** Whether the model signalled an explicit vision_failure escape hatch. */
  visionFailure: boolean;
  /** Model snapshot string echoed for `renders.model`. */
  model: string;
};

/**
 * Call GPT-4o with the pet's photos and the structured-output schema. Maps transport / HTTP
 * errors into shapes the vendor-layer hybrid policy can route on:
 *   - `OpenAIStatusError` with `.status` (4xx/5xx) for HTTP-level failures
 *   - `OpenAITransportError` for AbortError / timeout / network failures
 */
export async function runOpenAIVision(input: OpenAIVisionInput): Promise<OpenAIVisionOutput> {
  const client = getClient();

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: input.prompt },
    ...input.photoUrls.map(
      (url): OpenAI.Chat.ChatCompletionContentPartImage => ({
        type: 'image_url',
        image_url: { url },
      }),
    ),
  ];

  try {
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_VISION_MODEL,
        messages: [{ role: 'user', content: userContent }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'pet_profile',
            schema: input.schema as Record<string, unknown>,
            strict: true,
          },
        },
        max_tokens: 800,
      },
      { timeout: input.timeoutMs, signal: input.signal },
    );

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new OpenAIStatusError('empty response from gpt-4o', 502);
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new OpenAIStatusError('gpt-4o returned non-JSON content', 502);
    }

    return {
      raw,
      visionFailure: raw.vision_failure === true,
      model: completion.model ?? OPENAI_VISION_MODEL,
    };
  } catch (err) {
    if (err instanceof OpenAIStatusError) throw err;
    if (err instanceof OpenAI.APIError) {
      throw new OpenAIStatusError(err.message, err.status ?? 500);
    }
    if (isAbortError(err)) {
      throw new OpenAITransportError(err.message || 'aborted');
    }
    throw new OpenAITransportError(err instanceof Error ? err.message : 'unknown openai error');
  }
}

export class OpenAIStatusError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenAIStatusError';
    this.status = status;
  }
}

export class OpenAITransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAITransportError';
  }
}

function isAbortError(err: unknown): err is Error {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

// ---------------------------------------------------------------------------
// Image gen — GPT Image 2 (Phase 2)
// ---------------------------------------------------------------------------

export type OpenAIImageInput = {
  prompt: string;
  /** Public S3 URLs of reference photos. Empty array → `images.generate` path. */
  referenceUrls: string[];
  size: '1024x1024' | '1024x1536' | '1536x1024' | '2048x2048';
  quality: 'low' | 'medium' | 'high';
  timeoutMs: number;
  signal?: AbortSignal;
};

export type OpenAIImageOutput = {
  bytes: Buffer;
  mimeType: 'image/png';
  /** Stage-2 estimate; see `estimateCostUsd` for the per-tier breakdown. */
  costUsdEst: number;
  /** Echoed for `renders.model`. */
  model: string;
};

/**
 * Call GPT Image 2 with the prompt + ALL of the user's pet photos as references (or no
 * references, on the `images.generate` path for non-likeness-bound stages like the manual
 * variation case).
 *
 * Implementation notes:
 *   - GPT image models always return `b64_json`, never a URL (see `images.d.ts` line ~70).
 *     We decode here so the caller sees a Buffer + mime type, ready for S3 rehost.
 *   - References go in as `Uploadable[]` via `openai.toFile()` — we fetch each S3 URL,
 *     turn the bytes into a file-shaped object, then pass them in `image: [...]`.
 *   - Clipped to 16 references max (SDK limit, see jsdoc on `OPENAI_IMAGE_MAX_REFERENCES`).
 */
export async function runOpenAIGenerateImage(input: OpenAIImageInput): Promise<OpenAIImageOutput> {
  const client = getClient();

  const refsBounded = input.referenceUrls.slice(0, OPENAI_IMAGE_MAX_REFERENCES);
  if (input.referenceUrls.length > OPENAI_IMAGE_MAX_REFERENCES) {
    console.warn('[openai.image] reference count exceeds vendor limit; clipping', {
      received: input.referenceUrls.length,
      limit: OPENAI_IMAGE_MAX_REFERENCES,
    });
  }

  try {
    const b64 = refsBounded.length > 0
      ? await callEdit(client, input.prompt, refsBounded, input.size, input.quality, input.timeoutMs, input.signal)
      : await callGenerate(client, input.prompt, input.size, input.quality, input.timeoutMs, input.signal);

    return {
      bytes: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
      costUsdEst: estimateCostUsd(input.size, input.quality),
      model: OPENAI_IMAGE_MODEL,
    };
  } catch (err) {
    if (err instanceof OpenAIStatusError) throw err;
    if (err instanceof OpenAI.APIError) {
      throw new OpenAIStatusError(err.message, err.status ?? 500);
    }
    if (isAbortError(err)) {
      throw new OpenAITransportError(err.message || 'aborted');
    }
    throw new OpenAITransportError(err instanceof Error ? err.message : 'unknown openai error');
  }
}

async function callEdit(
  client: OpenAI,
  prompt: string,
  referenceUrls: string[],
  size: string,
  quality: 'low' | 'medium' | 'high',
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<string> {
  // Fetch reference bytes off our own S3 (vendor URLs would expire) and wrap as File-shaped
  // Uploadables. Each fetch shares the outer timeout via the same AbortSignal.
  const refFiles = await Promise.all(
    referenceUrls.map(async (url, i) => {
      const resp = await fetch(url, { signal });
      if (!resp.ok) {
        throw new OpenAIStatusError(`reference fetch failed: HTTP ${resp.status}`, resp.status);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      const contentType = resp.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
      return toFile(buf, `reference-${i}.${ext}`, { type: contentType });
    }),
  );

  const response = await client.images.edit(
    {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      image: refFiles,
      size: size as '1024x1024' | '1024x1536' | '1536x1024',
      quality,
      input_fidelity: 'high', // Stage 2 mandates high fidelity for likeness.
      output_format: 'png',
      n: 1,
    },
    { timeout: timeoutMs, signal },
  );

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new OpenAIStatusError('openai.images.edit returned no b64_json', 502);
  return b64;
}

async function callGenerate(
  client: OpenAI,
  prompt: string,
  size: string,
  quality: 'low' | 'medium' | 'high',
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<string> {
  const response = await client.images.generate(
    {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size: size as '1024x1024' | '1024x1536' | '1536x1024',
      quality,
      output_format: 'png',
      n: 1,
    },
    { timeout: timeoutMs, signal },
  );

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new OpenAIStatusError('openai.images.generate returned no b64_json', 502);
  return b64;
}

/**
 * Per-render cost estimate — used as input to the $10/session budget cap. Numbers from
 * `architecture.md` §1 ("character sheet 1 + ~4 refinements × $0.40 ≈ $2.00"). Wrong values
 * here poison the cap so don't fudge them.
 */
function estimateCostUsd(
  size: '1024x1024' | '1024x1536' | '1536x1024' | '2048x2048',
  quality: 'low' | 'medium' | 'high',
): number {
  if (quality === 'high' && size === '2048x2048') return 0.4;   // character sheet, spec
  if (quality === 'high') return 0.2;                            // smaller hi-q renders
  if (quality === 'medium') return 0.04;                         // combination preview
  return 0.01;                                                   // exploratory / low
}

// ---------------------------------------------------------------------------
// Beat sheet — GPT-4o structured JSON (Phase 4a)
// ---------------------------------------------------------------------------

export type OpenAIBeatSheetInput = {
  /** Final prompt text (after substitutions by the caller). */
  prompt: string;
  /** JSON Schema object passed via `response_format: json_schema` strict mode. */
  schema: object;
  /** Per-call timeout in ms (vendor-layer hybrid policy: 12000 for text passes). */
  timeoutMs: number;
  /** Optional AbortSignal so the route can cut the call short. */
  signal?: AbortSignal;
};

export type OpenAIBeatSheetOutput = {
  /** Raw parsed JSON object. Caller normalizes / validates against `BeatWire[]`. */
  raw: Record<string, unknown>;
  /** Model snapshot string echoed for `renders.model`. */
  model: string;
};

/**
 * Call GPT-4o with a prompt and a JSON schema, expecting a structured beat-sheet object.
 * No image references — this is a pure text pass. Mirrors `runOpenAIVision`'s error
 * shape so the hybrid policy in `run-beat-sheet.ts` can route on it identically.
 */
export async function runOpenAIBeatSheet(
  input: OpenAIBeatSheetInput,
): Promise<OpenAIBeatSheetOutput> {
  const client = getClient();

  try {
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_BEAT_SHEET_MODEL,
        messages: [{ role: 'user', content: input.prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'beat_sheet',
            schema: input.schema as Record<string, unknown>,
            strict: true,
          },
        },
        // Generous ceiling: 16 beats × ~80 tokens of scene/caption + envelope ≈ 1600. Add headroom.
        max_tokens: 2400,
      },
      { timeout: input.timeoutMs, signal: input.signal },
    );

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new OpenAIStatusError('empty response from gpt-4o beat-sheet', 502);
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new OpenAIStatusError('gpt-4o returned non-JSON content for beat-sheet', 502);
    }

    return {
      raw,
      model: completion.model ?? OPENAI_BEAT_SHEET_MODEL,
    };
  } catch (err) {
    if (err instanceof OpenAIStatusError) throw err;
    if (err instanceof OpenAI.APIError) {
      throw new OpenAIStatusError(err.message, err.status ?? 500);
    }
    if (isAbortError(err)) {
      throw new OpenAITransportError(err.message || 'aborted');
    }
    throw new OpenAITransportError(err instanceof Error ? err.message : 'unknown openai error');
  }
}
