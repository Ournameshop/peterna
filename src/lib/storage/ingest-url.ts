import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

import { v7 as uuidv7 } from 'uuid';

import { getPublicUrl, uploadObject } from './s3';

/**
 * SSRF guard for user-supplied URLs ingested server-side (B4 in the
 * pre-Phase-15 bug audit). Without this, a logged-in user can submit
 * `http://169.254.169.254/...` (AWS IMDSv1) or `http://localhost:5432/` and
 * have the server fetch it on their behalf — leaking IAM credentials or
 * probing the internal network.
 *
 * Strategy:
 *   - protocol must be http: or https: (cheap upfront check)
 *   - reject explicit numeric private addresses in the host string
 *   - resolve the hostname via DNS; reject if ANY returned address is in a
 *     private / loopback / link-local / unique-local / IPv4-mapped range.
 *     `all: true` so a DNS-rebinding host that returns one public + one
 *     private address can't sneak through.
 *
 * Throws `SsrfBlockedError` on rejection. Caller catches and returns a
 * user-facing `invalid_url` so we don't leak internal-network details in
 * the API error message.
 */
export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('invalid-url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`bad-protocol:${parsed.protocol}`);
  }

  const host = parsed.hostname;
  if (!host) throw new SsrfBlockedError('missing-host');

  // If the URL itself contains a literal IP, check it before DNS.
  if (isIPv4(host) && isPrivateIPv4(host)) {
    throw new SsrfBlockedError(`private-ip:${host}`);
  }
  if (isIPv6(host) && isPrivateIPv6(host)) {
    throw new SsrfBlockedError(`private-ip:${host}`);
  }

  // Resolve DNS — block if any returned A/AAAA record is private. `all: true`
  // defends against DNS rebinding hosts that mix public + private records.
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfBlockedError('dns-lookup-failed');
  }
  if (addrs.length === 0) throw new SsrfBlockedError('dns-no-result');
  for (const { address, family } of addrs) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new SsrfBlockedError(`private-ip:${address}`);
    }
    if (family === 6 && isPrivateIPv6(address)) {
      throw new SsrfBlockedError(`private-ip:${address}`);
    }
  }
}

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    // Malformed — be conservative and reject.
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 127) return true;                         // loopback
  if (a === 169 && b === 254) return true;            // link-local (incl. AWS IMDS)
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 0) return true;                            // "this network"
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT 100.64/10
  if (a >= 224) return true;                           // multicast + reserved
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === '::1') return true;                                  // loopback
  if (lower === '::') return true;                                   // unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true;  // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique-local
  if (lower.startsWith('ff')) return true;                           // multicast
  // IPv4-mapped ::ffff:a.b.c.d — recheck the embedded v4.
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]!);
  return false;
}

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

  // B4: SSRF guard. Reject anything that resolves to a private / loopback /
  // link-local IP — IMDS, localhost, intranet hosts, etc. Throws on rejection;
  // we collapse to `invalid_url` here so the user-facing message doesn't leak
  // the reason (defense in depth — we don't want a response that confirms
  // whether internal.acme.corp exists).
  try {
    await assertPublicHttpUrl(normalized);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return { ok: false, error: { code: 'invalid_url' } };
    }
    throw err;
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
