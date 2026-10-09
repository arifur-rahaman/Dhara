import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/features/import/csv';
import {
  guessMapping,
  parseCaseType,
  parseDate,
  parseSide,
  parseYear,
  splitNumberYear,
} from '@/features/import/fields';

describe('CSV reader (F20)', () => {
  it('reads quotes, doubled quotes, line breaks inside quotes, CRLF and a byte-order mark', () => {
    const text = '﻿Case no,Client,Note\r\n245,"Karim, Md.","said ""wait""\nthen left"\r\n246,Rahim,\r\n';
    expect(parseCsv(text)).toEqual([
      ['Case no', 'Client', 'Note'],
      ['245', 'Karim, Md.', 'said "wait"\nthen left'],
      ['246', 'Rahim', ''],
    ]);
  });

  it('picks semicolon or tab separators from the header line and drops blank lines', () => {
    expect(parseCsv('a;b\n1;2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('column guesses', () => {
  it('maps English and Bangla headers, each column once', () => {
    expect(guessMapping(['Case No', 'Year', 'Court', 'Court no', 'Client name', 'Next date'])).toEqual({
      number: 0,
      year: 1,
      court: 2,
      courtNo: 3,
      clientName: 4,
      nextDate: 5,
    });
    expect(guessMapping(['মামলা নং', 'সাল', 'আদালত', 'মক্কেলের নাম', 'পরবর্তী তারিখ', 'পক্ষ'])).toEqual({
      number: 0,
      year: 1,
      court: 2,
      clientName: 3,
      nextDate: 4,
      ourSide: 5,
    });
  });

  it('never guesses a contact column', () => {
    const mapping = guessMapping(['Case no', 'Phone', 'Mobile', 'Email', 'NID', 'Address', 'ফোন', 'ঠিকানা']);
    expect(Object.keys(mapping)).toEqual(['number']);
  });
});

describe('cell values', () => {
  it('reads day-first dates in English or Bangla digits, and ISO dates', () => {
    expect(parseDate('12/10/2026')).toBe('2026-10-12');
    expect(parseDate('৫-১১-২০২৬')).toBe('2026-11-05');
    expect(parseDate('5.1.2027')).toBe('2027-01-05');
    expect(parseDate('2026-10-12')).toBe('2026-10-12');
  });

  it('rejects dates that do not exist or are unclear', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('12/10/26')).toBeNull();
    expect(parseDate('next week')).toBeNull();
    expect(parseDate('13/13/2026')).toBeNull();
  });

  it('reads case types, sides and years', () => {
    expect(parseCaseType('Civil Suit')).toBe('civil');
    expect(parseCaseType('দেওয়ানি মামলা')).toBe('civil');
    expect(parseCaseType('জিআর')).toBe('criminal_gr');
    expect(parseCaseType('C.R.')).toBe('criminal_cr');
    expect(parseCaseType('unknown kind')).toBeNull();
    expect(parseSide('বিবাদী')).toBe('defendant');
    expect(parseSide('Plaintiff')).toBe('plaintiff');
    expect(parseSide('maybe')).toBeNull();
    expect(parseYear('২০২৬')).toBe('2026');
    expect(parseYear('26')).toBeNull();
  });

  it('splits 245/2026 into number and year when there is no year column', () => {
    expect(splitNumberYear('245/2026')).toEqual({ number: '245', year: '2026' });
    expect(splitNumberYear('৫১২/২০২৫')).toEqual({ number: '৫১২', year: '2025' });
    expect(splitNumberYear('Writ 9/2024')).toEqual({ number: 'Writ 9', year: '2024' });
    expect(splitNumberYear('245')).toEqual({ number: '245', year: null });
  });
});
