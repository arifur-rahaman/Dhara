'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { setNumerals } from '@/features/preferences/actions';
import type { Numerals } from '@/i18n/config';
import { SegmentedControl } from './segmented-control';

export function NumeralsSwitch({ current }: { current: Numerals }) {
  const t = useTranslations('numerals');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(current);

  return (
    <SegmentedControl<Numerals>
      legend={t('label')}
      options={[
        { value: 'bn', label: t('bn') },
        { value: 'latn', label: t('latn') },
      ]}
      value={value}
      disabled={pending}
      onChange={(next) =>
        startTransition(async () => {
          setValue(next);
          await setNumerals(next);
          router.refresh();
        })
      }
    />
  );
}
