import { v7 as uuidv7 } from 'uuid';

import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';
import { getPublicUrl, uploadObject } from '@/lib/storage/r2';
import { extensionForMime } from '@/lib/storage/ingest-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_PREFIX = 'image/';

/**
 * POST /api/upload — multipart upload. Accepts a single `file` field plus `sessionId`.
 *
 * The cookie auth is the load-bearing check; the `sessionId` form field exists so the route
 * can fail-fast on a mismatched form without doing a DB lookup. The DB row's `cookie_token`
 * still has to match the cookie payload (see `authBySession`).
 */
export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const file = form.get('file');
  const sessionId = form.get('sessionId');

  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'sessionId' } });
  }
  if (!(file instanceof File)) {
    return errJson('invalid-input', { status: 400, details: { field: 'file' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const contentType = (file.type || '').split(';')[0]?.trim() ?? '';
  if (!contentType.startsWith(ALLOWED_MIME_PREFIX)) {
    return errJson('invalid-input', { status: 415, details: { contentType } });
  }
  if (file.size > MAX_BYTES) {
    return errJson('payload-too-large', { status: 413, details: { bytes: file.size } });
  }

  const assetId = uuidv7();
  const ext = extensionForMime(contentType);
  const r2Key = `sessions/${sessionId}/photos/${assetId}${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await uploadObject({ key: r2Key, body: buf, contentType });

  const publicUrl = getPublicUrl(r2Key);

  const db = getDb();
  await db.insert(assets).values({
    id: assetId,
    sessionId,
    kind: 'pet_photo',
    source: 'upload',
    r2Key,
    publicUrl,
    mimeType: contentType,
    bytes: buf.byteLength,
  });

  return okJson({ assetId, publicUrl });
}
