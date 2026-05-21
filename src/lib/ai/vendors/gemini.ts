import 'server-only';

// TODO(Phase 1): implement Google Gemini 2.5 Pro client (vision fallback) per vendor-layer.md.
export function geminiVendorSentinel(): never {
  throw new Error('not implemented in Phase 0');
}
