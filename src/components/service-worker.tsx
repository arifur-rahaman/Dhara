'use client';

import { useEffect } from 'react';

/** Registers the service worker: installable app, push reminders and offline use. It is network-first, so it is safe in development too. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Installability is optional; the app works without it.
    });
  }, []);
  return null;
}
