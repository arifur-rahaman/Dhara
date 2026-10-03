/**
 * Calendar dates as 'YYYY-MM-DD' strings in Asia/Dhaka (hearing dates have no time).
 * The database stores them as `date`; Prisma returns them as UTC-midnight Date objects.
 */
export type Ymd = string;

const dhaka = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInDhaka(now = new Date()): Ymd {
  return dhaka.format(now);
}

export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Date column value → 'YYYY-MM-DD'. */
export function ymdFromDb(date: Date): Ymd {
  return date.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → value for a Prisma `@db.Date` column. */
export function dbDate(ymd: Ymd): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const d = dbDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return ymdFromDb(d);
}

export function addMonths(ymd: Ymd, months: number): Ymd {
  const d = dbDate(ymd);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return ymdFromDb(d);
}

/** Month as weeks of seven cells, Sunday first (as in the NextDate design). */
export function monthGrid(year: number, month: number): (Ymd | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (Ymd | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(ymdFromDb(new Date(Date.UTC(year, month - 1, d))));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
