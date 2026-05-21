import 'server-only';

import { AIError, type VendorAttempt, type VisionPassInput, type VisionPassResult } from './types';

// TODO(Phase 1): implement direct OpenAI GPT-4o primary + Gemini 2.5 Pro fallback per vendor-layer.md.
export async function runVisionPass(_input: VisionPassInput): Promise<VisionPassResult> {
  const attempts: VendorAttempt[] = [];
  try {
    throw new AIError('not implemented in Phase 0', 'not_implemented');
  } catch (err) {
    if (err instanceof AIError) throw err;
    throw new AIError(
      err instanceof Error ? err.message : 'unknown error',
      'both_vendors_failed',
      attempts,
    );
  }
}
