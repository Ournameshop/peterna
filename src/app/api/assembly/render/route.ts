import { eq, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { errJson, okJson } from '@/lib/api/respond';
import { stitchTribute, type AssemblyAspect } from '@/lib/assembly/stitch';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  AssemblyRenderResponse,
  VideoClipStatus,
} from '@/lib/builder/wire-types';
import { findMusicTrack } from '@/lib/library/music-tracks';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { normalizeAspect } from '@/lib/prompts/build-preview';
import { authBySession } from '@/lib/session/auth';
import { acquireSessionSlot } from '@/lib/session/rate-limit';
import { getPublicUrl, uploadObject } from '@/lib/storage/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/assembly/render (Stage 7 — Assembly)
 *
 * Body: `AssemblyRenderRequest` — `{ session_id }`.
 *
 * Preconditions:
 *   - all video clips have status='done' AND a non-empty asset_id
 *   - session has format/theme/style/aspect set
 *
 * Process:
 *   1. Resolve every clip asset's S3 public URL; fetch the MP4 bytes.
 *   2. (Optional) fetch opening + closing card preview PNG bytes if those
 *      assets exist on the session.
 *   3. Pass the buffers + session's chosen music_track_id + aspect to
 *      `stitchTribute`, which orchestrates ffmpeg-static (concat clips,
 *      pad cards as 5s segments, mix music at -18dB if a track was chosen).
 *   4. Upload the resulting MP4 to S3 at `sessions/<id>/final/<uuid>.mp4`,
 *      insert an `assets` row `kind='final_video'`, persist
 *      `assembled_video_asset_id` on the session row.
 *   5. Advance `stage` to `assembly_review`.
 *
 * Cost: $0 vendor — ffmpeg runs locally. Wall-clock ~30–90s typical;
 * `maxDuration=300` covers a 16-beat tribute with music + cards.
 *
 * Music tracks: the spec library at `@/lib/library/music-tracks` enumerates
 * track ids and metadata. Phase 7 ships without a bundled audio asset
 * pipeline — when a real music asset url exists for the chosen track on
 * the session, we mix it in; otherwise we run with clip ambient audio only.
 * Narration mixing is a Phase 8+ concern and skipped here.
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

  const session = serializeSession(auth.session);

  const statuses = (session.video_clip_statuses ?? []) as VideoClipStatus[];
  const clipAssetIds = (session.video_clip_asset_ids ?? []) as string[];
  if (
    statuses.length === 0 ||
    statuses.length !== clipAssetIds.length ||
    statuses.some((s) => s !== 'done') ||
    clipAssetIds.some((id) => !id)
  ) {
    return errJson('incomplete-clips', {
      status: 400,
      details: { statuses, clip_count: clipAssetIds.length },
    });
  }

  const aspectRatio = session.aspect_ratio;
  if (!aspectRatio) {
    return errJson('invalid-input', { status: 400, details: { field: 'aspect_ratio' } });
  }
  const aspect = normalizeAspect(aspectRatio) as AssemblyAspect;

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('invalid-input', { status: 429, details: { reason: 'hourly-cap' } });
  }

  let committed = false;
  try {
    const db = getDb();

    // Resolve clip public URLs in one round-trip + verify ownership/kind.
    const clipRows = await db
      .select({
        id: assets.id,
        publicUrl: assets.publicUrl,
        kind: assets.kind,
        sessionId: assets.sessionId,
      })
      .from(assets)
      .where(inArray(assets.id, clipAssetIds));
    const urlByAssetId = new Map<string, string>();
    for (const row of clipRows) {
      if (row.sessionId !== sessionId) continue;
      if (row.kind !== 'video_clip') continue;
      urlByAssetId.set(row.id, row.publicUrl);
    }
    const clipUrls: string[] = [];
    for (let i = 0; i < clipAssetIds.length; i++) {
      const url = urlByAssetId.get(clipAssetIds[i]!);
      if (!url) {
        slot.slot.releaseAndDontCount();
        committed = true;
        return errJson('incomplete-clips', {
          status: 400,
          details: { reason: 'asset-not-found', beat_idx: i },
        });
      }
      clipUrls.push(url);
    }

    // Resolve optional card-preview PNG URLs.
    const cardAssetIds = (session.card_preview_asset_ids ?? []) as string[];
    let openingCardUrl: string | null = null;
    let closingCardUrl: string | null = null;
    if (cardAssetIds.length >= 2 && cardAssetIds[0] && cardAssetIds[1]) {
      const cardRows = await db
        .select({
          id: assets.id,
          publicUrl: assets.publicUrl,
          kind: assets.kind,
          sessionId: assets.sessionId,
        })
        .from(assets)
        .where(inArray(assets.id, [cardAssetIds[0]!, cardAssetIds[1]!]));
      for (const row of cardRows) {
        if (row.sessionId !== sessionId) continue;
        if (row.kind !== 'card_preview') continue;
        if (row.id === cardAssetIds[0]) openingCardUrl = row.publicUrl;
        if (row.id === cardAssetIds[1]) closingCardUrl = row.publicUrl;
      }
    }

    // Optional: music track. Phase 7 ships without a bundled music asset
    // catalog, so we resolve metadata from the library (validate the track
    // id is real) but only mix when an audio buffer is available. When the
    // track id is `silence` or unknown, we skip the music pass.
    const musicTrackId = session.music_track_id;
    const track = findMusicTrack(musicTrackId);
    const useMusic = Boolean(track && track.id !== 'silence');

    // Fetch all input buffers in parallel.
    const [clipBuffers, openingCardPng, closingCardPng] = await Promise.all([
      Promise.all(clipUrls.map(fetchAsBuffer)),
      openingCardUrl ? fetchAsBuffer(openingCardUrl) : Promise.resolve(null),
      closingCardUrl ? fetchAsBuffer(closingCardUrl) : Promise.resolve(null),
    ]);

    // Stitch.
    let assemblyOut;
    try {
      assemblyOut = await stitchTribute({
        clipBuffers,
        openingCardPng,
        closingCardPng,
        musicBuffer: null, // bundled-music pipeline lands in a later phase
        narrationBuffer: null,
        aspect,
      });
    } catch (err) {
      slot.slot.commit();
      committed = true;
      console.error('[assembly.render] ffmpeg stitch failed', {
        session_id: sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      const respBody: Extract<AssemblyRenderResponse, { ok: false }> = {
        ok: false,
        error: 'assembly_failed',
      };
      return Response.json(respBody, { status: 500 });
    }

    // Persist to S3 + assets + sessions.
    const finalUuid = uuidv7();
    const s3Key = `sessions/${sessionId}/final/${finalUuid}.mp4`;
    await uploadObject({
      key: s3Key,
      body: assemblyOut.bytes,
      contentType: assemblyOut.mimeType,
    });
    const publicUrl = getPublicUrl(s3Key);

    const finalAssetId = uuidv7();
    await db.insert(assets).values({
      id: finalAssetId,
      sessionId,
      kind: 'final_video',
      source: 'assembly',
      r2Key: s3Key,
      publicUrl,
      mimeType: 'video/mp4',
      bytes: assemblyOut.bytes.length,
      metadata: {
        aspect_ratio: aspect,
        clip_count: clipBuffers.length,
        has_opening_card: Boolean(openingCardPng),
        has_closing_card: Boolean(closingCardPng),
        music_track_id: useMusic ? track?.id ?? null : null,
        stitch_duration_ms: assemblyOut.durationMs,
      },
    });

    await db
      .update(sessions)
      .set({
        assembledVideoAssetId: finalAssetId,
        stage: 'assembly_review',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    return okJson({ asset_id: finalAssetId, public_url: publicUrl });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`fetch ${url} failed: HTTP ${resp.status}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}
