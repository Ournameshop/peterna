// Peterna Phase 12 + 13 — minimal service worker.
//
// Two responsibilities, both deliberately bare:
//   1. Web Push (Phase 12) — receive backend pushes, show the "ready"
//      notification, route the click into the tab if one's open.
//   2. PWA install eligibility (Phase 13) — `skipWaiting()` on install +
//      `clients.claim()` on activate so the browser counts the SW as
//      "controlling" without a reload.
//
// We intentionally do NOT cache, precache, or handle fetch. Offline support
// would change the contract with the API layer (stale data, retries, etc.)
// and that's out of Phase 13 scope.
//
// Backend pushes shape: { title, body, icon?, url? }. One notification per
// tribute (the "ready" moment) — dedup is enforced server-side via the
// render_jobs table.

self.addEventListener('install', () => {
  // Activate immediately so the first subscribe doesn't have to wait for a reload.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Your tribute is ready', body: '', icon: '/favicon.ico', url: '/' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  const { title, body, icon, url } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          try {
            client.navigate(target);
            return client.focus();
          } catch {
            // navigate() can throw across origins; fall back to opening a new window
          }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
