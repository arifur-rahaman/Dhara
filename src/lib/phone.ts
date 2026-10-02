const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/**
 * Normalises a Bangladeshi mobile number to E.164 (+8801XXXXXXXXX).
 * Accepts 01XXXXXXXXX, 8801…, +8801…, spaces, dashes and Bangla digits. Returns null when invalid.
 */
export function normalizeBdPhone(input: string): string | null {
  const ascii = input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
  const digits = ascii.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('880') ? digits.slice(2) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? `+88${local}` : null;
}

/** Shows only the last three digits, e.g. "01•••••••123". Safe for screens and logs. */
export function maskPhone(e164: string): string {
  const local = e164.replace(/^\+88/, '');
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(local.length - 5, 0))}${local.slice(-3)}`;
}
