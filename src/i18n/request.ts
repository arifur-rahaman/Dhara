import { getRequestConfig } from 'next-intl/server';
import { getPreferences } from '@/features/preferences/server';
import { intlLocale, timeZone } from './config';

export default getRequestConfig(async () => {
  const { locale, numerals } = await getPreferences();
  return {
    // The locale tag carries the digit choice, so ICU numbers and plurals follow it.
    locale: intlLocale(locale, numerals),
    timeZone,
    messages: (await import(`./${locale}.json`)).default,
  };
});
