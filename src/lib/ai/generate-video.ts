import 'server-only';

import { AIError, type GenerateVideoInput, type GenerateVideoResult, type VendorAttempt } from './types';

// TODO(Phase 4): implement fal.ai Seedance 2.0 sole-vendor path per vendor-layer.md (no direct ByteDance API).
export async function generateVideo(_input: GenerateVideoInput): Promise<GenerateVideoResult> {
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
