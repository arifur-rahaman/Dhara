import 'server-only';
import { cookies } from 'next/headers';
import {
  defaultLocale,
  defaultNumerals,
  isLocale,
  isNumerals,
  LOCALE_COOKIE,
  NUMERALS_COOKIE,
  type Locale,
  type Numerals,
} from '@/i18n/config';

export type Preferences = { locale: Locale; numerals: Numerals };

/**
 * Language and digit choice. Before login they live in cookies;
 * from M1 the signed-in user's profile takes precedence.
 */
export async function getPreferences(): Promise<Preferences> {
  const store = await cookies();
  const locale = store.get(LOCALE_COOKIE)?.value;
  const numerals = store.get(NUMERALS_COOKIE)?.value;
  return {
    locale: isLocale(locale) ? locale : defaultLocale,
    numerals: isNumerals(numerals) ? numerals : defaultNumerals,
  };
}
