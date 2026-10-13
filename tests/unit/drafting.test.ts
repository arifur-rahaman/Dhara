import { describe, expect, it } from 'vitest';
import { redact, restore, stripCitations } from '@/features/drafting/redact';

describe('redaction before AI (plan.md 7.5)', () => {
  it('replaces names, phones, emails and NID numbers with placeholders, and puts them back', () => {
    const facts =
      'Md. Karim Hossain (01711-123456, karim@example.com, NID 1234567890123) lent money to Rafiq. Karim wants it back. ' +
      'রফিকের ফোন ০১৮১২৩৪৫৬৭৮।';
    const { text, map } = redact(facts, ['Md. Karim Hossain', 'Karim', 'Rafiq', 'রফিক']);
    expect(text).not.toMatch(/Karim|Rafiq|রফিক|01711|karim@|1234567890123|০১৮১২৩৪৫৬৭৮/);
    expect(text).toContain('[PERSON_1]');
    expect(text).toContain('[PHONE_1]');
    expect(text).toContain('[EMAIL_1]');
    expect(text).toContain('[NID_1]');
    expect(restore(text, map)).toBe(facts);
  });

  it('keeps one placeholder per value and ignores very short names', () => {
    const { text } = redact('Karim met Karim. Al came.', ['Karim', 'Al']);
    expect(text).toBe('[PERSON_1] met [PERSON_1]. Al came.');
  });

  it('leaves placeholders the model invented alone', () => {
    expect(restore('[PERSON_9] and [PERSON_1]', { '[PERSON_1]': 'Karim' })).toBe('[PERSON_9] and Karim');
  });
});

describe('law-report citations are removed (no verified library yet)', () => {
  it('removes sentences that cite reports or name cases, keeps the rest', () => {
    const draft = [
      'The plaintiff is the owner of the land. This was settled in 45 DLR (AD) 123. The defendant refused.',
      'As held in Abdul Karim v. State, bail is the rule.',
      'বাদী বনাম বিবাদী (২০১৯) মামলায় এ কথা বলা হয়েছে। বাদী জমির মালিক।',
      'AC Land office recorded the mutation.',
    ].join('\n');
    const { text, removed } = stripCitations(draft);
    expect(removed).toBe(3);
    expect(text).toContain('The plaintiff is the owner of the land.');
    expect(text).toContain('The defendant refused.');
    expect(text).toContain('বাদী জমির মালিক।');
    expect(text).toContain('AC Land office recorded the mutation.');
    expect(text).not.toMatch(/DLR|v\. State|বনাম/);
  });
});
