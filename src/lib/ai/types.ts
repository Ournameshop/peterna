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
