import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { getDb } from '@/lib/db/client';
import { magicLinkTokens, users, type User } from '@/lib/db/schema';

/**
 * Magic-link token lifecycle. The raw 32-byte hex token is only ever in:
 *   1. The outgoing email (in the link).
 *   2. The verifying request's URL (Phase 10 `/auth/callback?token=...`).
 *
 * The DB stores SHA-256(raw) only — a leaked DB row can't sign anyone in.
 * 30-minute expiry; single-use (`consumed_at` set on first use).
 */

const TOKEN_TTL_MS = 30 * 60 * 1000;
const RAW_TOKEN_BYTES = 32;

const EMAIL_NORMALIZE_RE = /\s+/g;

/** Lowercased + whitespace-trimmed email — used as the DB key + rate-limit key. */
export function normalizeEmail(value: string): string {
  return value.replace(EMAIL_NORMALIZE_RE, '').toLowerCase();
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export type GenerateMagicLinkTokenResult = {
  rawToken: string;
  tokenId: string;
};

/**
 * Mint a fresh token row for `email`. Caller is responsible for using
 * `rawToken` to compose the email link — it is NOT persisted anywhere; only
 * its SHA-256 hash hits the DB.
 *
 * No "invalidate prior tokens" sweep here — a user who clicks request twice
 * inside 30 minutes can still use either link. The rate limiter is the
 * abuse control, not token uniqueness.
 */
export async function generateMagicLinkToken(
  email: string,
): Promise<GenerateMagicLinkTokenResult> {
  const normalized = normalizeEmail(email);
  const rawToken = randomBytes(RAW_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const tokenId = uuidv7();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const db = getDb();
  await db.insert(magicLinkTokens).values({
    id: tokenId,
    email: normalized,
    tokenHash,
    expiresAt,
  });

  return { rawToken, tokenId };
}

export type ConsumeMagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'not-found' | 'consumed' | 'expired' };

/**
 * Look up by SHA-256(rawToken), verify not-consumed + not-expired, mark
 * consumed. Returns the email on success. All failure modes are
 * distinguished so the route can return a precise error envelope.
 *
 * The update statement uses `WHERE consumed_at IS NULL` as an
 * optimistic-lock guard — two concurrent consume requests can't both
 * succeed, even without an explicit transaction.
 */
export async function consumeMagicLinkToken(
  rawToken: string,
): Promise<ConsumeMagicLinkResult> {
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    return { ok: false, reason: 'not-found' };
  }
  const tokenHash = hashToken(rawToken);
  const db = getDb();

  const rows = await db
    .select()
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, reason: 'not-found' };

  if (row.consumedAt) return { ok: false, reason: 'consumed' };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' };

  // Atomic claim: only the first request through here flips consumed_at.
  const claimed = await db
    .update(magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(magicLinkTokens.id, row.id), isNull(magicLinkTokens.consumedAt)))
    .returning({ id: magicLinkTokens.id });
  if (claimed.length === 0) {
    // Another request beat us to it in the moments between SELECT and UPDATE.
    return { ok: false, reason: 'consumed' };
  }

  return { ok: true, email: row.email };
}

/**
 * Upsert by email. First-time signins set `email_verified_at = now()`; re-
 * verifications are idempotent (no-op on `email_verified_at` if already set).
 *
 * `name` is optional — Phase 10 frontend doesn't collect it yet, but the
 * column is there so a future "name your account" step can backfill it.
 */
export async function findOrCreateUser(
  email: string,
  name?: string | null,
): Promise<User> {
  const normalized = normalizeEmail(email);
  const db = getDb();

  const existingRows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  const existing = existingRows[0];

  if (existing) {
    if (existing.emailVerifiedAt) return existing;
    const updated = await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return updated[0] ?? existing;
  }

  const now = new Date();
  const inserted = await db
    .insert(users)
    .values({
      id: uuidv7(),
      email: normalized,
      name: name?.trim() || null,
      emailVerifiedAt: now,
    })
    .returning();
  // Postgres always returns the inserted row; the `?? throw` keeps TS narrow.
  const row = inserted[0];
  if (!row) {
    throw new Error('findOrCreateUser: insert returned no rows');
  }
  return row;
}
