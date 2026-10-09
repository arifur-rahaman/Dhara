/**
 * Import wizard (F20): the case fields a column can map to, and how cell text becomes case data.
 * Shared by the browser (column guesses) and the server (validation). No client contact is imported:
 * phone, email, NID and address stay owner-only and need the client's consent (P1), so the owner
 * adds them on the client's page.
 */

export const importFields = [
  'number',
  'year',
  'court',
  'type',
  'ourSide',
  'courtNo',
  'clientName',
  'partiesText',
  'opposingCounsel',
  'nextDate',
  'note',
] as const;
export type ImportField = (typeof importFields)[number];
export type Mapping = Partial<Record<ImportField, number>>;

export const caseTypes = ['civil', 'criminal_cr', 'criminal_gr', 'writ', 'family', 'money_loan', 'other'] as const;
export type CaseType = (typeof caseTypes)[number];
export const sides = ['plaintiff', 'defendant'] as const;
export type Side = (typeof sides)[number];

export const MAX_ROWS = 1000;
export const MAX_COLUMNS = 30;
export const MAX_CELL = 300;

/** Lower case, Bangla digits as English, punctuation as spaces, single spaces. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .toLowerCase()
    .replace(/[.,;:()\-_/\\'"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Header words people use in diaries and spreadsheets, in English and Bangla. */
const headerWords: Record<ImportField, string[]> = {
  number: ['case no', 'case number', 'number', 'no', 'মামলা নং', 'মামলা নম্বর', 'নং', 'নম্বর', 'কেস নং', 'কেস নম্বর'],
  year: ['year', 'সাল', 'বছর'],
  court: ['court', 'আদালত', 'কোর্ট'],
  type: ['type', 'case type', 'kind', 'ধরন', 'মামলার ধরন', 'প্রকার'],
  ourSide: ['side', 'our side', 'party', 'পক্ষ', 'আমাদের পক্ষ'],
  courtNo: ['court no', 'court number', 'room', 'কোর্ট নং', 'আদালত নং', 'এজলাস'],
  clientName: ['client', 'client name', 'মক্কেল', 'ক্লায়েন্ট', 'ক্লায়েন্টের নাম', 'মক্কেলের নাম'],
  partiesText: ['parties', 'party names', 'বাদী বিবাদী', 'পক্ষগণ', 'পার্টি'],
  opposingCounsel: [
    'opposing counsel',
    'other side lawyer',
    'বিপক্ষের আইনজীবী',
    'প্রতিপক্ষের আইনজীবী',
    'বিপক্ষ আইনজীবী',
  ],
  nextDate: [
    'next date',
    'date',
    'hearing date',
    'next hearing',
    'পরবর্তী তারিখ',
    'পরের তারিখ',
    'তারিখ',
    'শুনানির তারিখ',
  ],
  note: ['note', 'notes', 'remarks', 'comment', 'নোট', 'মন্তব্য'],
};

/** First guess at which column holds which field, from the header row. Each column is used once. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<number>();
  const norm = headers.map(normalizeText);
  // Exact matches first, then headers that contain a known word (longest words first).
  for (const exact of [true, false]) {
    for (const field of importFields) {
      if (mapping[field] !== undefined) continue;
      const words = headerWords[field].map(normalizeText).sort((a, b) => b.length - a.length);
      const index = norm.findIndex(
        (h, i) => !used.has(i) && h !== '' && words.some((w) => (exact ? h === w : h.includes(w) && w.length > 2)),
      );
      if (index !== -1) {
        mapping[field] = index;
        used.add(index);
      }
    }
  }
  return mapping;
}

const typeWords: Record<CaseType, string[]> = {
  civil: ['civil', 'civil suit', 'other suit', 'os', 'দেওয়ানি', 'দেওয়ানী', 'দেওয়ানি মামলা', 'অন্য প্রকার'],
  criminal_cr: ['cr', 'cr case', 'c r', 'সিআর', 'সি আর'],
  criminal_gr: ['gr', 'gr case', 'g r', 'জিআর', 'জি আর'],
  writ: ['writ', 'writ petition', 'রিট', 'রিট পিটিশন'],
  family: ['family', 'family suit', 'পারিবারিক', 'পারিবারিক মামলা'],
  money_loan: ['money loan', 'artha rin', 'money suit', 'অর্থঋণ', 'অর্থ ঋণ'],
  other: ['other', 'case', 'মামলা', 'অন্যান্য'],
};

export function parseCaseType(value: string): CaseType | null {
  const v = normalizeText(value);
  if (!v) return null;
  for (const type of caseTypes) if (typeWords[type].some((w) => normalizeText(w) === v)) return type;
  for (const type of caseTypes)
    if (typeWords[type].some((w) => w.length > 3 && v.includes(normalizeText(w)))) return type;
  return null;
}

export function parseSide(value: string): Side | null {
  const v = normalizeText(value);
  if (!v) return null;
  if (
    ['plaintiff', 'petitioner', 'complainant', 'বাদী', 'বাদি', 'বাদীপক্ষ', 'বাদী পক্ষ', 'বাদীর পক্ষ', 'p'].includes(v)
  ) {
    return 'plaintiff';
  }
  if (
    [
      'defendant',
      'respondent',
      'accused',
      'বিবাদী',
      'বিবাদি',
      'বিবাদীপক্ষ',
      'বিবাদী পক্ষ',
      'আসামি',
      'আসামী',
      'd',
    ].includes(v)
  ) {
    return 'defendant';
  }
  return null;
}

/** A four-digit year from "2026" or "২০২৬". */
export function parseYear(value: string): string | null {
  const v = normalizeText(value);
  return /^(19|20)\d{2}$/.test(v) ? v : null;
}

/**
 * "245/2026" in the number column when there is no year column: number and year.
 * Anything else stays as the number.
 */
export function splitNumberYear(value: string): { number: string; year: string | null } {
  const trimmed = value.trim();
  const m = trimmed.match(/^(.*\S)\s*[/\-]\s*([০-৯\d]{4})$/);
  if (m) {
    const year = parseYear(m[2]);
    if (year) return { number: m[1].trim(), year };
  }
  return { number: trimmed, year: null };
}

/**
 * A date written day first, as in Bangladesh: 12/10/2026, 12-10-2026, 12.10.2026, with Bangla digits too,
 * or ISO 2026-10-12 (also what the browser sends for spreadsheet date cells). Returns YYYY-MM-DD.
 */
export function parseDate(value: string): string | null {
  const v = value.trim().replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1950 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
