import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';
import { ingestUrlToR2 } from '@/lib/storage/ingest-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_URLS = 10;

/**
 * POST /api/ingest-url
 *
 * Body: `{ sessionId: string, urls: string[] }`. For each URL: normalize (Drive viewer →
 * uc?export=download, Dropbox ?dl=0 → ?dl=1), HEAD-verify image/*, GET, rehost to R2, insert
 * one row in `assets`. Returns the resolved asset records and a parallel `failed[]` list per
 * URL so the UI can show which ones the user needs to retry.
 *
 * This route does its own per-URL try/catch — one bad link shouldn't blow up the whole batch.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { sessionId?: unknown; urls?: unknown };
  try {
    body = (await req.json()) as { sessionId?: unknown; urls?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const sessionId = body.sessionId;
  const urls = body.urls;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'sessionId' } });
  }
  if (!Array.isArray(urls) || urls.length === 0 || !urls.every((u) => typeof u === 'string')) {
    return errJson('invalid-input', { status: 400, details: { field: 'urls' } });
  }
  if (urls.length > MAX_URLS) {
    return errJson('payload-too-large', { status: 413, details: { count: urls.length, limit: MAX_URLS } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const db = getDb();

  const successes: Array<{ assetId: string; publicUrl: string }> = [];
  const failed: Array<{ url: string; reason: string }> = [];

  for (const url of urls as string[]) {
    const result = await ingestUrlToR2({ sessionId, url });
    if (!result.ok) {
      failed.push({ url, reason: result.error.code });
      continue;
    }
    await db.insert(assets).values({
      id: result.asset.assetUuid,
      sessionId,
      kind: 'pet_photo',
      source: 'url_ingest',
      r2Key: result.asset.r2Key,
      publicUrl: result.asset.publicUrl,
      mimeType: result.asset.mimeType,
      bytes: result.asset.bytes,
    });
    successes.push({ assetId: result.asset.assetUuid, publicUrl: result.asset.publicUrl });
  }

  return okJson({ assets: successes, failed });
}
