/** English digits only, so "২৪৫/২০২৬" and "245/2026" compare equal. */
const digits = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

/**
 * Does the case number read from the order photo name this case? Compares the number and, when present,
 * the year. 'unknown' when the photo had no readable number: the person decides.
 */
export function caseNumberMatches(read: string | null, c: { number: string; year: string }): 'yes' | 'no' | 'unknown' {
  if (!read) return 'unknown';
  const parts: string[] = digits(read).match(/\d+/g) ?? [];
  if (!parts.length) return 'unknown';
  const number = digits(c.number).match(/\d+/g)?.join('') ?? '';
  const year = digits(c.year);
  const hasNumber = parts.some((p) => p === number) || parts.join('') === number;
  const yearOk =
    !parts.some((p) => p.length === 4) || parts.includes(year) || parts.some((p) => p.length === 2 && year.endsWith(p));
  return hasNumber && yearOk ? 'yes' : 'no';
}

/** A valid calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
