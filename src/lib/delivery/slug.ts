import 'server-only';

import { randomBytes } from 'node:crypto';

/**
 * Crockford-style base32 alphabet (no `I`, `L`, `O`, `U` — avoids visual
 * collisions and accidental profanity). URL-safe with no padding.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate an unguessable, URL-safe slug for a delivery URL.
 *
 * 10 chars from a 32-symbol alphabet ≈ 50 bits of entropy, comfortably
 * inside the "slug-is-the-auth" trust model (same posture as the resume
 * tokens). Wrapping in `randomBytes` lets us scale length by changing one
 * constant.
 */
export function generateDeliverySlug(length = 10): string {
  if (length < 8 || length > 12) {
    throw new Error(`delivery slug length must be 8..12, got ${length}`);
  }
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

const SLUG_RE = /^[0-9A-HJ-NP-TV-Z]{8,12}$/;

/** Cheap shape check for incoming slug params before we hit the DB. */
export function isLikelyDeliverySlug(value: string): boolean {
  return SLUG_RE.test(value);
}

/**
 * Resolve the public base URL for share links. Production wires this via
 * `PUBLIC_BASE_URL`; dev falls back to localhost so unset env doesn't
 * brick the route.
 */
export function publicBaseUrl(): string {
  const raw = process.env.PUBLIC_BASE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

/** Build the full share URL for a given slug. */
export function shareUrlForSlug(slug: string): string {
  return `${publicBaseUrl()}/tribute/${slug}`;
}
