import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { DEFAULT_WORDS } from '@/lib/library/defaults';
import { findFormat } from '@/lib/library/formats';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/words/approve
 *
 * Body: `WordsApproveRequest` — `{ session_id }`. Locks the Stage 5.5
 * Words and advances stage to `card_preview_render`.
 *
 * Default-copy fallback (spec line 1035, task brief):
 *   - If `opening_title_card_text` is null on the session: default to
 *     `[pet_name] — [format.secondary]`. We use the format's subtitle as
 *     the "opening archetype" because the spec's title-card auto-rule
 *     (line 101) reads `"[PET_NAME]" — "[FORMAT_SUBTITLE]"`.
 *   - If `closing_card_text` is null on the session: default to
 *     `DEFAULT_WORDS.closing` ("With love, always").
 *
 * The defaults are WRITTEN to the session row when applied — this means
 * downstream stages (card-preview render, Stage 7 assembly) never need to
 * re-derive them. The user can still PATCH them away later if they jump
 * back to Stage 5.5.
 *
 * Returns the updated SessionWire.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = auth.session;

  // Compute fallbacks. We write them through so the row reflects the locked
  // state — no implicit defaults at later stages.
  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    stage: 'card_preview_render',
  };

  if (!session.openingTitleCardText) {
    const petName = (session.petName ?? '').trim();
    const format = findFormat(session.formatId);
    // Format.secondary is the picker subtitle — the closest analog the
    // library exposes to the spec's [FORMAT_SUBTITLE] placeholder. If the
    // format is somehow unknown (e.g. a stale id), fall back to pet name
    // alone — a one-line title card is still legible.
    const subtitle = format?.secondary?.trim() ?? '';
    const opening = subtitle
      ? `${petName || 'A tribute'} — ${subtitle}`
      : (petName || 'A tribute');
    update.openingTitleCardText = opening;
  }

  if (!session.closingCardText) {
    update.closingCardText = DEFAULT_WORDS.closing;
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
