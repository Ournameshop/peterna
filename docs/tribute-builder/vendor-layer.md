# Vendor layer — hybrid AI abstraction

**Owner / agent type:** Backend (AI wiring).
**Prerequisites:** read `architecture.md` §1 (vendor matrix) first.

## Goal

Every model call goes through one typed function per capability in `src/lib/ai/`. Call sites never know which vendor served the request. The hybrid logic — try direct, catch, fall to fal.ai, surface a structured error if both fail — lives behind these functions.

## Directory layout

```
src/lib/ai/
  index.ts                 // re-exports the three capability functions
  types.ts                 // AIError, VendorTag, capability input/output types
  generate-image.ts        // capability: image gen (OpenAI primary → fal fallback)
  run-vision-pass.ts       // capability: vision JSON extraction (OpenAI primary → Gemini fallback)
  generate-video.ts        // capability: Seedance video (fal.ai sole vendor — no direct ByteDance API available) — Phase 4+
  vendors/
    openai.ts              // raw OpenAI client + GPT Image 2 + GPT-4o vision callers
    gemini.ts              // raw Google client + Gemini 2.5 vision caller
    fal.ts                 // @fal-ai/client wrapper for gpt-image-2 + seedance-2.0
  observability.ts         // logRender(), timer helper
```

## Capability interfaces (TypeScript sketch)

```ts
// types.ts
export type VendorTag = 'openai' | 'gemini' | 'fal';

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: 'rate_limited' | 'quota_exceeded' | 'transport' | 'content_policy' | 'invalid_input' | 'both_vendors_failed',
    public readonly attempts: Array<{ vendor: VendorTag; error: string; status?: number }>,
  ) { super(message); }
}

export type GenerateImageInput = {
  prompt: string;
  references?: Array<{ url: string; role?: 'subject' | 'style' }>;  // multi-image reference (likeness)
  size: '1024x1024' | '1024x1536' | '1536x1024' | '2048x2048';
  quality: 'low' | 'medium' | 'high';
  aspectRatio?: '1:1' | '9:16' | '16:9';
  sessionId: string;
  idempotencyKey: string;
  stage: 'character_sheet' | 'combination_preview' | 'storyboard' | 'card_preview';
};

export type GenerateImageResult = {
  url: string;              // R2-rehosted public URL (we re-upload vendor output)
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  costUsdEst: number;
  durationMs: number;
};

export type VisionPassInput = {
  photos: string[];         // public R2 URLs
  schema: object;           // JSON schema (pet_profile_schema from library)
  sessionId: string;
};

export type VisionPassResult = {
  profile: Record<string, unknown>;   // matches schema
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  vendorServed: VendorTag;
  vendorAttempted: VendorTag[];
  durationMs: number;
};
```

## Function signatures

```ts
// generate-image.ts
export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;

// run-vision-pass.ts
export async function runVisionPass(input: VisionPassInput): Promise<VisionPassResult>;

// generate-video.ts (Phase 4+)
export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoResult>;
```

## Hybrid policy

1. **Direct first.** Call primary vendor with a per-call timeout of 30s for image, 12s for vision, 180s for video.
2. **Retry primary once** on 5xx or network error (exponential backoff 1s → 3s). 4xx never retries.
3. **Fall to fallback** on: 429 rate-limit after retry, 5xx after retry, transport timeout, or `quota_exceeded`-class 4xx codes the vendor returns. Skip fallback on `content_policy` failures — the request would fail there too, and we want to surface the policy violation cleanly.
4. **Both fail → throw `AIError`** with `code: 'both_vendors_failed'` and the `attempts` array populated. Route handler maps to `{ ok: false, error: 'render_failed', attempts }` (don't leak vendor names to the client; do log them).
5. **Every call** writes a row to `renders` via `observability.ts::logRender({ sessionId, stage, vendorAttempted, vendorServed, costUsdEst, durationMs, error? })`. This is how QA and ops see fallback frequency.

## Env vars

| Var | Purpose | Required for phase |
|---|---|---|
| `OPENAI_API_KEY` | GPT Image 2 + GPT-4o vision | 1+ |
| `GEMINI_API_KEY` | Vision fallback | 1+ |
| `FAL_KEY` | Image fallback + sole video vendor | 1+ (image), 4+ (video) |
| `ELEVENLABS_API_KEY` | Narration TTS | 5+ |
| `AI_VENDOR_OVERRIDE` | Force a specific vendor (debug only — `openai` / `fal` / `gemini`) | dev |

Document these in `README.md` at repo root before Phase 1 PR.

## Observability hooks

- Each `renders` row carries `vendor_attempted text[]` and `vendor_served text`. Daily SQL: `SELECT vendor_served, count(*), sum(cost_usd_est) FROM renders GROUP BY 1` — that's the cost-attribution view.
- Fallback rate alarm: if `vendor_served='fal'` count exceeds 20% of image renders over a 1-hour rolling window, page Xee. Direct vendor degraded.
- Both-vendor-failure surfaces as a `renders.error` text and increments a Prometheus-style counter (or simple `console.error` with a tag in Phase 1; wire to AWS CloudWatch in Phase 2).

## Adding a new capability later

To add e.g. audio generation: create `src/lib/ai/generate-audio.ts` with `GenerateAudioInput`/`Result` types, add primary + fallback vendor modules under `vendors/`, re-export from `index.ts`. Route handlers import only the capability function. No call-site changes for existing capabilities.
