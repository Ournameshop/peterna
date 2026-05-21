import { inArray } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  VideoClipStatus,
  VideoClipWire,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * GET /api/video/status?session_id=<id>
 *
 * Returns the live `clips` array (one entry per beat) and an `all_done`
 * flag the frontend uses to stop polling. Each clip carries:
 *   - status: 'queued' | 'rendering' | 'done' | 'failed'
 *   - asset_id + public_url (when status='done')
 *
 * The status array is written incrementally by `POST /api/video/render`
 * after every per-beat render, so a polling client sees the work advance.
 * No vendor work happens here — pure read.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = serializeSession(auth.session);

  const statuses = (session.video_clip_statuses ?? []) as VideoClipStatus[];
  const assetIds = (session.video_clip_asset_ids ?? []) as string[];
  const beatCount = Math.max(statuses.length, assetIds.length);

  if (beatCount === 0) {
    return okJson({ clips: [] as VideoClipWire[], all_done: false });
  }

  // Resolve public_url for any `done` clips that have an asset_id.
  const knownAssetIds = assetIds.filter((id, i) => Boolean(id) && statuses[i] === 'done');
  const urlByAssetId = new Map<string, string>();
  if (knownAssetIds.length > 0) {
    const db = getDb();
    const rows = await db
      .select({ id: assets.id, publicUrl: assets.publicUrl })
      .from(assets)
      .where(inArray(assets.id, knownAssetIds));
    for (const row of rows) urlByAssetId.set(row.id, row.publicUrl);
  }

  const clips: VideoClipWire[] = [];
  for (let i = 0; i < beatCount; i++) {
    const status = (statuses[i] ?? 'queued') as VideoClipStatus;
    const assetId = assetIds[i] || null;
    const publicUrl = assetId && status === 'done' ? urlByAssetId.get(assetId) ?? null : null;
    clips.push({
      beat_idx: i,
      status,
      asset_id: status === 'done' ? assetId : null,
      public_url: publicUrl,
    });
  }

  const allDone = clips.length > 0 && clips.every((c) => c.status === 'done');

  return okJson({ clips, all_done: allDone });
}

