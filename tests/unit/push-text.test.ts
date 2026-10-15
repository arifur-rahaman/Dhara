import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { noticeMessage, reminderMessage } = await import('@/server/jobs/reminders');

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
      title: 'Pocket Chamber',
      body: 'Today: 4 hearings',
      url: '/today',
      tag: 'reminder-morning',
    });
  });
});

describe('notice push text (F18: counts only, no case or client details)', () => {
  it('names only how many dates, tasks and other notices are new', () => {
    expect(noticeMessage({ dates: 1, tasks: 0, other: 0, locale: 'en', numerals: null })).toEqual({
      title: 'Pocket Chamber',
      body: 'A next date was added to 1 case',
      url: '/notifications',
      tag: 'notices',
    });
    expect(noticeMessage({ dates: 2, tasks: 1, other: 1, locale: 'en', numerals: null }).body).toBe(
      'Next dates were added to 2 cases · 1 new task for you · 1 new notice',
    );
    expect(noticeMessage({ dates: 3, tasks: 2, other: 0, locale: 'bn', numerals: 'bn' }).body).toBe(
      '৩টি কেসে পরের তারিখ অ্যাড হয়েছে · আপনার জন্য ২টি নতুন কাজ',
    );
  });
});
