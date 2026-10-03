import 'server-only';
import { getTranslations } from 'next-intl/server';
import { dbDate, todayInDhaka, type Ymd } from '@/lib/dates';
import { formatDate, formatNumber } from '@/i18n/format';
import { getPreferences } from '@/features/preferences/server';
import { courtLabel, type CourtRef } from './format';
import type { CaseType } from './queries';

/** Formatting for case screens: titles, courts and dates in the person's language and digits (Asia/Dhaka). */
export async function caseDisplay() {
  const prefs = await getPreferences();
  const t = await getTranslations();
  const today = todayInDhaka();
  return {
    prefs,
    today,
    /** "দেওয়ানি মামলা 245/2026" — number and year as entered. */
    title: (c: { type: CaseType; number: string; year: string }) => `${t(`caseType.${c.type}`)} ${c.number}/${c.year}`,
    court: (court: CourtRef, courtNo: string | null) =>
      courtLabel(court, courtNo, prefs.locale, (d) => t(`districts.${d}`), t('court.bench')),
    /** "১৪ অক্টোবর ২০২৬, বুধবার" */
    long: (ymd: Ymd) =>
      formatDate(dbDate(ymd), prefs, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }),
    /** "সোমবার, ২৮ সেপ্টেম্বর" */
    dayHeader: (ymd: Ymd) => formatDate(dbDate(ymd), prefs, { weekday: 'long', day: 'numeric', month: 'long' }),
    /** "১৪ অক্টো" */
    short: (ymd: Ymd) => formatDate(dbDate(ymd), prefs, { day: 'numeric', month: 'short' }),
    /** "১৪ সেপ্টেম্বর ২০২৬" */
    medium: (ymd: Ymd) => formatDate(dbDate(ymd), prefs, { day: 'numeric', month: 'long', year: 'numeric' }),
    number: (n: number) => formatNumber(n, prefs),
  };
}
