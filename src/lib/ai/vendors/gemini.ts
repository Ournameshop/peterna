import 'server-only';

import { GoogleGenAI } from '@google/genai';

/**
 * Google's *current* SDK is `@google/genai` (replaces the deprecated `@google/generative-ai`
 * package that this codebase's training cutoff probably remembers). Verified on npm: latest
 * stable is 2.5.0, published recently. `vendor-layer.md` flags this name has been moving — if
 * Google renames it again before merge, update both this import and `package.json`.
 */

// Gemini 2.5 Pro is the vision-pass fallback per architecture.md §1.
export const GEMINI_VISION_MODEL = 'gemini-2.5-pro';

// Gemini 2.5 Pro is also the Stage-4 beat-sheet fallback. Same snapshot — the
// JSON-schema constrained call uses no images, so the model choice is purely about
// text quality + structured-output reliability. Bump in lockstep with `GEMINI_VISION_MODEL`.
export const GEMINI_BEAT_SHEET_MODEL = 'gemini-2.5-pro';

let cachedClient: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to .env (see .env.example).');
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export type GeminiVisionInput = {
  prompt: string;
  photoUrls: string[];
  /** JSON Schema describing the structured output. */
  schema: object;
  timeoutMs: number;
  signal?: AbortSignal;
};

export type GeminiVisionOutput = {
  raw: Record<string, unknown>;
  visionFailure: boolean;
  model: string;
};

/**
 * Call Gemini 2.5 Pro with the pet's photos and a JSON-schema response constraint. We download
 * the photos server-side and inline them as base64 — Gemini's `inlineData` part — to avoid the
 * upstream-host availability issues that can plague Drive/Dropbox passthrough URLs (even
 * after we rehost to S3, an extra HTTP-fetch from Google's side adds a flake surface).
 */
export async function runGeminiVision(input: GeminiVisionInput): Promise<GeminiVisionOutput> {
  const client = getClient();

  const inlineParts = await Promise.all(input.photoUrls.map((url) => fetchAsInlinePart(url, input.signal)));

  try {
    const response = await client.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: input.prompt }, ...inlineParts],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: input.schema,
        abortSignal: input.signal,
        httpOptions: { timeout: input.timeoutMs },
        maxOutputTokens: 800,
      },
    });

    const text = response.text;
    if (!text) {
      throw new GeminiStatusError('empty response from gemini', 502);
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new GeminiStatusError('gemini returned non-JSON content', 502);
    }

    return {
      raw,
      visionFailure: raw.vision_failure === true,
      model: response.modelVersion ?? GEMINI_VISION_MODEL,
    };
  } catch (err) {
    if (err instanceof GeminiStatusError) throw err;
    if (isAbortError(err)) {
      throw new GeminiTransportError(err.message || 'aborted');
    }
    if (err instanceof Error) {
      const status = extractStatus(err);
      if (status != null) {
        throw new GeminiStatusError(err.message, status);
      }
      throw new GeminiTransportError(err.message);
    }
    throw new GeminiTransportError('unknown gemini error');
  }
}

async function fetchAsInlinePart(
  url: string,
  signal: AbortSignal | undefined,
): Promise<{ inlineData: { data: string; mimeType: string } }> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new GeminiStatusError(`failed to fetch photo ${url}: HTTP ${res.status}`, res.status);
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  return { inlineData: { data: buf.toString('base64'), mimeType } };
}

function extractStatus(err: Error): number | null {
  // The SDK throws ApiError instances that expose `.status` (string-ish "RESOURCE_EXHAUSTED")
  // or a numeric HTTP code on `code`. Be defensive — Google reshapes these between releases.
  const anyErr = err as unknown as { status?: unknown; code?: unknown };
  if (typeof anyErr.code === 'number') return anyErr.code;
  if (typeof anyErr.status === 'number') return anyErr.status;
  return null;
}

export class GeminiStatusError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiStatusError';
    this.status = status;
  }
}

export class GeminiTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTransportError';
  }
}

function isAbortError(err: unknown): err is Error {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

// ---------------------------------------------------------------------------
// Beat sheet — Gemini 2.5 Pro structured JSON (Phase 4a)
// ---------------------------------------------------------------------------

export type GeminiBeatSheetInput = {
  /** Final prompt text (after substitutions by the caller). */
  prompt: string;
  /** JSON Schema describing the structured output. */
  schema: object;
  /** Per-call timeout in ms. */
  timeoutMs: number;
  signal?: AbortSignal;
};

export type GeminiBeatSheetOutput = {
  /** Raw parsed JSON object. Caller validates / extracts `beats`. */
  raw: Record<string, unknown>;
  /** Model snapshot string echoed for `renders.model`. */
  model: string;
};

/**
 * Call Gemini 2.5 Pro with a prompt and JSON-schema response constraint. Pure-text pass —
 * no `inlineData` parts. Mirrors `runGeminiVision`'s error mapping so the hybrid policy
 * in `run-beat-sheet.ts` can route on `GeminiStatusError` / `GeminiTransportError`.
 */
export async function runGeminiBeatSheet(
  input: GeminiBeatSheetInput,
): Promise<GeminiBeatSheetOutput> {
  const client = getClient();

  try {
    const response = await client.models.generateContent({
      model: GEMINI_BEAT_SHEET_MODEL,
      contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: input.schema,
        abortSignal: input.signal,
        httpOptions: { timeout: input.timeoutMs },
        maxOutputTokens: 2400,
      },
    });

    const text = response.text;
    if (!text) {
      throw new GeminiStatusError('empty response from gemini beat-sheet', 502);
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new GeminiStatusError('gemini returned non-JSON content for beat-sheet', 502);
    }

    return {
      raw,
      model: response.modelVersion ?? GEMINI_BEAT_SHEET_MODEL,
    };
  } catch (err) {
    if (err instanceof GeminiStatusError) throw err;
    if (isAbortError(err)) {
      throw new GeminiTransportError(err.message || 'aborted');
    }
    if (err instanceof Error) {
      const anyErr = err as unknown as { status?: unknown; code?: unknown };
      const status =
        typeof anyErr.code === 'number'
          ? anyErr.code
          : typeof anyErr.status === 'number'
            ? anyErr.status
            : null;
      if (status != null) {
        throw new GeminiStatusError(err.message, status);
      }
      throw new GeminiTransportError(err.message);
    }
    throw new GeminiTransportError('unknown gemini error');
  }
}
