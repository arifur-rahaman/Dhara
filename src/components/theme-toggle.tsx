'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Icon } from './icons';

const subscribe = () => () => {};

/** Round button that flips light and dark (Main design). The full Light / Dark / System choice is in Settings. */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      aria-label={t('toggle')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex size-11 items-center justify-center rounded-full border border-border bg-surface"
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={20} />
    </button>
  );
}
