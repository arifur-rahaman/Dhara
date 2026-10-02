'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/features/preferences/actions';
import type { Locale } from '@/i18n/config';

/** One-tap pill that switches to the other language (Main, MainEnglish designs). */
export function LanguageToggle({ current }: { current: Locale }) {
  const t = useTranslations('language');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = current === 'en' ? 'bn' : 'en';
  return (
    <button
      type="button"
      lang={next}
      aria-label={t('switchToLabel')}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      className="h-11 rounded-full border border-border bg-surface px-3.5 text-[14px] font-semibold disabled:opacity-60"
    >
      {t('switchTo')}
    </button>
  );
}
