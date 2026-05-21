import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import webpush from 'web-push';

import { getDb } from '@/lib/db/client';
import { pushSubscriptions } from '@/lib/db/schema';

import { tryReadVapid } from './vapid';

/**
 * Push notification payload. The service worker (`public/sw.js`, frontend-
 * owned) is expected to render `{ title, body, url }`. Keep this contract
 * small so the SW stays trivial.
 */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type SendPushResult = {
  delivered: number;
  expired: number;
  failed: number;
};

let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const v = tryReadVapid();
  if (!v.ok) {
    console.warn('[push] VAPID not configured; skipping send', { missing: v.missing });
    return false;
  }
  webpush.setVapidDetails(v.config.subject, v.config.publicKey, v.config.privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Send a push to every subscription tied to a given session_id. Used by the
 * worker when an anonymous session finishes a render. Subscriptions that
 * return 404/410 are deleted (the endpoint has been retired by the browser).
 */
export async function sendPushToSession(
  sessionId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  if (!ensureVapidConfigured()) return { delivered: 0, expired: 0, failed: 0 };
  const db = getDb();
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.sessionId, sessionId));
  return sendToSubscriptions(rows, payload);
}

/** Send to every subscription tied to a signed-in user (across their devices). */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  if (!ensureVapidConfigured()) return { delivered: 0, expired: 0, failed: 0 };
  const db = getDb();
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return sendToSubscriptions(rows, payload);
}

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendToSubscriptions(
  rows: SubscriptionRow[],
  payload: PushPayload,
): Promise<SendPushResult> {
  const db = getDb();
  const json = JSON.stringify(payload);
  let delivered = 0;
  let expired = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          json,
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expired += 1;
          expiredIds.push(row.id);
        } else {
          failed += 1;
          console.warn('[push] send failed', {
            endpoint: row.endpoint.slice(0, 50),
            status,
          });
        }
      }
    }),
  );

  if (expiredIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expiredIds));
  }

  return { delivered, expired, failed };
}

/**
 * Mark a subscription as recently notified — used to deprioritize the same
 * device when broadcasting to multiple subscribers. Worker doesn't need
 * this today; exported for the future.
 */
export async function touchSubscription(subscriptionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(pushSubscriptions)
    .set({ lastNotifiedAt: new Date() })
    .where(eq(pushSubscriptions.id, subscriptionId));
}
