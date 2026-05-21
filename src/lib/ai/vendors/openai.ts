import 'server-only';

import OpenAI from 'openai';

// Model snapshot used for the vision pass. Pinned to a date-stamped GPT-4o so prompt-tuning
// stays reproducible; bump when we re-evaluate against a newer snapshot.
export const OPENAI_VISION_MODEL = 'gpt-4o-2024-11-20';

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
  /** Public R2 URLs of the user's pet photos. */
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
