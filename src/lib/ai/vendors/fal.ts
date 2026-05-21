import 'server-only';

// TODO(Phase 2/4): implement @fal-ai/client wrapper (gpt-image-2 + seedance-2.0) per vendor-layer.md.
export function falVendorSentinel(): never {
  throw new Error('not implemented in Phase 0');
}
