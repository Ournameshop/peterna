import 'server-only';

// TODO(Phase 1): implement OpenAI client (GPT Image 2 + GPT-4o vision) per vendor-layer.md.
export function openaiVendorSentinel(): never {
  throw new Error('not implemented in Phase 0');
}
