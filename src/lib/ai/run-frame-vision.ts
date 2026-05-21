import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  AIError,
  type VendorAttempt,
  type VendorTag,
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

// Per spec §"v2.0 changes — Dynamic Cinematography Engine", Part 1 is a
// multimodal pass on a SINGLE storyboard frame producing a structured vision
// readout. Same hybrid policy as `runVisionPass`: OpenAI primary → retry on
// 5xx/transport → Gemini fallback → throw both_vendors_failed.
const FRAME_VISION_TIMEOUT_MS = 8_000; // spec: 8s per frame so N=8 finishes in <maxDuration=90.
const RETRY_BACKOFF_MS = 1_000;
const ESTIMATED_FRAME_VISION_COST_USD = 0.005; // architecture.md §1 — same ballpark as Stage 1 vision.

/** All possible frame-vision field values, kept in sync with `FrameVisionWire`. */
const SUBJECT_ENERGY = ['still', 'low', 'medium', 'high'] as const;
const SUBJECT_POSE = [
  'lying',
  'sitting',
  'standing',
  'walking',
  'running',
  'mid_leap',
  'closed_eyes',
] as const;
const FRAMING = ['extreme_close', 'close', 'medium', 'wide', 'extreme_wide'] as const;
const ENVIRONMENTAL_MOTION = [
  'still',
  'wind',
  'water',
  'particles',
  'sky',
  'dappled_light',
] as const;
const DEPTH_LAYERS = [1, 2, 3] as const;
const PALETTE_TEMP = ['warm', 'neutral', 'cool'] as const;

/**
 * JSON-Schema (strict) for the per-frame vision pass. Mirrors the
 * `FrameVisionWire` payload defined in `@/lib/builder/wire-types`. The model
 * never produces `beat_idx` — that is appended by the caller after the call
 * returns, because the model has no context of which frame index it is
 * looking at.
 */
export const FRAME_VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'subject_energy',
    'subject_pose',
    'framing',
    'environmental_motion',
    'depth_layers',
    'dominant_palette_temperature',
  ],
  properties: {
    subject_energy: { type: 'string', enum: [...SUBJECT_ENERGY] },
    subject_pose: { type: 'string', enum: [...SUBJECT_POSE] },
    framing: { type: 'string', enum: [...FRAMING] },
    environmental_motion: { type: 'string', enum: [...ENVIRONMENTAL_MOTION] },
    depth_layers: { type: 'integer', enum: [...DEPTH_LAYERS] },
    dominant_palette_temperature: { type: 'string', enum: [...PALETTE_TEMP] },
  },
} as const;

/**
 * Prompt template for the frame vision pass. The model is shown exactly one
 * storyboard frame and asked to extract six structured fields per the spec.
 * No prose, no judgement, no emotional state inference — only observed motion
 * and geometry. The spec's Part 1 list maps directly to these fields.
 */
export const FRAME_VISION_PROMPT = `You are analyzing one storyboard frame from a pet memorial tribute.
Return ONLY a JSON object matching this schema:

{
  "subject_energy": "still|low|medium|high",
  "subject_pose": "lying|sitting|standing|walking|running|mid_leap|closed_eyes",
  "framing": "extreme_close|close|medium|wide|extreme_wide",
  "environmental_motion": "still|wind|water|particles|sky|dappled_light",
  "depth_layers": 1|2|3,
  "dominant_palette_temperature": "warm|neutral|cool"
}

Rules:
- subject_energy is the implied kinetic state of the pet (a sleeping pet is "still"; a mid-jump pet is "high").
- subject_pose is the body position; pick "closed_eyes" only if the eyes are clearly closed (sleeping/resting).
- framing is how much of the pet fills the frame ("extreme_close" = a single feature; "extreme_wide" = the pet is small in a landscape).
- environmental_motion is anything in the environment that suggests movement (leaves blowing, water rippling, particles in the air).
- depth_layers is a count of distinct depth planes — 1 (flat), 2 (subject + background), or 3 (foreground + subject + background).
- dominant_palette_temperature is the overall colour cast.

Output the JSON only. No prose.` as const;

export type RunFrameVisionInput = {
  /** Public asset URL of the storyboard frame to analyze. */
  frameUrl: string;
  /** Zero-based beat index — copied onto the result. Not sent to the vendor. */
  beatIdx: number;
  sessionId: string;
  /** Optional Idempotency-Key from the caller — propagated to the renders row. */
  idempotencyKey?: string;
};

/** Frame-vision result. Beat-indexed, ready to persist as part of an array. */
export type RunFrameVisionResult = {
  beatIdx: number;
  subjectEnergy: (typeof SUBJECT_ENERGY)[number];
  subjectPose: (typeof SUBJECT_POSE)[number];
  framing: (typeof FRAMING)[number];
  environmentalMotion: (typeof ENVIRONMENTAL_MOTION)[number];
  depthLayers: (typeof DEPTH_LAYERS)[number];
  dominantPaletteTemperature: (typeof PALETTE_TEMP)[number];
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  durationMs: number;
};

type RawFrameVisionOutput = {
  raw: Record<string, unknown>;
  model: string;
};

/**
 * Phase-6 Part 1: per-frame structured vision pass.
 *
 * Wraps `runOpenAIVision` with the frame-vision schema and applies the same
 * hybrid policy `runVisionPass` uses (primary OpenAI → retry → Gemini
 * fallback → both_vendors_failed). One row per frame is inserted into
 * `renders` so cost attribution is per-beat.
 */
export async function runFrameVision(
  input: RunFrameVisionInput,
): Promise<RunFrameVisionResult> {
  const attempts: VendorAttempt[] = [];
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  if (!input.frameUrl) {
    throw new AIError('frame-vision called with empty frame URL', 'invalid_input', attempts);
  }

  const override = process.env.AI_VENDOR_OVERRIDE; // 'openai' | 'gemini' | undefined
  const order: VendorTag[] =
    override === 'gemini' ? ['gemini'] : override === 'openai' ? ['openai'] : ['openai', 'gemini'];

  const totalTimer = startTimer();
  let model: string | undefined;
  let lastError: Error | undefined;
  let result: RawFrameVisionOutput | undefined;
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
      // otherwise fall through to the next vendor
    }
  }

  const durationMs = totalTimer();

  if (!result || !servedBy) {
    await logRender({
      sessionId: input.sessionId,
      stage: 'cinematography_frame_vision',
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

  const parsed = normalizeFrameVision(result.raw, input.beatIdx);

  await logRender({
    sessionId: input.sessionId,
    stage: 'cinematography_frame_vision',
    capability: 'run_vision_pass',
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    vendorServed: servedBy,
    model,
    requestBody: { beat_idx: input.beatIdx },
    costUsdEst: ESTIMATED_FRAME_VISION_COST_USD,
    durationMs,
    idempotencyKey,
  });

  return {
    ...parsed,
    vendorServed: servedBy,
    vendorAttempted: order.slice(0, order.indexOf(servedBy) + 1),
    durationMs,
  };
}

async function callVendor(
  vendor: VendorTag,
  input: RunFrameVisionInput,
  attempts: VendorAttempt[],
): Promise<RawFrameVisionOutput> {
  if (vendor === 'fal') {
    throw new AIError('fal.ai is not a vision-pass vendor', 'invalid_input', attempts);
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
  input: RunFrameVisionInput,
): Promise<RawFrameVisionOutput> {
  if (vendor === 'openai') {
    const out = await runOpenAIVision({
      prompt: FRAME_VISION_PROMPT,
      photoUrls: [input.frameUrl],
      schema: FRAME_VISION_SCHEMA,
      timeoutMs: FRAME_VISION_TIMEOUT_MS,
    });
    return { raw: out.raw, model: out.model };
  }
  const out = await runGeminiVision({
    prompt: FRAME_VISION_PROMPT,
    photoUrls: [input.frameUrl],
    schema: FRAME_VISION_SCHEMA,
    timeoutMs: FRAME_VISION_TIMEOUT_MS,
  });
  return { raw: out.raw, model: out.model };
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
 * Validate + project the model's flat output into the result shape. Schema
 * strict mode should prevent most drift; this is defense in depth — bad data
 * is rejected as `invalid_input` rather than silently coerced.
 */
function normalizeFrameVision(
  raw: Record<string, unknown>,
  beatIdx: number,
): Omit<RunFrameVisionResult, 'vendorServed' | 'vendorAttempted' | 'durationMs'> {
  const subjectEnergy = raw.subject_energy;
  const subjectPose = raw.subject_pose;
  const framing = raw.framing;
  const environmentalMotion = raw.environmental_motion;
  const depthLayersRaw = raw.depth_layers;
  const palette = raw.dominant_palette_temperature;

  if (
    typeof subjectEnergy !== 'string' ||
    !(SUBJECT_ENERGY as readonly string[]).includes(subjectEnergy) ||
    typeof subjectPose !== 'string' ||
    !(SUBJECT_POSE as readonly string[]).includes(subjectPose) ||
    typeof framing !== 'string' ||
    !(FRAMING as readonly string[]).includes(framing) ||
    typeof environmentalMotion !== 'string' ||
    !(ENVIRONMENTAL_MOTION as readonly string[]).includes(environmentalMotion) ||
    typeof palette !== 'string' ||
    !(PALETTE_TEMP as readonly string[]).includes(palette)
  ) {
    throw new AIError('frame-vision returned unrecognized enum value', 'invalid_input', []);
  }

  const depthLayers = typeof depthLayersRaw === 'number' ? Math.trunc(depthLayersRaw) : NaN;
  if (depthLayers !== 1 && depthLayers !== 2 && depthLayers !== 3) {
    throw new AIError('frame-vision returned bad depth_layers', 'invalid_input', []);
  }

  return {
    beatIdx,
    subjectEnergy: subjectEnergy as RunFrameVisionResult['subjectEnergy'],
    subjectPose: subjectPose as RunFrameVisionResult['subjectPose'],
    framing: framing as RunFrameVisionResult['framing'],
    environmentalMotion: environmentalMotion as RunFrameVisionResult['environmentalMotion'],
    depthLayers: depthLayers as RunFrameVisionResult['depthLayers'],
    dominantPaletteTemperature: palette as RunFrameVisionResult['dominantPaletteTemperature'],
  };
}

export { OPENAI_VISION_MODEL, GEMINI_VISION_MODEL };
