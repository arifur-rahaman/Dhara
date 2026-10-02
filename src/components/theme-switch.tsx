'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { SegmentedControl } from './segmented-control';

const themes = ['light', 'dark', 'system'] as const;
type Theme = (typeof themes)[number];

const subscribe = () => () => {};

export function ThemeSwitch() {
  const t = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser; render no selection on the server.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <SegmentedControl<Theme>
      legend={t('label')}
      options={themes.map((value) => ({ value, label: t(value) }))}
      value={mounted ? (theme as Theme) : undefined}
      onChange={setTheme}
    />
  );
}
