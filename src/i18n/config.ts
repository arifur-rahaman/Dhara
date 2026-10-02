export const locales = ['en', 'bn'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Digits used in Bangla mode. English mode always uses English digits. */
export const numeralSystems = ['bn', 'latn'] as const;
export type Numerals = (typeof numeralSystems)[number];
export const defaultNumerals: Numerals = 'bn';

export const timeZone = 'Asia/Dhaka';

export const LOCALE_COOKIE = 'dhara_locale';
export const NUMERALS_COOKIE = 'dhara_numerals';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function isNumerals(value: unknown): value is Numerals {
  return typeof value === 'string' && (numeralSystems as readonly string[]).includes(value);
}

/**
 * The BCP 47 tag used for Intl formatting.
 * Bangla mode uses Bangla digits unless the user picked English digits.
 */
export function intlLocale(locale: Locale, numerals: Numerals): string {
  if (locale === 'en') return 'en-BD-u-nu-latn';
  return numerals === 'latn' ? 'bn-BD-u-nu-latn' : 'bn-BD-u-nu-beng';
}
