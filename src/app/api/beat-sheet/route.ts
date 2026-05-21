import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import { countWords } from '@/lib/builder/caption-validate';
import type { BeatWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * PATCH /api/beat-sheet
 *
 * Body: `BeatSheetUpdateRequest` — `{ session_id, beats }`. Whole-array replace
 * (the array is small; partial-update logic isn't worth the complexity).
 *
 * Validates: beats length matches sessions.beat_count, idxs are unique 0..N-1,
 * captions ≤ 15 words (soft — exceeds get truncated to 200-char hard cap, but
 * the client warns the user before they save).
 */
export async function PATCH(req: Request): Promise<Response> {
  let body: { session_id?: unknown; beats?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; beats?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  if (!Array.isArray(body.beats)) {
    return errJson('invalid-input', { status: 400, details: { field: 'beats' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const expectedCount = auth.session.beatCount;
  if (expectedCount !== 8 && expectedCount !== 12 && expectedCount !== 16) {
    return errJson('invalid-input', {
      status: 400,
      details: { message: 'session.beat_count is not 8/12/16; cannot validate beats array' },
    });
  }
  if (body.beats.length !== expectedCount) {
    return errJson('invalid-input', {
      status: 400,
      details: { expected: expectedCount, received: body.beats.length },
    });
  }

  // Per-beat shape + ordering validation.
  const beats: BeatWire[] = [];
  const seenIdx = new Set<number>();
  for (let i = 0; i < body.beats.length; i++) {
    const b = body.beats[i];
    if (typeof b !== 'object' || b === null) {
      return errJson('invalid-input', { status: 400, details: { beatIndex: i } });
    }
    const candidate = b as Record<string, unknown>;
    const idx = candidate.idx;
    const archetype = candidate.archetype;
    const scene_description = candidate.scene_description;
    const caption = candidate.caption;
    const notes = candidate.notes;
    if (
      typeof idx !== 'number' ||
      !Number.isInteger(idx) ||
      idx < 0 ||
      idx >= expectedCount ||
      seenIdx.has(idx)
    ) {
      return errJson('invalid-input', { status: 400, details: { beatIndex: i, field: 'idx' } });
    }
    seenIdx.add(idx);
    if (typeof archetype !== 'string' || archetype.length === 0) {
      return errJson('invalid-input', {
        status: 400,
        details: { beatIndex: i, field: 'archetype' },
      });
    }
    if (typeof scene_description !== 'string' || scene_description.length < 1) {
      return errJson('invalid-input', {
        status: 400,
        details: { beatIndex: i, field: 'scene_description' },
      });
    }
    if (typeof caption !== 'string') {
      return errJson('invalid-input', { status: 400, details: { beatIndex: i, field: 'caption' } });
    }
    // 200-char hard cap; soft ≤15-words constraint is the client's concern.
    const trimmedCaption = caption.length > 200 ? caption.slice(0, 200) : caption;
    if (notes !== undefined && typeof notes !== 'string') {
      return errJson('invalid-input', { status: 400, details: { beatIndex: i, field: 'notes' } });
    }
    beats.push({
      idx,
      archetype,
      scene_description,
      caption: trimmedCaption,
      ...(typeof notes === 'string' && notes.length > 0 ? { notes } : {}),
    });
    // Log soft-validation warning so QA can see how often the model / user
    // overruns the ≤15-words rule.
    if (countWords(trimmedCaption) > 15) {
      console.warn('[beat-sheet PATCH] caption exceeds 15 words', {
        sessionId,
        beatIdx: idx,
        wordCount: countWords(trimmedCaption),
      });
    }
  }

  // Sort by idx so storage order is canonical regardless of how the client posted.
  beats.sort((a, b) => a.idx - b.idx);

  const db = getDb();
  const updated = await db
    .update(sessions)
    .set({ beatSheet: beats, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (updated.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(updated[0]!) });
}
