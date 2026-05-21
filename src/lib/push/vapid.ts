import 'server-only';

/**
 * VAPID (Voluntary Application Server Identification) for Web Push.
 *
 * The public key is served to the browser at `/api/push/vapid-public-key`
 * and used in `pushManager.subscribe({ applicationServerKey })`. The private
 * key signs the JWT that authenticates our notification POSTs to the push
 * service endpoint. The `mailto:` subject is required by the spec.
 *
 * Generate keys once with `npm run vapid:generate`, then paste into
 * `.env.local`. Keys never rotate without invalidating every existing
 * subscription, so keep them stable per environment.
 */

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type VapidLookup =
  | { ok: true; config: VapidConfig }
  | { ok: false; missing: string[] };

/**
 * Soft lookup — returns the missing env var names instead of throwing.
 * Routes use this to send a 503 rather than a 500 in dev, and the worker
 * uses it to skip push delivery without crashing.
 */
export function tryReadVapid(): VapidLookup {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  const missing: string[] = [];
  if (!publicKey) missing.push('VAPID_PUBLIC_KEY');
  if (!privateKey) missing.push('VAPID_PRIVATE_KEY');
  if (!subject) missing.push('VAPID_SUBJECT');
  if (missing.length > 0) return { ok: false, missing };
  if (!subject!.startsWith('mailto:') && !subject!.startsWith('http')) {
    return { ok: false, missing: ['VAPID_SUBJECT (must be mailto: or https:)'] };
  }
  return { ok: true, config: { publicKey: publicKey!, privateKey: privateKey!, subject: subject! } };
}

/** Throwing variant for places that should hard-fail (e.g. the worker's push send). */
export function readVapidOrThrow(): VapidConfig {
  const result = tryReadVapid();
  if (!result.ok) {
    throw new Error(`VAPID config missing: ${result.missing.join(', ')}`);
  }
  return result.config;
}
