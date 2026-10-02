'use client';

import { useEffect } from 'react';

/** Registers the service worker that makes Dhara installable. Offline caching arrives in M5. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Installability is optional; the app works without it.
    });
  }, []);
  return null;
}
