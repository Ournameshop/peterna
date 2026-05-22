import { and, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { errJson, okJson } from '@/lib/api/respond';
import type { UploadResponse } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { isPhotoRole, type PhotoRole } from '@/lib/library/copy';
import { authBySession } from '@/lib/session/auth';
import { getPublicUrl, uploadObject } from '@/lib/storage/s3';
import { extensionForMime } from '@/lib/storage/ingest-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
// Phase 15a — per-role cap. Photos are now collected in three typed buckets
// (`character_reference`, `with_human`, `environment`); each role gets its own
// 10-photo budget, so a session can have up to 30 pet_photo assets in total.
const MAX_PHOTOS_PER_ROLE = 10;
// Default role for any pet_photo asset that lacks an explicit role on its
// metadata jsonb. Documented at the read site too (build-character-sheet
// caller in /api/character-sheet/render).
const DEFAULT_PHOTO_ROLE: PhotoRole = 'character_reference';
const ALLOWED_MIME_PREFIX = 'image/';

/**
 * POST /api/upload — multipart upload. Accepts a single `file` field plus `session_id`
 * (snake_case, per `wire-types.ts`).
 *
 * The cookie auth is the load-bearing check; the `session_id` form field exists so the route
 * can fail-fast on a mismatched form without doing a DB lookup. The DB row's `cookie_token`
 * still has to match the cookie payload (see `authBySession`).
 *
 * B6: per-session photo count cap. Before the S3 PUT, count existing `pet_photo` assets and
 * reject with 413 `too-many-photos` if at or over the limit.
 */
export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const file = form.get('file');
  const sessionId = form.get('session_id');
  const roleRaw = form.get('role');

  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  if (!(file instanceof File)) {
    return errJson('invalid-input', { status: 400, details: { field: 'file' } });
  }

  // Phase 15a — `role` is optional on the wire for backwards-compat. If the
  // client omits it we default to `character_reference`; otherwise it MUST be
  // one of the three legal values.
  let role: PhotoRole;
  if (roleRaw == null || roleRaw === '') {
    role = DEFAULT_PHOTO_ROLE;
  } else if (typeof roleRaw === 'string' && isPhotoRole(roleRaw)) {
    role = roleRaw;
  } else {
    return errJson('invalid-input', { status: 400, details: { field: 'role' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  // Bug-Smell-3 alignment: pre-strip charset so the suffix doesn't leak into
  // extensionForMime as `image/jpeg; charset=...`.
  const contentType = (file.type || '').split(';')[0]?.trim() ?? '';
  if (!contentType.startsWith(ALLOWED_MIME_PREFIX)) {
    return errJson('invalid-input', { status: 415, details: { contentType } });
  }
  if (file.size > MAX_BYTES) {
    return errJson('payload-too-large', { status: 413, details: { bytes: file.size } });
  }

  // Phase 15a — per-role photo cap. The cap is now scoped to the role being
  // uploaded so the three sub-stages can each accept up to 10 photos
  // independently. Existing pet_photo rows without an explicit
  // `metadata.photo_role` are treated as `character_reference` (the migration-free
  // backfill convention — see DEFAULT_PHOTO_ROLE above).
  const db = getDb();
  const existing = await db
    .select({ n: sql<number>`count(*)` })
    .from(assets)
    .where(
      and(
        eq(assets.sessionId, sessionId),
        eq(assets.kind, 'pet_photo'),
        role === DEFAULT_PHOTO_ROLE
          ? // For the default role, count rows that either explicitly match OR
            // have no role at all (legacy fallback).
            sql`(${assets.metadata}->>'photo_role' = ${role} OR ${assets.metadata}->>'photo_role' IS NULL)`
          : sql`${assets.metadata}->>'photo_role' = ${role}`,
      ),
    );
  const existingCount = Number(existing[0]?.n ?? 0);
  if (existingCount >= MAX_PHOTOS_PER_ROLE) {
    return errJson('too-many-photos', {
      status: 413,
      details: { limit: MAX_PHOTOS_PER_ROLE, current: existingCount, role },
    });
  }

  const assetId = uuidv7();
  const ext = extensionForMime(contentType);
  const s3Key = `sessions/${sessionId}/photos/${assetId}${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await uploadObject({ key: s3Key, body: buf, contentType });

  const publicUrl = getPublicUrl(s3Key);

  await db.insert(assets).values({
    id: assetId,
    sessionId,
    kind: 'pet_photo',
    source: 'upload',
    // DB column is `r2_key` (Drizzle binding `r2Key`) — kept for backward-compat
    // with the existing migration; values are S3 object keys.
    r2Key: s3Key,
    publicUrl,
    mimeType: contentType,
    bytes: buf.byteLength,
    // Phase 15a — stamp the typed role on every pet_photo asset. Read sites
    // (character-sheet render, video clip seed selection) filter on this field.
    metadata: { photo_role: role },
  });

  const body: Omit<Extract<UploadResponse, { ok: true }>, 'ok'> = {
    asset_id: assetId,
    public_url: publicUrl,
  };
  return okJson(body as unknown as Record<string, unknown>);
}
