import { and, eq, inArray } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import type { DeliveryArtifactsWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { isLikelyDeliverySlug } from '@/lib/delivery/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/delivery/[slug] (Phase 9 — Final Delivery, public read)
 *
 * No cookie required: the slug is the auth, same posture as the resume
 * tokens at `/api/session/resume/[token]`. If the slug doesn't resolve to
 * a session, we return 404 `not-found` rather than a richer error — we
 * don't want the endpoint to leak "this slug exists but you're not
 * authorized" because there is no other auth boundary here.
 *
 * Builds a `DeliveryArtifactsWire` by joining the locked asset rows for:
 *   - character_sheet
 *   - storyboard_frame (N rows, ordered by beat_idx via assets.metadata)
 *   - card_preview (3 rows: opening, closing, in_scene_caption)
 *   - final_video
 *   - eulogy_pdf
 *
 * Asset rows we can't find are simply omitted from the response (returned
 * as null / shorter arrays) — the delivery page degrades gracefully.
 */
export async function GET(_req: Request, ctx: RouteParams): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slug || !isLikelyDeliverySlug(slug)) {
    return errJson('not-found', { status: 404 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.deliveryShareSlug, slug))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return errJson('not-found', { status: 404 });
  }

  // Collect every asset id we want to resolve in one shot.
  const idsToFetch = new Set<string>();
  if (session.characterSheetAssetId) idsToFetch.add(session.characterSheetAssetId);
  if (session.assembledVideoAssetId) idsToFetch.add(session.assembledVideoAssetId);
  if (session.eulogyPdfAssetId) idsToFetch.add(session.eulogyPdfAssetId);
  for (const id of session.storyboardFrameAssetIds ?? []) {
    if (id) idsToFetch.add(id);
  }
  for (const id of session.cardPreviewAssetIds ?? []) {
    if (id) idsToFetch.add(id);
  }

  let urlByAssetId = new Map<string, string>();
  if (idsToFetch.size > 0) {
    const assetRows = await db
      .select({
        id: assets.id,
        publicUrl: assets.publicUrl,
        sessionId: assets.sessionId,
      })
      .from(assets)
      .where(and(inArray(assets.id, [...idsToFetch]), eq(assets.sessionId, session.id)));
    urlByAssetId = new Map(assetRows.map((r) => [r.id, r.publicUrl] as const));
  }

  const storyboardUrls: string[] = [];
  for (const id of session.storyboardFrameAssetIds ?? []) {
    const url = id ? urlByAssetId.get(id) : null;
    if (url) storyboardUrls.push(url);
  }
  const cardUrls: string[] = [];
  for (const id of session.cardPreviewAssetIds ?? []) {
    const url = id ? urlByAssetId.get(id) : null;
    if (url) cardUrls.push(url);
  }

  const artifacts: DeliveryArtifactsWire = {
    session_id: session.id,
    pet_name: session.petName ?? '',
    years_label: session.yearsLabel,
    character_sheet_url: session.characterSheetAssetId
      ? urlByAssetId.get(session.characterSheetAssetId) ?? null
      : null,
    storyboard_frame_urls: storyboardUrls,
    card_preview_urls: cardUrls,
    assembled_video_url: session.assembledVideoAssetId
      ? urlByAssetId.get(session.assembledVideoAssetId) ?? null
      : null,
    eulogy_pdf_url: session.eulogyPdfAssetId
      ? urlByAssetId.get(session.eulogyPdfAssetId) ?? null
      : null,
    opening_title_card_text: session.openingTitleCardText,
    closing_card_text: session.closingCardText,
    share_slug: session.deliveryShareSlug,
    ready_at:
      session.deliveryReadyAt instanceof Date
        ? session.deliveryReadyAt.toISOString()
        : session.deliveryReadyAt
          ? String(session.deliveryReadyAt)
          : null,
  };

  return okJson({ artifacts });
}
