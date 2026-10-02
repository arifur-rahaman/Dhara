'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { LOCALE_COOKIE, locales, NUMERALS_COOKIE, numeralSystems } from '@/i18n/config';

const ONE_YEAR = 60 * 60 * 24 * 365;
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: ONE_YEAR,
};

export async function setLocale(input: unknown) {
  const locale = z.enum(locales).parse(input);
  (await cookies()).set(LOCALE_COOKIE, locale, cookieOptions);
}

export async function setNumerals(input: unknown) {
  const numerals = z.enum(numeralSystems).parse(input);
  (await cookies()).set(NUMERALS_COOKIE, numerals, cookieOptions);
}
