// Dhara service worker. M0: makes the app installable and takes control quickly.
// Offline caching of Today and recent cases and the outbox arrive in M5 (F21).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
