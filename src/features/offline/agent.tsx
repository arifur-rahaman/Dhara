'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icons';
import { flushOutbox, refreshSnapshot } from './sync';

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Keeps this phone ready for court without signal (F21): refreshes the offline snapshot while online,
 * sends the outbox when the connection returns, and shows the offline banner (Offline design).
 */
export function OfflineAgent({ besideSidebar = false }: { besideSidebar?: boolean }) {
  const t = useTranslations('offline');
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  // The offline page shows its own banner with the last sync time.
  const onOfflinePage = usePathname() === '/offline';

  useEffect(() => {
    const sync = async () => {
      if (busy.current || !navigator.onLine) return;
      busy.current = true;
      try {
        const report = await flushOutbox();
        if (report.sent || report.conflicts.length || report.failed) {
          const parts = [];
          if (report.sent) parts.push(t('sent', { count: report.sent }));
          for (const c of report.conflicts) parts.push(t('conflict', { item: c }));
          if (report.failed) parts.push(t('refused', { count: report.failed }));
          setMessage(parts.join(' '));
        }
        await refreshSnapshot();
      } catch {
        // Network trouble: the outbox stays and the next attempt tries again.
      } finally {
        busy.current = false;
      }
    };
    const update = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void sync();
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void sync(), REFRESH_MS);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.clearInterval(timer);
    };
  }, [t]);

  return (
    <>
      {offline && !onOfflinePage && (
        <div
          role="status"
          className={`mx-5 mt-1 flex items-center gap-2.5 rounded-[12px] bg-lock-bg px-3.5 py-2.5 ${besideSidebar ? 'md:mr-10 md:ml-[calc(var(--spacing-sidebar)+40px)]' : ''}`}
        >
          <Icon name="close" size={18} className="shrink-0 text-lock-text" />
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold">{t('banner')}</span>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- offline, only a full load reaches the service worker's saved page */}
            <a href="/offline" className="text-[12px] text-muted underline">
              {t('openSaved')}
            </a>
          </span>
        </div>
      )}
      {message && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(var(--spacing-tabbar)+12px)] z-30 mx-auto flex max-w-[560px] items-start gap-3 rounded-[12px] bg-ok-bg px-4 py-3 text-[14px] text-ok shadow-lg md:bottom-6"
        >
          <span className="grow">{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label={t('dismiss')}
            className="-m-2 flex size-9 items-center justify-center"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
