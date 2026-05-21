import 'server-only';

import { AIError, type GenerateImageInput, type GenerateImageResult, type VendorAttempt } from './types';

// TODO(Phase 2): implement direct OpenAI GPT Image 2 primary + fal.ai fallback per vendor-layer.md.
export async function generateImage(_input: GenerateImageInput): Promise<GenerateImageResult> {
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
