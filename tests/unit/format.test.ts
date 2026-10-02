import { describe, expect, it } from 'vitest';
import { intlLocale } from '@/i18n/config';
import { formatDate, formatNumber, formatTaka } from '@/i18n/format';

const en = { locale: 'en', numerals: 'bn' } as const;
const bn = { locale: 'bn', numerals: 'bn' } as const;
const bnLatin = { locale: 'bn', numerals: 'latn' } as const;

describe('intlLocale', () => {
  it('uses English digits in English mode whatever the digit setting', () => {
    expect(intlLocale('en', 'bn')).toBe('en-BD-u-nu-latn');
  });
  it('uses Bangla digits in Bangla mode by default and English digits when chosen', () => {
    expect(intlLocale('bn', 'bn')).toBe('bn-BD-u-nu-beng');
    expect(intlLocale('bn', 'latn')).toBe('bn-BD-u-nu-latn');
  });
});

describe('formatNumber', () => {
  it('formats digits per mode', () => {
    expect(formatNumber(1234567, en)).toBe('1,234,567');
    expect(formatNumber(1234567, bn)).toBe('১২,৩৪,৫৬৭');
    expect(formatNumber(1234567, bnLatin)).toBe('12,34,567');
  });
});

describe('formatDate', () => {
  it('shows dates in Asia/Dhaka, not UTC', () => {
    // 20:00 UTC on 2 Oct is 02:00 on 3 Oct in Dhaka (UTC+6).
    const at = new Date('2026-10-02T20:00:00Z');
    expect(formatDate(at, en, { day: 'numeric' })).toBe('3');
    expect(formatDate(at, bn, { day: 'numeric' })).toBe('৩');
  });
});

describe('formatTaka', () => {
  it('formats integer poisha as taka', () => {
    expect(formatTaka(150000, en)).toBe('৳1,500');
    expect(formatTaka(150050, en)).toBe('৳1,500.50');
    expect(formatTaka(150000, bn)).toBe('৳১,৫০০');
  });
  it('rejects non-integer money', () => {
    expect(() => formatTaka(10.5, en)).toThrow(TypeError);
  });
});
