'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * PDF_MODE=print (hosts without Chromium, such as Vercel): the PDF links open the print page with
 * ?autoprint=1, and the browser's own "Save as PDF" makes the file. Hidden on paper.
 */
export function AutoPrint() {
  const t = useTranslations('print');
  const auto = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get('autoprint') === '1',
    () => false,
  );
  useEffect(() => {
    if (!auto) return;
    void document.fonts.ready.then(() => window.print());
  }, [auto]);
  if (!auto) return null;
  return (
    <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-3 px-8 pt-6 print:hidden">
      <p className="text-[14px] text-muted">{t('saveHint')}</p>
      <button
        type="button"
        onClick={() => window.print()}
        className="h-11 shrink-0 rounded-control bg-accent px-4 text-[15px] font-semibold text-on-accent"
      >
        {t('printButton')}
      </button>
    </div>
  );
}
