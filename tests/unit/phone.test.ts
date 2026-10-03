import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeBdPhone } from '@/lib/phone';

describe('normalizeBdPhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['017-1234 5678', '+8801712345678'],
    ['০১৭১২৩৪৫৬৭৮', '+8801712345678'],
  ])('accepts %s', (input, expected) => expect(normalizeBdPhone(input)).toBe(expected));

  it.each(['', '0171234567', '01212345678', '+14155550123', 'abc', '017123456789'])('rejects %s', (input) =>
    expect(normalizeBdPhone(input)).toBeNull(),
  );
});

describe('maskPhone', () => {
  it('keeps only the first two and last three digits', () => {
    expect(maskPhone('+8801712345678')).toBe('01••••••678');
  });
});
