/** Wall-clock time in Asia/Dhaka (UTC+6, no daylight saving) as HH:MM and YYYY-MM-DD. */
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function dhakaMinute(at: Date) {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]));
  return { hhmm: `${p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}

/** The minute `at` falls in and the `back` minutes before it, oldest first (a late tick catches up). */
export function recentMinutes(at: Date, back = 4) {
  const base = Math.floor(at.getTime() / 60_000) * 60_000;
  return Array.from({ length: back + 1 }, (_, i) => dhakaMinute(new Date(base - (back - i) * 60_000)));
}
