import 'server-only';

import { v7 as uuidv7 } from 'uuid';

import { getPublicUrl, uploadObject } from './s3';

/**
 * Normalize Drive / Dropbox share URLs to their direct-download form, per
 * `architecture.md` §"URL ingestion." Anything that isn't a Drive or Dropbox URL is returned
 * unchanged.
 */
export function normalizeIngestUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }

  // Google Drive: /file/d/<id>/view → uc?export=download&id=<id>
  if (/(?:^|\.)drive\.google\.com$/i.test(url.hostname)) {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }

  // Dropbox: ?dl=0 → ?dl=1 (also handles dl.dropboxusercontent.com passthrough)
  if (/(?:^|\.)dropbox\.com$/i.test(url.hostname)) {
    url.searchParams.set('dl', '1');
    return url.toString();
  }

  return input;
}

const ALLOWED_MIME_PREFIX = 'image/';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, mirrors the upload cap in api-routes.md
const FETCH_TIMEOUT_MS = 15_000;

export type IngestedAsset = {
  assetUuid: string;
  s3Key: string;
  publicUrl: string;
  bytes: number;
  mimeType: string;
};

export type IngestUrlError =
  | { code: 'invalid_url' }
  | { code: 'not_image'; contentType: string | null }
  | { code: 'too_large'; bytes: number }
  | { code: 'fetch_failed'; status?: number; message: string };

export type IngestResult =
  | { ok: true; asset: IngestedAsset }
  | { ok: false; error: IngestUrlError };

/**
 * Take a user-supplied URL, normalize it, HEAD-check that it's an image, fetch it
 * server-side, and re-host to S3 under `sessions/<sessionId>/photos/<uuid>.<ext>`. Returns the
 * asset descriptor (caller inserts the DB row).
 *
 * Defensive choices:
 *   - HEAD first to short-circuit Drive "viewer page" HTML before we burn bandwidth on a fetch.
 *   - Some hosts (Dropbox direct-download links) reject HEAD with 405 — we treat any non-200
 *     HEAD as a hint and proceed to GET, then re-check Content-Type on the response.
 *   - 10 MB cap mirrors the multipart upload route, applied before the download completes.
 */
export async function ingestUrlToS3(input: { sessionId: string; url: string }): Promise<IngestResult> {
  const normalized = normalizeIngestUrl(input.url);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: { code: 'invalid_url' } };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: { code: 'invalid_url' } };
  }

  // HEAD probe — best-effort. If the host rejects HEAD we fall through to GET.
  let headContentType: string | null = null;
  try {
    const headRes = await fetch(normalized, { method: 'HEAD', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (headRes.ok) {
      const ct = headRes.headers.get('content-type');
      headContentType = ct ? ct.split(';')[0]!.trim() : null;
      if (headContentType && !headContentType.startsWith(ALLOWED_MIME_PREFIX)) {
        return { ok: false, error: { code: 'not_image', contentType: headContentType } };
      }
    }
  } catch {
    // Ignore — continue to GET. Some hosts reject HEAD outright.
  }

  // GET
  let res: Response;
  try {
    res = await fetch(normalized, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : 'fetch error' },
    };
  }
  if (!res.ok) {
    return { ok: false, error: { code: 'fetch_failed', status: res.status, message: `HTTP ${res.status}` } };
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? null;
  if (!contentType || !contentType.startsWith(ALLOWED_MIME_PREFIX)) {
    return { ok: false, error: { code: 'not_image', contentType } };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return { ok: false, error: { code: 'too_large', bytes: buf.byteLength } };
  }

  const assetUuid = uuidv7();
  const ext = extensionForMime(contentType);
  const s3Key = `sessions/${input.sessionId}/photos/${assetUuid}${ext}`;

  await uploadObject({ key: s3Key, body: buf, contentType });

  return {
    ok: true,
    asset: {
      assetUuid,
      s3Key,
      publicUrl: getPublicUrl(s3Key),
      bytes: buf.byteLength,
      mimeType: contentType,
    },
  };
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    default:
      return '';
  }
}
