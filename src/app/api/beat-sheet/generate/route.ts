import { eq } from 'drizzle-orm';

import { runBeatSheet } from '@/lib/ai/run-beat-sheet';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatSheetGenerateResponse,
  BeatWire,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { ART_STYLES, type ArtStyleId } from '@/lib/library/art-styles';
import { FORMATS, type FormatId } from '@/lib/library/formats';
import { THEMES, type ThemeId } from '@/lib/library/themes';
import { buildBeatSheetPrompt } from '@/lib/prompts/build-beat-sheet';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/beat-sheet/generate
 *
 * Body: `BeatSheetGenerateRequest`. Generates the N-beat arc (8/12/16) for the
 * locked format+theme+style+character. Persists `sessions.beat_sheet` and advances
 * stage to `beat_sheet_review`. Idempotent via `Idempotency-Key` header.
 *
 * Preconditions: `combination_preview_asset_id`, `format_id`, `theme_id`, `style_id`,
 * `beat_count`, `target_minutes` must all be set on the session — otherwise 400
 * `incomplete-stage-3`.
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

  // Preconditions — Stage 3 must be fully locked.
  const s = auth.session;
  const beatCount = s.beatCount;
  if (
    !s.combinationPreviewAssetId ||
    !s.formatId ||
    !s.themeId ||
    !s.styleId ||
    (beatCount !== 8 && beatCount !== 12 && beatCount !== 16)
  ) {
    return errJson('incomplete-stage-3', { status: 400 });
  }

  const format = FORMATS.find((f) => f.id === (s.formatId as FormatId));
  const theme = THEMES.find((t) => t.id === (s.themeId as ThemeId));
  const style = ART_STYLES.find((a) => a.id === (s.styleId as ArtStyleId));
  if (!format || !theme || !style) {
    return errJson('invalid-input', {
      status: 400,
      details: { format: !!format, theme: !!theme, style: !!style },
    });
  }

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('session-budget-exceeded', { status: 429 });
  }

  const budget = await checkSessionBudget(sessionId);
  if (!budget.ok) {
    slot.slot.releaseAndDontCount();
    return errJson('session-budget-exceeded', { status: 429 });
  }

  const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;

  let committed = false;
  try {
    const { prompt, schema } = buildBeatSheetPrompt({
      session: serializeSession(s),
      format,
      theme,
      style,
      beatCount,
    });

    let result;
    try {
      result = await runBeatSheet({
        prompt,
        schema,
        beatCount,
        sessionId,
        idempotencyKey,
      });
    } catch (err) {
      if (err instanceof AIError) {
        console.error('[beat-sheet/generate] AIError', {
          code: err.code,
          attempts: err.attempts,
        });
        slot.slot.commit();
        committed = true;
        if (err.code === 'content_policy') {
          return errJson('content-policy-violation', { status: 422 });
        }
        return errJson('render_failed', { status: 502 });
      }
      throw err;
    }

    // Persist beats and advance stage.
    const beats: BeatWire[] = result.beats.map((b) => ({
      idx: b.idx,
      archetype: b.archetype,
      scene_description: b.scene_description,
      caption: b.caption,
      ...(b.notes ? { notes: b.notes } : {}),
    }));

    const db = getDb();
    await db
      .update(sessions)
      .set({
        beatSheet: beats,
        stage: 'beat_sheet_review',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    const respBody: Extract<BeatSheetGenerateResponse, { ok: true }> = { ok: true, beats };
    return okJson({ beats: respBody.beats });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}
