/**
 * Redaction before any AI call (plan.md 7.5): client names, phone numbers, emails and NID numbers become
 * placeholders like [PERSON_1]. The map stays on our side so the draft can be shown with the real values;
 * the AI provider and the stored draft only ever see the placeholders.
 */
export type RedactionMap = Record<string, string>;

const PHONE = /(?:\+?88)?0?1[3-9]\d{2}[-\s]?\d{6}|(?:\+?৮৮)?০?১[৩-৯][০-৯]{2}[-\s]?[০-৯]{6}/g;
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}/g;
/** NID: 10, 13 or 17 digits (old and new formats), in English or Bangla digits. */
const NID = /(?<![\d০-৯])(?:[\d০-৯]{17}|[\d০-৯]{13}|[\d০-৯]{10})(?![\d০-৯])/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function redact(text: string, names: string[]): { text: string; map: RedactionMap } {
  const map: RedactionMap = {};
  const counters: Record<string, number> = {};
  const token = (kind: string, value: string) => {
    const existing = Object.entries(map).find(([, v]) => v === value)?.[0];
    if (existing) return existing;
    counters[kind] = (counters[kind] ?? 0) + 1;
    const key = `[${kind}_${counters[kind]}]`;
    map[key] = value;
    return key;
  };
  // Contact details first, so a name inside an email address does not break it.
  let out = text.replace(EMAIL, (m) => token('EMAIL', m));
  out = out.replace(PHONE, (m) => token('PHONE', m));
  out = out.replace(NID, (m) => token('NID', m));
  // Longest names first, so "Md. Karim Hossain" is replaced before "Karim". English names match whole
  // words only; Bangla names also match with endings (রফিকের), as Bangla needs.
  const unique = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 3))].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of unique) {
    out = out.replace(new RegExp(`(?<![A-Za-z])${escape(name)}(?![A-Za-z])`, 'gi'), (m) => token('PERSON', m));
  }
  return { text: out, map };
}

/** Puts the real values back for display. Placeholders the model invented stay as they are. */
export function restore(text: string, map: RedactionMap): string {
  return text.replace(/\[(?:PERSON|EMAIL|PHONE|NID)_\d+\]/g, (key) => map[key] ?? key);
}

/**
 * Citations to law reports cannot be checked against a verified library yet (plan.md 7.5, F53 is not built),
 * so any sentence citing one is removed and the lawyer is told how many were removed.
 */
const REPORT =
  /\b(?:\d{1,4}\s*)?(?:DLR|BLD|BLC|BLT|MLR|ADC|SCOB|LNJ|AIR|SCC|PLD|SCMR|All\s?ER|WLR)\b(?:\s*\(?(?:AD|HCD|HD|SC)\)?)?(?:\s*\d{1,4})?/;
const CASE_NAME = /\b[A-Z][\w.&' -]{1,60}\s+(?:v\.|vs\.?|versus)\s+[A-Z][\w.&' -]{1,60}/;
const CASE_NAME_BN = /[ঀ-৿\s.]{2,40}\s+বনাম\s+[ঀ-৿\s.]{2,40}[\s,]*(?:\(?\s*[\d০-৯]{4}\s*\)?)/;

export function stripCitations(text: string): { text: string; removed: number } {
  let removed = 0;
  const lines = text.split('\n').map((line) => {
    // Not after abbreviations such as "v." or "Md.", so "Karim v. State" stays one sentence.
    const sentences = line.split(/(?<!\b(?:v|vs|Md|Mst|Mr|Mrs|Dr|No|Art|Sec|Ord)\.)(?<=[.।?!])\s+/);
    const kept = sentences.filter((s) => {
      const cites = REPORT.test(s) || CASE_NAME.test(s) || CASE_NAME_BN.test(s);
      if (cites) removed++;
      return !cites;
    });
    return kept.join(' ');
  });
  return { text: lines.join('\n'), removed };
}
