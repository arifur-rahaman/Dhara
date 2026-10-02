import { intlLocale, timeZone, type Locale, type Numerals } from './config';

export type FormatPrefs = { locale: Locale; numerals: Numerals };

export function formatNumber(value: number, prefs: FormatPrefs, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocale(prefs.locale, prefs.numerals), options).format(value);
}

export function formatDate(
  value: Date,
  prefs: FormatPrefs,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) {
  return new Intl.DateTimeFormat(intlLocale(prefs.locale, prefs.numerals), { timeZone, ...options }).format(value);
}

/** Money is stored as integer poisha (1 taka = 100 poisha). */
export function formatTaka(poisha: number, prefs: FormatPrefs) {
  if (!Number.isInteger(poisha)) throw new TypeError('Money must be integer poisha');
  const taka = poisha / 100;
  const digits = formatNumber(taka, prefs, {
    minimumFractionDigits: poisha % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `৳${digits}`;
}
