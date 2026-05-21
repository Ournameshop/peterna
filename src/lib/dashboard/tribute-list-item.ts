import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';

import type { StageTag } from '@/lib/builder/state';
import type { TributeListItem } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, type Session } from '@/lib/db/schema';
import { shareUrlForSlug } from '@/lib/delivery/slug';

/**
 * Build the `TributeListItem` view for one or many `sessions` rows.
 *
 * The dashboard list and the rename route both project the same shape, so the
 * URL-resolution logic lives in one place. We make a single batched asset
 * lookup for the whole input set rather than N round-trips.
 *
 * Thumbnail (`character_sheet_url`):
 *   - Prefer `sessions.character_sheet_asset_id` (the locked one from Stage 2).
 *   - Fall back to the most recent `assets` row of kind `character_sheet` for
 *     the session — handy for in-progress sessions that haven't approved yet.
 *
 * Video (`assembled_video_url`):
 *   - Strict FK lookup on `sessions.assembled_video_asset_id`. Null until
 *     Stage 7 completes.
 *
 * `share_url` is built from `PUBLIC_BASE_URL` only when a slug is set
 * (Phase 9 delivery finalize). Pre-finalize sessions return null.
 */
export async function buildTributeListItems(
  sessionRows: Session[],
): Promise<TributeListItem[]> {
  if (sessionRows.length === 0) return [];

  const db = getDb();
  const sessionIds = sessionRows.map((s) => s.id);

  // Collect every locked-asset id we want to resolve in one shot.
  const lockedAssetIds = new Set<string>();
  for (const s of sessionRows) {
    if (s.characterSheetAssetId) lockedAssetIds.add(s.characterSheetAssetId);
    if (s.assembledVideoAssetId) lockedAssetIds.add(s.assembledVideoAssetId);
  }

  const urlByAssetId = new Map<string, string>();
  if (lockedAssetIds.size > 0) {
    const assetRows = await db
      .select({ id: assets.id, publicUrl: assets.publicUrl })
      .from(assets)
      .where(inArray(assets.id, [...lockedAssetIds]));
    for (const r of assetRows) urlByAssetId.set(r.id, r.publicUrl);
  }

  // Fallback: latest `character_sheet` asset per session for rows without a
  // locked FK. Single query, then we pick the newest per session in JS.
  const sessionsMissingThumb = sessionRows
    .filter((s) => !s.characterSheetAssetId)
    .map((s) => s.id);

  const latestCharSheetBySession = new Map<string, string>();
  if (sessionsMissingThumb.length > 0) {
    const charSheetRows = await db
      .select({
        sessionId: assets.sessionId,
        publicUrl: assets.publicUrl,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(
        and(
          inArray(assets.sessionId, sessionsMissingThumb),
          eq(assets.kind, 'character_sheet'),
        ),
      )
      .orderBy(desc(assets.createdAt));
    // First hit per session wins because rows arrive newest-first.
    for (const r of charSheetRows) {
      if (!latestCharSheetBySession.has(r.sessionId)) {
        latestCharSheetBySession.set(r.sessionId, r.publicUrl);
      }
    }
  }

  void sessionIds; // referenced for clarity; lookups are by-session above

  return sessionRows.map((s) => toTributeListItem(s, urlByAssetId, latestCharSheetBySession));
}

/** Single-row variant — used by rename, which returns the freshly-updated row. */
export async function buildTributeListItem(session: Session): Promise<TributeListItem> {
  const [item] = await buildTributeListItems([session]);
  // buildTributeListItems with a length-1 input always returns length 1.
  return item!;
}

function toTributeListItem(
  s: Session,
  urlByAssetId: Map<string, string>,
  latestCharSheetBySession: Map<string, string>,
): TributeListItem {
  const characterSheetUrl =
    (s.characterSheetAssetId && urlByAssetId.get(s.characterSheetAssetId)) ||
    latestCharSheetBySession.get(s.id) ||
    null;

  const assembledVideoUrl = s.assembledVideoAssetId
    ? urlByAssetId.get(s.assembledVideoAssetId) ?? null
    : null;

  return {
    session_id: s.id,
    pet_name: s.petName,
    stage: s.stage as StageTag,
    created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    updated_at: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
    share_slug: s.deliveryShareSlug,
    share_url: s.deliveryShareSlug ? shareUrlForSlug(s.deliveryShareSlug) : null,
    character_sheet_url: characterSheetUrl,
    assembled_video_url: assembledVideoUrl,
    is_complete: s.deliveryReadyAt != null,
  };
}
