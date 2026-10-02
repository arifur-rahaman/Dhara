import { describe, expect, it } from 'vitest';
import bn from '@/i18n/bn.json';
import en from '@/i18n/en.json';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe('translations', () => {
  it('bn.json has exactly the keys of en.json', () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort());
  });

  it('Bangla mode avoids the bookish words listed in plan.md section 14', () => {
    const banned = [
      'দল',
      'সদস্য',
      'ভূমিকা',
      'অনুমতি',
      'আমন্ত্রণ',
      'সক্রিয়',
      'সংরক্ষণ',
      'খসড়া',
      'শুনানি',
      'নিরাপত্তা',
    ];
    const text = JSON.stringify(bn);
    for (const word of banned) expect(text, `bn.json uses "${word}"`).not.toContain(word);
  });
});
