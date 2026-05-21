import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type { WordsUpdateRequest } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { findMusicTrack } from '@/lib/library/music-tracks';
import { findNarrationVoice } from '@/lib/library/narration-voices';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * PATCH /api/words
 *
 * Body: `WordsUpdateRequest` (snake_case). Persists the five Stage 5.5
 * session fields:
 *   - `opening_title_card_text` (≤ 80 chars)
 *   - `closing_card_text` (≤ 80 chars)
 *   - `music_track_id` (must exist in `MUSIC_TRACKS`)
 *   - `narration_voice_id` (must exist in `NARRATION_VOICES`)
 *   - `narration_text` (≤ 4000 chars)
 *
 * Captions per beat continue to live on `beat_sheet[].caption` and are
 * patched via /api/beat-sheet — this route deliberately does not touch
 * them.
 *
 * Field-level validation:
 *   - String length caps per the brief.
 *   - Explicit `null` is a valid value for any of the five fields (the
 *     client "clears" a previous choice by sending null).
 *   - Library IDs must round-trip through `findMusicTrack` /
 *     `findNarrationVoice` so the FE can't persist a stale or typo'd id.
 *
 * Auth: cookie. Cookie + body session_id must agree.
 *
 * Returns the updated SessionWire on success.
 */
export async function POST(): Promise<Response> {
  // Method-not-allowed: PATCH is the canonical verb for this resource.
  // Including POST here keeps `next dev` from 404-ing the file lookup
  // before the route's method-routing kicks in. We intentionally do not
  // expose POST publicly — the body shape is PATCH semantics.
  return errJson('invalid-input', { status: 405, details: { hint: 'use PATCH' } });
}

export async function PATCH(req: Request): Promise<Response> {
  let body: Partial<WordsUpdateRequest> & { session_id?: unknown };
  try {
    body = (await req.json()) as Partial<WordsUpdateRequest> & { session_id?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const issues = validateWords(body);
  if (issues.length > 0) {
    return errJson('invalid-input', { status: 400, details: { issues } });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('opening_title_card_text' in body) {
    update.openingTitleCardText = nullableTrim(body.opening_title_card_text ?? null);
  }
  if ('closing_card_text' in body) {
    update.closingCardText = nullableTrim(body.closing_card_text ?? null);
  }
  if ('music_track_id' in body) {
    update.musicTrackId = body.music_track_id ?? null;
  }
  if ('narration_voice_id' in body) {
    update.narrationVoiceId = body.narration_voice_id ?? null;
  }
  if ('narration_text' in body) {
    update.narrationText = nullableTrim(body.narration_text ?? null);
  }

  const db = getDb();
  const rows = await db
    .update(sessions)
    .set(update)
    .where(eq(sessions.id, sessionId))
    .returning();
  const updated = rows[0];
  if (!updated) return errJson('session-not-found', { status: 404 });

  return okJson({ session: serializeSession(updated) });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const OPENING_MAX = 80;
const CLOSING_MAX = 80;
const NARRATION_MAX = 4000;

type Issue = { field: string; message: string };

function validateWords(body: Partial<WordsUpdateRequest>): Issue[] {
  const issues: Issue[] = [];

  if ('opening_title_card_text' in body) {
    const v = body.opening_title_card_text;
    if (v !== null && v !== undefined) {
      if (typeof v !== 'string') {
        issues.push({ field: 'opening_title_card_text', message: 'expected string or null' });
      } else if (v.length > OPENING_MAX) {
        issues.push({
          field: 'opening_title_card_text',
          message: `must be <= ${OPENING_MAX} chars`,
        });
      }
    }
  }

  if ('closing_card_text' in body) {
    const v = body.closing_card_text;
    if (v !== null && v !== undefined) {
      if (typeof v !== 'string') {
        issues.push({ field: 'closing_card_text', message: 'expected string or null' });
      } else if (v.length > CLOSING_MAX) {
        issues.push({
          field: 'closing_card_text',
          message: `must be <= ${CLOSING_MAX} chars`,
        });
      }
    }
  }

  if ('music_track_id' in body) {
    const v = body.music_track_id;
    if (v !== null && v !== undefined) {
      if (typeof v !== 'string') {
        issues.push({ field: 'music_track_id', message: 'expected string or null' });
      } else if (!findMusicTrack(v)) {
        issues.push({ field: 'music_track_id', message: 'unknown music track id' });
      }
    }
  }

  if ('narration_voice_id' in body) {
    const v = body.narration_voice_id;
    if (v !== null && v !== undefined) {
      if (typeof v !== 'string') {
        issues.push({ field: 'narration_voice_id', message: 'expected string or null' });
      } else if (!findNarrationVoice(v)) {
        issues.push({ field: 'narration_voice_id', message: 'unknown narration voice id' });
      }
    }
  }

  if ('narration_text' in body) {
    const v = body.narration_text;
    if (v !== null && v !== undefined) {
      if (typeof v !== 'string') {
        issues.push({ field: 'narration_text', message: 'expected string or null' });
      } else if (v.length > NARRATION_MAX) {
        issues.push({
          field: 'narration_text',
          message: `must be <= ${NARRATION_MAX} chars`,
        });
      }
    }
  }

  return issues;
}

function nullableTrim(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
