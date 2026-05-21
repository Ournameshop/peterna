export type VendorTag = 'openai' | 'gemini' | 'fal';

export type AIErrorCode =
  | 'rate_limited'
  | 'quota_exceeded'
  | 'transport'
  | 'content_policy'
  | 'invalid_input'
  | 'both_vendors_failed'
  | 'not_implemented';

export type VendorAttempt = {
  vendor: VendorTag;
  error: string;
  status?: number;
};

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly attempts: VendorAttempt[];

  constructor(message: string, code: AIErrorCode, attempts: VendorAttempt[] = []) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.attempts = attempts;
  }
}

export type ImageRenderStage =
  | 'character_sheet'
  | 'combination_preview'
  | 'storyboard'
  | 'card_preview';

export type GenerateImageInput = {
  prompt: string;
  references?: Array<{ url: string; role?: 'subject' | 'style' }>;
  size: '1024x1024' | '1024x1536' | '1536x1024' | '2048x2048';
  quality: 'low' | 'medium' | 'high';
  aspectRatio?: '1:1' | '9:16' | '16:9';
  sessionId: string;
  idempotencyKey: string;
  stage: ImageRenderStage;
};

export type GenerateImageResult = {
  url: string;
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  costUsdEst: number;
  durationMs: number;
};

export type VisionPassInput = {
  photos: string[];
  schema: object;
  sessionId: string;
  /**
   * Final prompt text with `[PET_NAME]` substituted. Composed by the route handler from
   * `VISION_PASS_PROMPT` in `@/lib/library/vision-pass`. Required — the vendor-layer no longer
   * embeds the template so the same caller can swap in stage-specific tweaks later without
   * touching this module.
   */
  prompt: string;
  /**
   * Optional `Idempotency-Key` header value (UUID, ideally v7) supplied by the route handler.
   * When present, this is the key the `renders` row is inserted with — so the DB's unique
   * index on `(session_id, stage, idempotency_key)` short-circuits duplicate vendor calls
   * inside the dedup window (Bug-5). When absent, a fresh UUID is generated.
   */
  idempotencyKey?: string;
};

export type VisionPassResult = {
  profile: Record<string, unknown>;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  durationMs: number;
};

export type GenerateVideoInput = {
  imageUrl: string;
  prompt: string;
  durationSeconds: 5 | 10 | 15;
  aspectRatio: '9:16' | '16:9' | '1:1';
  sessionId: string;
  idempotencyKey: string;
  stage: string;
};

export type GenerateVideoResult = {
  url: string;
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  costUsdEst: number;
  durationMs: number;
};

/**
 * Stage-4 beat-sheet capability — structured-JSON pass that produces the N-beat
 * outline of the tribute. No images; pure text. Mirrors `VisionPassInput` so
 * route handlers can share the prompt + schema construction pattern.
 */
export type RunBeatSheetInput = {
  /** Final prompt text composed by the caller (see `@/lib/prompts/build-beat-sheet`). */
  prompt: string;
  /** JSON schema (strict mode) describing the beat-sheet object the model must return. */
  schema: object;
  /** Number of beats expected (8 / 12 / 16). Logged for observability; not enforced here. */
  beatCount: 8 | 12 | 16;
  sessionId: string;
  /** Optional `Idempotency-Key` header value — used as the `renders.idempotency_key`. */
  idempotencyKey?: string;
};

/**
 * A beat as the vendor layer returns it. Mirrors `BeatWire` from
 * `@/lib/builder/wire-types` exactly; we keep the shape duplicated here so the
 * vendor layer doesn't pull in the wire-types module (which is intentionally
 * `'use client'`-safe and stays free of `server-only` deps).
 */
export type RunBeatSheetBeat = {
  idx: number;
  archetype: string;
  scene_description: string;
  caption: string;
  notes?: string;
};

export type RunBeatSheetResult = {
  beats: RunBeatSheetBeat[];
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  durationMs: number;
};
