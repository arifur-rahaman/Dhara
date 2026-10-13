import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseNumberMatches, isIsoDate } from '@/features/order-photo/match';

describe('case number on an order photo (F37)', () => {
  const c = { number: '245', year: '2026' };
  it('matches the number and year in English or Bangla digits', () => {
    expect(caseNumberMatches('245/2026', c)).toBe('yes');
    expect(caseNumberMatches('দেওয়ানি ২৪৫/২০২৬', c)).toBe('yes');
    expect(caseNumberMatches('Civil Suit No. 245 of 26', c)).toBe('yes');
    expect(caseNumberMatches('245', c)).toBe('yes');
  });
  it('flags a different number or year, and says unknown when nothing was read', () => {
    expect(caseNumberMatches('254/2026', c)).toBe('no');
    expect(caseNumberMatches('245/2025', c)).toBe('no');
    expect(caseNumberMatches(null, c)).toBe('unknown');
    expect(caseNumberMatches('no number', c)).toBe('unknown');
  });
});

describe('dates from the model', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2026-10-14')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('14/10/2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('fake AI provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('gives a fixed reading in development, and nothing in production', async () => {
    vi.stubEnv('AI_PROVIDER', 'fake');
    const { aiProvider } = await import('@/server/providers/ai');
    const input = {
      image: Buffer.from(''),
      mediaType: 'image/jpeg' as const,
      language: 'en' as const,
      today: '2026-10-13',
    };
    expect(await aiProvider().readOrderPhoto(input)).toMatchObject({ ok: true, reading: { nextDate: '2026-11-12' } });
    vi.stubEnv('NODE_ENV', 'production');
    expect(await aiProvider().readOrderPhoto(input)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
