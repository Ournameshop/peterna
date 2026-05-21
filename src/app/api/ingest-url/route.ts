import { and, count, eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import type {
  IngestUrlAsset,
  IngestUrlFailure,
  IngestUrlResponse,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';
import { ingestUrlToS3 } from '@/lib/storage/ingest-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_URLS = 10;
const MAX_PHOTOS_PER_SESSION = 10;

/**
 * POST /api/ingest-url
 *
 * Body: `{ session_id: string, urls: string[] }` (snake_case wire). For each URL: normalize
 * (Drive viewer → uc?export=download, Dropbox ?dl=0 → ?dl=1), HEAD-verify image/*, GET,
 * rehost to S3, insert one row in `assets`. Returns the resolved asset records and a
 * parallel `failed[]` list per URL so the UI can show which ones the user needs to retry.
 *
 * This route does its own per-URL try/catch — one bad link shouldn't blow up the whole batch.
 *
 * B6: per-session photo cap. We re-check the count after each successful insert and stop
 * accepting more URLs (marking the rest as failed with reason `too_many_photos`) so storage
 * runaway across multiple ingest calls is bounded.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; urls?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; urls?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const sessionId = body.session_id;
  const urls = body.urls;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
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

  // B6: per-session photo cap. Treat the cap as a running counter so each successful insert
  // costs one slot of the remaining budget. URLs over the budget land in `failed[]`.
  const existing = await db
    .select({ n: count() })
    .from(assets)
    .where(and(eq(assets.sessionId, sessionId), eq(assets.kind, 'pet_photo')));
  let remainingBudget = MAX_PHOTOS_PER_SESSION - Number(existing[0]?.n ?? 0);

  const successes: IngestUrlAsset[] = [];
  const failed: IngestUrlFailure[] = [];

  for (const url of urls as string[]) {
    if (remainingBudget <= 0) {
      failed.push({ url, reason: 'too_many_photos' });
      continue;
    }
    const result = await ingestUrlToS3({ sessionId, url });
    if (!result.ok) {
      failed.push({ url, reason: result.error.code });
      continue;
    }
    await db.insert(assets).values({
      id: result.asset.assetUuid,
      sessionId,
      kind: 'pet_photo',
      source: 'url_ingest',
      // DB column is `r2_key` (Drizzle binding `r2Key`) — kept for backward-compat
      // with the existing migration; values are S3 object keys.
      r2Key: result.asset.s3Key,
      publicUrl: result.asset.publicUrl,
      mimeType: result.asset.mimeType,
      bytes: result.asset.bytes,
    });
    successes.push({ asset_id: result.asset.assetUuid, public_url: result.asset.publicUrl });
    remainingBudget -= 1;
  }

  const responseBody: Omit<Extract<IngestUrlResponse, { ok: true }>, 'ok'> = {
    assets: successes,
    failed,
  };
  return okJson(responseBody as unknown as Record<string, unknown>);
}
