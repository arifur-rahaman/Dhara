import { describe, expect, it } from 'vitest';
import { dhakaMinute, recentMinutes } from '@/server/jobs/clock';

describe('Asia/Dhaka reminder clock', () => {
  it('20:00 in Dhaka is 14:00 UTC; 07:00 is 01:00 UTC', () => {
    expect(dhakaMinute(new Date('2026-10-08T14:00:30Z'))).toEqual({ hhmm: '20:00', date: '2026-10-08' });
    expect(dhakaMinute(new Date('2026-10-09T01:00:00Z'))).toEqual({ hhmm: '07:00', date: '2026-10-09' });
  });

  it('the Dhaka date turns at 18:00 UTC', () => {
    expect(dhakaMinute(new Date('2026-10-08T17:59:00Z'))).toEqual({ hhmm: '23:59', date: '2026-10-08' });
    expect(dhakaMinute(new Date('2026-10-08T18:00:00Z'))).toEqual({ hhmm: '00:00', date: '2026-10-09' });
  });

  it('a late tick still covers the minutes it missed', () => {
    expect(recentMinutes(new Date('2026-10-08T14:03:10Z'), 4).map((m) => m.hhmm)).toEqual([
      '19:59',
      '20:00',
      '20:01',
      '20:02',
      '20:03',
    ]);
  });
});
