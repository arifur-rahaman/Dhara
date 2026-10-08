/** Money is integer poisha (TECH_GUIDE section 6). Parses what people type: "1500", "1,500.50", "১৫০০". */
const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

export function parseTakaToPoisha(input: string): number | null {
  const ascii = input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d))).replace(/[,\s৳]/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(ascii)) return null;
  const [taka, fraction = ''] = ascii.split('.');
  const poisha = Number(taka) * 100 + Number(fraction.padEnd(2, '0'));
  return poisha > 0 && poisha <= 2_000_000_000 ? poisha : null;
}
