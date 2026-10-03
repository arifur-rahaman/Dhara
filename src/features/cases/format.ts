import type { Locale } from '@/i18n/config';

export type CourtRef = {
  nameBn: string;
  nameEn: string;
  level: 'supreme' | 'district' | 'tribunal';
  district: string | null;
};

/**
 * Court as shown on screens, e.g. "যুগ্ম জেলা জজ আদালত-২, চট্টগ্রাম" or "হাইকোর্ট বিভাগ, কোর্ট ১৮".
 * The court number is shown as entered. District names come from i18n.
 */
export function courtLabel(
  court: CourtRef,
  courtNo: string | null | undefined,
  locale: Locale,
  districtLabel: (district: string) => string,
  benchWord: string,
): string {
  const name = locale === 'bn' ? court.nameBn : court.nameEn;
  if (court.level === 'supreme') return courtNo ? `${name}, ${benchWord} ${courtNo}` : name;
  const numbered = courtNo ? `${name}-${courtNo}` : name;
  return court.district ? `${numbered}, ${districtLabel(court.district)}` : numbered;
}
