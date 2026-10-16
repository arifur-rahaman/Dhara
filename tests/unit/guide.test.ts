import { describe, expect, it } from 'vitest';
import { guide, inline } from '@/features/guide/content';

describe('user guide (content/guide.bn.json)', () => {
  it('parses and has unique section ids', () => {
    const ids = guide.sections.map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers turning two-step verification on and off', () => {
    const text = JSON.stringify(guide.sections.find((s) => s.id === 'two-step'));
    expect(text).toContain('বন্ধ');
  });

  it('has a valid updated date', () => {
    expect(guide.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('avoids the bookish words listed in plan.md section 14', () => {
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
    const text = JSON.stringify(guide);
    for (const word of banned) expect(text, `guide uses "${word}"`).not.toContain(word);
  });

  it('splits inline markup into parts', () => {
    expect(inline('a **b** [[c]] d')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'ui', text: 'c' },
      { kind: 'text', text: ' d' },
    ]);
  });
});
