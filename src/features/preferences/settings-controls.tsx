'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useId, useOptimistic, useSyncExternalStore, useTransition } from 'react';
import type { Locale, Numerals } from '@/i18n/config';
import { setLocale, setNumerals } from './actions';

type Option<T extends string> = { value: T; label: string; lang?: string };

/** Settings row: label on the left, compact 200px segmented choice on the right (Settings design). */
function SettingRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  divider,
}: {
  label: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
  divider?: boolean;
}) {
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      className={`flex min-h-[58px] items-center justify-between gap-3 ${divider ? 'border-t border-border' : ''}`}
    >
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-[15px]">
        {label}
      </span>
      <div
        className="grid w-[200px] shrink-0 gap-0.5 rounded-[10px] bg-surface-2 p-[3px]"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <label
            key={option.value}
            lang={option.lang}
            className="flex h-9 cursor-pointer items-center justify-center rounded-[8px] text-[13px] text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LanguageSetting({ current }: { current: Locale }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(current);
  return (
    <SettingRow<Locale>
      label={t('settings.language')}
      options={[
        { value: 'en', label: t('language.en'), lang: 'en' },
        { value: 'bn', label: t('language.bn'), lang: 'bn' },
      ]}
      value={value}
      disabled={pending}
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

const themes = ['light', 'dark', 'system'] as const;
type Theme = (typeof themes)[number];
const subscribe = () => () => {};

export function ThemeSetting() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser; render no selection on the server.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <SettingRow<Theme>
      divider
      label={t('settings.theme')}
      options={themes.map((value) => ({ value, label: t(`theme.${value}`) }))}
      value={mounted ? (theme as Theme) : undefined}
      onChange={setTheme}
    />
  );
}

export function NumeralsSetting({ current }: { current: Numerals }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(current);
  return (
    <SettingRow<Numerals>
      divider
      label={t('settings.numbers')}
      options={[
        { value: 'bn', label: t('numerals.bn') },
        { value: 'latn', label: t('numerals.latn') },
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
