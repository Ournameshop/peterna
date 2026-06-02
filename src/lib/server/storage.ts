// server-only — never import from a client component.
//
// S3 re-hosting for tribute assets. fal generation/storage URLs are short-lived
// (~24h); to make saved drafts resumable later we copy each asset onto our own
// S3 bucket and persist THAT URL. Ported from builder.blck's storage.ts, trimmed
// to S3-only with a graceful default: when S3 is not configured (or any upload
// fails) the helpers fall back to the original fal URL, so nothing breaks.
//
// Activate by setting on the server:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (default us-east-1),
//   S3_BUCKET (e.g. peterna-tribute-assets-dev), S3_KEY_PREFIX (e.g. peterna/)
//
// Keys are random (crypto.randomUUID) under `assets/{kind}/` — assets are not
// keyed by build id, so no build id needs threading through the wizard.

import { randomUUID } from 'crypto';

const FETCH_TIMEOUT_MS = 60_000;

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function isRealEnv(value: string | undefined): boolean {
  if (!value) return false;
  if (value === 'REPLACE_ME') return false;
  return value.trim().length > 0;
}

export function isS3Mode(): boolean {
  return (
    isRealEnv(process.env.AWS_ACCESS_KEY_ID) &&
    isRealEnv(process.env.AWS_SECRET_ACCESS_KEY) &&
    isRealEnv(process.env.S3_BUCKET)
  );
}

function s3KeyPrefix(): string {
  const raw = process.env.S3_KEY_PREFIX ?? '';
  if (!raw) return '';
  return raw.replace(/^\/+/, '').replace(/\/?$/, '/');
}

function prefixedKey(key: string): string {
  const prefix = s3KeyPrefix();
  if (!prefix) return key;
  if (key.startsWith(prefix)) return key;
  return `${prefix}${key.replace(/^\/+/, '')}`;
}

// Lazily-built, cached client — never constructed at import time.
let cachedClient: unknown = null;

async function getS3Client(): Promise<{
  client: unknown;
  bucket: string;
  publicUrlFor: (prefixedKey: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S3Mod: any;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S3Mod: any = await import('@aws-sdk/client-s3');
  const region = process.env.AWS_REGION ?? 'us-east-1';
  if (!cachedClient) {
    cachedClient = new S3Mod.S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  const bucket = process.env.S3_BUCKET!;
  return {
    client: cachedClient,
    bucket,
    publicUrlFor: (k) => `https://${bucket}.s3.${region}.amazonaws.com/${k}`,
    S3Mod,
  };
}

function assetKey(kind: string, ext: string): string {
  return `assets/${kind}/${randomUUID()}.${ext}`;
}

// SSRF guard: rehost() must only ever fetch asset URLs returned by fal — never
// an arbitrary or internal host (e.g. the EC2 metadata endpoint 169.254.169.254).
// Every caller passes a fal output URL, so we hard-restrict to fal.media over
// HTTPS; anything else is skipped (the caller keeps the source URL). `null` =
// not allowed.
function assertFalAssetUrl(sourceUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== 'fal.media' && !host.endsWith('.fal.media')) return null;
  return parsed;
}

async function fetchWithTimeout(sourceUrl: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // redirect: 'manual' so a 3xx can't bounce the fetch to an internal host;
    // rehost() treats any non-2xx (incl. opaqueredirect) as "skip re-hosting".
    return await fetch(sourceUrl, { signal: controller.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadFromBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const { client, bucket, publicUrlFor, S3Mod } = await getS3Client();
  const finalKey = prefixedKey(key);
  await (client as { send: (cmd: unknown) => Promise<unknown> }).send(
    new S3Mod.PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return publicUrlFor(finalKey);
}

/**
 * Store bytes we already hold (e.g. an ffmpeg output) to S3. Returns the S3 URL,
 * or null when S3 is not configured / the upload failed — callers fall back to
 * their existing fal.storage.upload path so behaviour is unchanged without S3.
 */
export async function store(
  buffer: Buffer,
  contentType: string,
  kind: string,
  ext: string,
): Promise<string | null> {
  if (!isS3Mode()) return null;
  try {
    return await uploadFromBuffer(buffer, assetKey(kind, ext), contentType);
  } catch (err) {
    console.warn(`[storage] store failed (${kind}); falling back to source:`, err);
    return null;
  }
}

/**
 * Copy a remote asset (a short-lived fal URL) onto S3 and return the durable
 * URL. Graceful: when S3 is not configured, the URL is a data: URI, or any step
 * fails, returns `sourceUrl` unchanged so the wizard never breaks.
 */
export async function rehost(sourceUrl: string, kind: string, ext: string): Promise<string> {
  if (!sourceUrl || !isS3Mode()) return sourceUrl;
  if (sourceUrl.startsWith('data:')) return sourceUrl;
  // SSRF guard — only re-host fal asset URLs; never fetch arbitrary/internal hosts.
  if (!assertFalAssetUrl(sourceUrl)) return sourceUrl;
  try {
    const res = await fetchWithTimeout(sourceUrl);
    if (!res.ok) return sourceUrl;
    const contentType = res.headers.get('content-type') ?? EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream';
    const buffer = Buffer.from(await res.arrayBuffer());
    return await uploadFromBuffer(buffer, assetKey(kind, ext), contentType);
  } catch (err) {
    console.warn(`[storage] rehost failed (${kind}); using source url:`, err);
    return sourceUrl;
  }
}

// One-time boot breadcrumb (mirrors the fal/builder.blck init log).
(function logStorageInit() {
  if (isS3Mode()) {
    console.log(
      `[storage] init mode=s3 bucket=${process.env.S3_BUCKET} region=${process.env.AWS_REGION ?? 'us-east-1'} prefix=${s3KeyPrefix() || '(none)'}`,
    );
  } else {
    console.log('[storage] init mode=passthrough (no S3 creds — assets stay on fal, ~24h TTL)');
  }
})();
