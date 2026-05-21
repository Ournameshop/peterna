import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SEPARATOR = '.';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set. Add it to .env (see .env.example).');
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Sign `payload` with SESSION_SECRET; result is `<payload>.<hex-sig>`. */
export function signToken(payload: string): string {
  const sig = sign(payload, getSecret());
  return `${payload}${SEPARATOR}${sig}`;
}

/** Verify a token signed by `signToken`; returns the payload on success, null on failure. */
export function verifyToken(token: string): string | null {
  const lastDot = token.lastIndexOf(SEPARATOR);
  if (lastDot <= 0 || lastDot === token.length - 1) return null;

  const payload = token.slice(0, lastDot);
  const provided = token.slice(lastDot + 1);
  const expected = sign(payload, getSecret());

  const providedBuf = Buffer.from(provided, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;
  return payload;
}

/** Generate a fresh 32-byte hex random token (used for cookie + resume tokens). */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
