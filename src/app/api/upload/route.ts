import { and, count, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { errJson, okJson } from '@/lib/api/respond';
import type { UploadResponse } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';
import { getPublicUrl, uploadObject } from '@/lib/storage/s3';
import { extensionForMime } from '@/lib/storage/ingest-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_SESSION = 10;
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

  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  if (!(file instanceof File)) {
    return errJson('invalid-input', { status: 400, details: { field: 'file' } });
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

  // B6: per-session photo cap. Client-side `MAX_FILES=10` is cosmetic — enforce here.
  const db = getDb();
  const existing = await db
    .select({ n: count() })
    .from(assets)
    .where(and(eq(assets.sessionId, sessionId), eq(assets.kind, 'pet_photo')));
  const existingCount = Number(existing[0]?.n ?? 0);
  if (existingCount >= MAX_PHOTOS_PER_SESSION) {
    return errJson('too-many-photos', {
      status: 413,
      details: { limit: MAX_PHOTOS_PER_SESSION, current: existingCount },
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
  });

  const body: Omit<Extract<UploadResponse, { ok: true }>, 'ok'> = {
    asset_id: assetId,
    public_url: publicUrl,
  };
  return okJson(body as unknown as Record<string, unknown>);
}
