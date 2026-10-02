'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { setLocale } from '@/features/preferences/actions';
import type { Locale } from '@/i18n/config';
import { SegmentedControl } from './segmented-control';

export function LanguageSwitch({ current, hideLegend }: { current: Locale; hideLegend?: boolean }) {
  const t = useTranslations('language');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(current);

  return (
    <SegmentedControl<Locale>
      legend={t('label')}
      options={[
        { value: 'en', label: t('en'), lang: 'en' },
        { value: 'bn', label: t('bn'), lang: 'bn' },
      ]}
      value={value}
      disabled={pending}
      hideLegend={hideLegend}
      onChange={(next) =>
        startTransition(async () => {
          setValue(next);
          await setLocale(next);
          router.refresh();
        })
      }
    />
  );
}
