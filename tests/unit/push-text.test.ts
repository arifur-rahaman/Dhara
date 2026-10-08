import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { reminderMessage } = await import('@/server/jobs/reminders');

describe('reminder push text (TECH_GUIDE section 12: counts only)', () => {
  it('Bangla with Bangla digits by default', () => {
    expect(reminderMessage('night', { hearings: 3, tasks: 0, locale: 'bn', numerals: null }).body).toBe(
      'কাল ৩টি হিয়ারিং',
    );
    expect(reminderMessage('morning', { hearings: 5, tasks: 2, locale: 'bn', numerals: 'bn' }).body).toBe(
      'আজ ৫টি হিয়ারিং, ২টি কাজ',
    );
  });

  it('English and singular forms', () => {
    expect(reminderMessage('night', { hearings: 1, tasks: 0, locale: 'en', numerals: null }).body).toBe(
      '1 hearing tomorrow',
    );
    expect(reminderMessage('morning', { hearings: 4, tasks: 0, locale: 'en', numerals: null })).toEqual({
      title: 'Dhara',
      body: 'Today: 4 hearings',
      url: '/today',
      tag: 'reminder-morning',
    });
  });
});
