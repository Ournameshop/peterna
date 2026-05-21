// Phase 12 — client-side Web Push helpers.
//
// All helpers are client-only (touch `window`, `navigator`, `Notification`).
// Import only from `'use client'` components.
//
// iOS Safari note: Web Push works on iOS 16.4+ but only for installed PWAs
// (added to Home Screen). Outside that, `window.PushManager` will be undefined
// or `Notification.requestPermission` will reject. Always call
// `isPushSupported()` first and fall back gracefully (we surface email).
//
// All wire types come from `@/lib/builder/wire-types`. No field name lives
// outside that module.

import type {
  PushSubscribeRequest,
  PushSubscribeResponse,
  PushUnsubscribeRequest,
  PushUnsubscribeResponse,
  PushVapidKeyResponse,
} from '@/lib/builder/wire-types';

/**
 * Local-storage key we set after the user answers the prompt (yes or no).
 * Prevents pestering across reloads on the same browser.
 */
export const PUSH_ASKED_FLAG = 'peterna_push_asked';

/**
 * Returns true if the current browser supports the Web Push pipeline we need:
 * service workers, the Push API, and the Notification API. False on iOS Safari
 * (unless installed as a PWA), older browsers, and anywhere the spec isn't shipped.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (typeof window.PushManager === 'undefined') return false;
  if (typeof window.Notification === 'undefined') return false;
  return true;
}

/**
 * Returns the current Notification permission state. `'default'` means we have
 * NEVER prompted (or the user dismissed without choosing); `'granted'` and
 * `'denied'` are sticky.
 *
 * Returns `'denied'` on unsupported browsers so callers can treat it as "no path
 * forward" without a separate branch.
 */
export function getPermissionState(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Registers `/sw.js`. Idempotent — the browser dedupes by scope.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js');
}

/**
 * Prompts the user for permission. Returns the resulting state.
 *
 * The browser only shows the prompt once per origin while in `'default'`. After
 * a user dismisses without choosing, subsequent calls resolve immediately to
 * `'default'` without re-prompting — that's a browser-level constraint, not ours.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.requestPermission();
}

/**
 * Fetches the VAPID public key from the backend. The key is base64url-encoded;
 * the browser's `pushManager.subscribe` wants a Uint8Array, hence the helper below.
 */
export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/push/vapid-public-key', { method: 'GET' });
  const json = (await res.json()) as PushVapidKeyResponse;
  if (!json.ok) throw new Error('vapid-key-unavailable');
  return json.public_key;
}

/**
 * Subscribes the browser to push notifications using the supplied registration
 * + VAPID key. Returns the standard `PushSubscription`.
 *
 * If a subscription already exists for this registration, it's returned as-is
 * (the backend ignores duplicate inserts on `endpoint`).
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

/**
 * POSTs a PushSubscription to the backend so it can target this browser when
 * the user's render job finishes. `sessionId` is optional — anonymous sessions
 * pass it so the backend can scope the subscription before any auth_user is
 * attached.
 */
export async function postSubscription(
  subscription: PushSubscription,
  sessionId?: string | null,
): Promise<void> {
  const sub = subscription.toJSON();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error('subscription-malformed');
  }
  const body: PushSubscribeRequest = {
    session_id: sessionId ?? undefined,
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  };
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as PushSubscribeResponse;
  if (!json.ok) throw new Error(json.error ?? 'subscribe-failed');
}

/**
 * Tears down the active subscription (if any) and tells the backend to drop it.
 * Used from settings / "stop notifying me" controls.
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const body: PushUnsubscribeRequest = { endpoint };
  const res = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Best-effort — if the server already forgot us, we don't surface it.
  const json = (await res.json().catch(() => null)) as PushUnsubscribeResponse | null;
  if (json && !json.ok) throw new Error('unsubscribe-failed');
}

/**
 * Full happy-path: register SW → request permission → fetch key → subscribe →
 * POST to backend. Returns the resulting permission state so the caller can
 * react if the user said no.
 */
export async function enablePushNotifications(
  sessionId?: string | null,
): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  const registration = await registerServiceWorker();
  // Wait for activation — `pushManager.subscribe` rejects if the worker isn't ready.
  if (!registration.active) {
    await navigator.serviceWorker.ready;
  }
  const permission = await requestPushPermission();
  if (permission !== 'granted') return permission;
  const key = await fetchVapidPublicKey();
  const subscription = await subscribeToPush(registration, key);
  await postSubscription(subscription, sessionId);
  return permission;
}

/**
 * base64url → Uint8Array. PushManager wants the raw bytes, not the string.
 * Spec at https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe.
 *
 * We allocate via `new ArrayBuffer(len)` (not the Uint8Array constructor) so the
 * returned view's backing buffer is concretely `ArrayBuffer`, not the wider
 * `ArrayBufferLike`. The latter trips up `BufferSource` in TS strict mode.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return view;
}
