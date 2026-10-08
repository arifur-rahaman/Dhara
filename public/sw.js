// Dhara service worker: installable app (M0), push reminders (M5, F5) and offline use (M5, F21).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Reminder pushes carry counts only (TECH_GUIDE section 12); details appear after opening the app.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dhara', {
      body: data.body || '',
      tag: data.tag || 'dhara',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/today' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// ---------------------------------------------------------------------------
// Offline use (F21, TECH_GUIDE section 11). Network first for everything, so online use is never stale;
// when the network fails, a navigation gets the saved offline page and assets come from the cache.
// API responses are never cached (the offline snapshot lives in IndexedDB, written by the page).
// ---------------------------------------------------------------------------
const STATIC = 'dhara-static-v1';
const PAGES = 'dhara-pages-v1';
const isAsset = (path) =>
  path.startsWith('/_next/static/') || path.startsWith('/icons/') || path === '/manifest.webmanifest' || /\.(woff2?|png|svg|ico)$/.test(path);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // Offline, any page becomes the saved offline page, at its own address: the app's router would
    // otherwise see a page that does not match the URL and try (and fail) to load the real one.
    event.respondWith(
      fetch(req).catch(async () => {
        const saved = await caches.match('/offline', { cacheName: PAGES });
        if (!saved) return Response.error();
        return url.pathname === '/offline' ? saved : Response.redirect('/offline', 302);
      }),
    );
    return;
  }
  if (isAsset(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(STATIC).then((c) => c.put(req, copy)));
          }
          return res;
        })
        .catch(async () => (await caches.match(req, { cacheName: STATIC })) || Response.error()),
    );
  }
});

async function cacheOfflinePage() {
  const res = await fetch('/offline', { credentials: 'same-origin', cache: 'no-store' });
  // A signed-out visitor is redirected to the login page; that must not become the offline page.
  if (!res.ok || res.redirected || new URL(res.url).pathname !== '/offline') return;
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put('/offline', res);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const store = await caches.open(STATIC);
  await Promise.all(
    assets.map((a) =>
      fetch(a)
        .then((r) => (r.ok ? store.put(a, r) : undefined))
        .catch(() => undefined),
    ),
  );
}

self.addEventListener('message', (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  const type = event.data && event.data.type;
  if (type === 'cache-offline-page') event.waitUntil(cacheOfflinePage().catch(() => undefined));
  if (type === 'clear') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('dhara-')).map((k) => caches.delete(k)))));
  }
});
