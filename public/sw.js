// Peterna Phase 12 — minimal Web Push service worker.
//
// Scope: push notification + click-through only. No caching, no offline,
// no background sync — those are PWA features we don't ship yet.
//
// Backend posts payloads shaped like:
//   { title: string, body: string, icon?: string, url?: string }
//
// One notification per tribute (the "ready" moment) — dedup is enforced
// server-side via the render_jobs table.

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
