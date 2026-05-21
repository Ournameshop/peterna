import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  AIError,
  type VendorAttempt,
  type VendorTag,
  type VisionPassInput,
  type VisionPassResult,
} from './types';
import { logRender, startTimer } from './observability';
import {
  OPENAI_VISION_MODEL,
  OpenAIStatusError,
  OpenAITransportError,
  runOpenAIVision,
} from './vendors/openai';
import {
  GEMINI_VISION_MODEL,
  GeminiStatusError,
  GeminiTransportError,
  runGeminiVision,
} from './vendors/gemini';

const VISION_TIMEOUT_MS = 12_000; // vendor-layer.md §"Hybrid policy" item 1
const RETRY_BACKOFF_MS = 1_000; // vendor-layer.md §"Hybrid policy" item 2
const ESTIMATED_VISION_COST_USD = 0.005; // architecture.md §1 — "~$0.005" per pass

type RawVisionOutput = {
  raw: Record<string, unknown>;
  visionFailure: boolean;
  model: string;
};

/**
 * Phase-1 implementation of the vision-pass capability.
 *
 * Policy (per `vendor-layer.md`):
 *  1. Call OpenAI primary with a 12s timeout.
 *  2. Retry once on 5xx / transport / timeout, 1s backoff.
 *  3. Fall to Gemini fallback on 429 / 5xx after retry, transport timeout, or quota_exceeded.
 *     4xx (content_policy, invalid_input) skip the fallback — surface cleanly to the caller.
 *  4. Both fail → throw AIError(both_vendors_failed).
 *
 * Every call writes a row to `renders` (one row per pass — primary + fallback collapse into a
 * single observed render record). `vendor_attempted` carries the chain so QA can see fallbacks.
 *
 * Spec escape hatch: if the chosen vendor emits `{ vision_failure: true }` the route handler
 * unpacks this and surfaces it to the UI; here we still treat it as a "success" — the model
 * answered, it just declined to commit to a profile.
 */
export async function runVisionPass(input: VisionPassInput): Promise<VisionPassResult> {
  const attempts: VendorAttempt[] = [];
  const idempotencyKey = randomUUID();

  // Stage 1.4 prompt is composed by the caller (see /api/vision-pass). `input.schema` is the
  // JSON schema both vendors structure-output against.
  if (input.prompt.length === 0) {
    throw new AIError('vision-pass called with an empty prompt', 'invalid_input', attempts);
  }
  const promptInput = input.prompt;

  const override = process.env.AI_VENDOR_OVERRIDE; // 'openai' | 'gemini' | undefined
  const order: VendorTag[] =
    override === 'gemini' ? ['gemini'] : override === 'openai' ? ['openai'] : ['openai', 'gemini'];

  const totalTimer = startTimer();
  let model: string | undefined;
  let lastError: Error | undefined;
  let result: RawVisionOutput | undefined;
  let servedBy: VendorTag | undefined;

  for (const vendor of order) {
    try {
      const output = await callVendor(vendor, input, promptInput, attempts);
      result = output;
      servedBy = vendor;
      model = output.model;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('unknown error');
      // `callVendor` already pushed the per-attempt rows into `attempts`. If the error is a
      // content_policy / invalid_input class, we don't fall through to the next vendor.
      if (isContentPolicy(err) || isInvalidInput(err)) {
        throw new AIError(lastError.message, isContentPolicy(err) ? 'content_policy' : 'invalid_input', attempts);
      }
      // otherwise loop to the next vendor (if any)
    }
  }

  const durationMs = totalTimer();

  if (!result || !servedBy) {
    // Persist a failed-render row so the cost-attribution view sees the attempt(s).
    await logRender({
      sessionId: input.sessionId,
      stage: 'vision_pass',
      capability: 'run_vision_pass',
      vendorAttempted: order,
      vendorServed: null,
      model,
      durationMs,
      idempotencyKey,
      error: lastError?.message ?? 'both vendors failed',
    });
    throw new AIError(
      lastError?.message ?? 'both vendors failed',
      'both_vendors_failed',
      attempts,
    );
  }

  // Pull profile + per-field confidence out of the flat shape the vendors return.
  const { profile, confidence } = normalizeVisionOutput(result);

  await logRender({
    sessionId: input.sessionId,
    stage: 'vision_pass',
    capability: 'run_vision_pass',
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    vendorServed: servedBy,
    model,
    requestBody: { photos: input.photos.length, vision_failure: result.visionFailure },
    costUsdEst: ESTIMATED_VISION_COST_USD,
    durationMs,
    idempotencyKey,
  });

  return {
    profile,
    confidence,
    vendorServed: servedBy,
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    durationMs,
  };
}

async function callVendor(
  vendor: VendorTag,
  input: VisionPassInput,
  prompt: string,
  attempts: VendorAttempt[],
): Promise<RawVisionOutput> {
  if (vendor === 'fal') {
    throw new AIError('fal.ai is not a vision-pass vendor', 'invalid_input', attempts);
  }

  // Primary call → retry once on 5xx/transport → throw classified error.
  let firstErr: { status?: number; message: string } | undefined;
  try {
    return await callOne(vendor, input, prompt);
  } catch (err) {
    const classified = classifyError(err);
    firstErr = classified;
    if (!shouldRetry(classified)) {
      attempts.push({ vendor, error: classified.message, status: classified.status });
      throw err;
    }
  }

  await sleep(RETRY_BACKOFF_MS);

  try {
    return await callOne(vendor, input, prompt);
  } catch (err) {
    const classified = classifyError(err);
    // Push both the first attempt and the retry — QA wants the full chain.
    attempts.push({ vendor, error: `${firstErr?.message} (retried; then: ${classified.message})`, status: classified.status });
    throw err;
  }
}

async function callOne(
  vendor: 'openai' | 'gemini',
  input: VisionPassInput,
  prompt: string,
): Promise<RawVisionOutput> {
  if (vendor === 'openai') {
    return runOpenAIVision({
      prompt,
      photoUrls: input.photos,
      schema: input.schema,
      timeoutMs: VISION_TIMEOUT_MS,
    });
  }
  return runGeminiVision({
    prompt,
    photoUrls: input.photos,
    schema: input.schema,
    timeoutMs: VISION_TIMEOUT_MS,
  });
}

type Classified = { status?: number; message: string; kind: 'transport' | 'status' | 'unknown' };

function classifyError(err: unknown): Classified {
  if (err instanceof OpenAIStatusError || err instanceof GeminiStatusError) {
    return { status: err.status, message: err.message, kind: 'status' };
  }
  if (err instanceof OpenAITransportError || err instanceof GeminiTransportError) {
    return { message: err.message, kind: 'transport' };
  }
  return { message: err instanceof Error ? err.message : 'unknown error', kind: 'unknown' };
}

function shouldRetry(c: Classified): boolean {
  if (c.kind === 'transport') return true;
  if (c.status != null && c.status >= 500) return true;
  return false;
}

function isContentPolicy(err: unknown): boolean {
  // OpenAI raises a 400 for content-policy violations; Gemini's safety filter throws a 400 too.
  // Heuristic: status 400 + a content-policy-shaped message. Conservative — we'd rather try
  // the fallback than swallow a transient error as a policy violation.
  if (err instanceof OpenAIStatusError || err instanceof GeminiStatusError) {
    if (err.status === 400 && /content.policy|safety|moderation/i.test(err.message)) return true;
  }
  return false;
}

function isInvalidInput(err: unknown): boolean {
  if (err instanceof OpenAIStatusError || err instanceof GeminiStatusError) {
    if (err.status === 400 && !isContentPolicy(err)) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map the model's flat output (one field + one `<field>_confidence`) into the two-object shape
 * the route handler / DB / UI all read against.
 */
function normalizeVisionOutput(out: RawVisionOutput): {
  profile: Record<string, unknown>;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
} {
  if (out.visionFailure) {
    return { profile: { vision_failure: true }, confidence: {} };
  }

  const raw = out.raw;
  const profile: Record<string, unknown> = {};
  const confidence: Record<string, 'high' | 'medium' | 'low'> = {};

  for (const baseField of [
    'species',
    'breed_guess',
    'coat_description',
    'age_range',
    'body_type',
    'observed_setting',
    'observed_moment',
  ]) {
    const value = raw[baseField];
    if (value != null) profile[baseField] = value;
    const confKey = confidenceKeyFor(baseField);
    const conf = raw[confKey];
    if (conf === 'high' || conf === 'medium' || conf === 'low') {
      confidence[baseField] = conf;
    }
  }
  return { profile, confidence };
}

function confidenceKeyFor(field: string): string {
  switch (field) {
    case 'species':
      return 'species_confidence';
    case 'breed_guess':
      return 'breed_confidence';
    case 'coat_description':
      return 'coat_confidence';
    case 'age_range':
      return 'age_confidence';
    case 'body_type':
      return 'body_confidence';
    case 'observed_setting':
      return 'setting_confidence';
    case 'observed_moment':
      return 'moment_confidence';
    default:
      return `${field}_confidence`;
  }
}

// Re-exported so tests / debug helpers can identify which model snapshot served them.
export { OPENAI_VISION_MODEL, GEMINI_VISION_MODEL };
