import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isYmd, monthGrid, todayInDhaka } from '@/lib/dates';

describe('dates in Asia/Dhaka', () => {
  it('uses the Dhaka calendar day, not UTC', () => {
    // 19:30 UTC on 2 Oct is 01:30 on 3 Oct in Dhaka (UTC+6).
    expect(todayInDhaka(new Date('2026-10-02T19:30:00Z'))).toBe('2026-10-03');
    expect(todayInDhaka(new Date('2026-10-02T17:59:00Z'))).toBe('2026-10-02');
  });
  it('validates calendar dates', () => {
    expect(isYmd('2026-10-14')).toBe(true);
    expect(isYmd('2026-02-30')).toBe(false);
    expect(isYmd('14/10/2026')).toBe(false);
  });
  it('adds days and months, clamping month ends', () => {
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-09-28', 1)).toBe('2026-10-28');
  });
  it('builds a Sunday-first month grid', () => {
    const grid = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
    expect(grid[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
});
