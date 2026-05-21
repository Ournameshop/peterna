import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  AIError,
  type RunBeatSheetBeat,
  type RunBeatSheetInput,
  type RunBeatSheetResult,
  type VendorAttempt,
  type VendorTag,
} from './types';
import { logRender, startTimer } from './observability';
import {
  OPENAI_BEAT_SHEET_MODEL,
  OpenAIStatusError,
  OpenAITransportError,
  runOpenAIBeatSheet,
} from './vendors/openai';
import {
  GEMINI_BEAT_SHEET_MODEL,
  GeminiStatusError,
  GeminiTransportError,
  runGeminiBeatSheet,
} from './vendors/gemini';

// Hybrid policy timing per `vendor-layer.md` §"Hybrid policy" — same constants as `runVisionPass`.
const BEAT_SHEET_TIMEOUT_MS = 12_000;
const RETRY_BACKOFF_MS = 1_000;

/**
 * Single GPT-4o call. Cost estimate from `architecture.md`: structured-JSON pass with
 * ~1.5k input tokens + ~1.5k output tokens at GPT-4o pricing ≈ $0.01. Contributes to
 * the $10/session budget cap via `renders.cost_usd_est`.
 */
const ESTIMATED_BEAT_SHEET_COST_USD = 0.01;

type RawBeatSheetOutput = {
  raw: Record<string, unknown>;
  model: string;
};

/**
 * Stage-4 beat-sheet capability.
 *
 * Policy (mirrors `runVisionPass`):
 *  1. OpenAI primary with a 12s timeout.
 *  2. Retry once on 5xx / transport / timeout with 1s backoff.
 *  3. Fall to Gemini on 429 / 5xx / transport after retry. 4xx (content_policy /
 *     invalid_input) skip the fallback and propagate to the caller.
 *  4. Both fail → `AIError('both_vendors_failed')`.
 *
 * Writes exactly one row to `renders` (`stage='beat_sheet'`, `capability='run_beat_sheet'`)
 * with the served-vendor chain so QA can see fallbacks. The caller (route handler)
 * applies the result to `sessions.beat_sheet` and advances the stage.
 */
export async function runBeatSheet(input: RunBeatSheetInput): Promise<RunBeatSheetResult> {
  const attempts: VendorAttempt[] = [];
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  if (input.prompt.length === 0) {
    throw new AIError('beat-sheet called with an empty prompt', 'invalid_input', attempts);
  }

  const override = process.env.AI_VENDOR_OVERRIDE; // 'openai' | 'gemini' | undefined
  const order: VendorTag[] =
    override === 'gemini' ? ['gemini'] : override === 'openai' ? ['openai'] : ['openai', 'gemini'];

  const totalTimer = startTimer();
  let model: string | undefined;
  let lastError: Error | undefined;
  let result: RawBeatSheetOutput | undefined;
  let servedBy: VendorTag | undefined;

  for (const vendor of order) {
    try {
      const output = await callVendor(vendor, input, attempts);
      result = output;
      servedBy = vendor;
      model = output.model;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('unknown error');
      if (isContentPolicy(err) || isInvalidInput(err)) {
        throw new AIError(
          lastError.message,
          isContentPolicy(err) ? 'content_policy' : 'invalid_input',
          attempts,
        );
      }
      // otherwise fall through to the next vendor (if any)
    }
  }

  const durationMs = totalTimer();

  if (!result || !servedBy) {
    await logRender({
      sessionId: input.sessionId,
      stage: 'beat_sheet',
      capability: 'run_beat_sheet',
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

  const beats = normalizeBeats(result.raw, input.beatCount);

  await logRender({
    sessionId: input.sessionId,
    stage: 'beat_sheet',
    capability: 'run_beat_sheet',
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    vendorServed: servedBy,
    model,
    requestBody: { beat_count: input.beatCount, prompt_chars: input.prompt.length },
    costUsdEst: ESTIMATED_BEAT_SHEET_COST_USD,
    durationMs,
    idempotencyKey,
  });

  return {
    beats,
    vendorServed: servedBy,
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    durationMs,
  };
}

async function callVendor(
  vendor: VendorTag,
  input: RunBeatSheetInput,
  attempts: VendorAttempt[],
): Promise<RawBeatSheetOutput> {
  if (vendor === 'fal') {
    throw new AIError('fal.ai is not a beat-sheet vendor', 'invalid_input', attempts);
  }

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

  await sleep(RETRY_BACKOFF_MS);

  try {
    return await callOne(vendor, input);
  } catch (err) {
    const classified = classifyError(err);
    attempts.push({
      vendor,
      error: `${firstErr?.message} (retried; then: ${classified.message})`,
      status: classified.status,
    });
    throw err;
  }
}

async function callOne(
  vendor: 'openai' | 'gemini',
  input: RunBeatSheetInput,
): Promise<RawBeatSheetOutput> {
  if (vendor === 'openai') {
    return runOpenAIBeatSheet({
      prompt: input.prompt,
      schema: input.schema,
      timeoutMs: BEAT_SHEET_TIMEOUT_MS,
    });
  }
  return runGeminiBeatSheet({
    prompt: input.prompt,
    schema: input.schema,
    timeoutMs: BEAT_SHEET_TIMEOUT_MS,
  });
}

type Classified = {
  status?: number;
  message: string;
  kind: 'transport' | 'status' | 'unknown';
};

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
 * Validate the raw model output and project it into `BeatWire[]` shape. Both vendors
 * are constrained by JSON-schema strict mode, so this is defensive — if a future model
 * snapshot drifts, we surface the issue as `both_vendors_failed` rather than persisting
 * a malformed beat sheet.
 */
function normalizeBeats(
  raw: Record<string, unknown>,
  expectedCount: 8 | 12 | 16,
): RunBeatSheetBeat[] {
  const beatsRaw = raw.beats;
  if (!Array.isArray(beatsRaw)) {
    throw new AIError('beat-sheet response missing `beats` array', 'invalid_input', []);
  }

  const beats: RunBeatSheetBeat[] = [];
  for (const entry of beatsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const b = entry as Record<string, unknown>;
    const idx = typeof b.idx === 'number' ? b.idx : Number(b.idx);
    const archetype = typeof b.archetype === 'string' ? b.archetype.trim() : '';
    const scene = typeof b.scene_description === 'string' ? b.scene_description.trim() : '';
    const caption = typeof b.caption === 'string' ? b.caption.trim() : '';
    const notes = typeof b.notes === 'string' ? b.notes.trim() : undefined;
    if (!Number.isFinite(idx) || !archetype || !scene || !caption) continue;
    beats.push({
      idx: Math.trunc(idx),
      archetype,
      scene_description: scene,
      caption,
      ...(notes ? { notes } : {}),
    });
  }

  if (beats.length !== expectedCount) {
    throw new AIError(
      `beat-sheet returned ${beats.length} beats, expected ${expectedCount}`,
      'invalid_input',
      [],
    );
  }

  // Sort by idx defensively, in case the model returned out-of-order.
  beats.sort((a, b) => a.idx - b.idx);

  // Renumber to a strict 0..N-1 sequence — the spec is unambiguous about ordering and
  // a stray `idx: 99` from a hallucinated extra would break the storyboard pipeline.
  // The model is constrained by schema, but defense in depth is cheap.
  for (let i = 0; i < beats.length; i += 1) {
    beats[i].idx = i;
  }

  // Soft-constraint check: pet name should appear at most once across all captions.
  // Spec says backend doesn't reject — log a warning so QA can spot regression.
  // The actual name isn't available here; the caller (route handler) is in a better
  // position to enforce this if it ever escalates from soft to hard.

  return beats;
}

// Re-exported so tests / debug helpers can identify which model snapshot served them.
export { OPENAI_BEAT_SHEET_MODEL, GEMINI_BEAT_SHEET_MODEL };
