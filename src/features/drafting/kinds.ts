/**
 * Draft kinds (AIDraft design, F33) and their outlines (F34). The outlines are headings and blanks only:
 * the court's own format and wording come from the lawyer, who must review every draft. They are a
 * starting point to be checked by a practising lawyer, not settled forms.
 */
export const draftKinds = ['plaint', 'bail', 'notice', 'writ'] as const;
export type DraftKind = (typeof draftKinds)[number];

/** What a draft needs before it is written (the design's checklist). Keys are stable; labels are in i18n. */
export const checklist: Record<DraftKind, string[]> = {
  plaint: ['parties', 'causeDate', 'jurisdiction', 'valuation', 'courtFee', 'limitation', 'relief'],
  bail: ['parties', 'caseRef', 'offence', 'arrestDate', 'grounds', 'previousBail', 'relief'],
  notice: ['parties', 'facts', 'demand', 'deadline', 'consequence'],
  writ: ['parties', 'impugnedAction', 'rightAffected', 'noOtherRemedy', 'relief'],
};

/** Section headings each kind's draft follows, in order. */
export const outline: Record<DraftKind, { bn: string[]; en: string[] }> = {
  plaint: {
    bn: [
      'আদালতের নাম ও মামলা নম্বর',
      'বাদী',
      'বিবাদী',
      'মামলার বিষয়',
      'ঘটনার বিবরণ',
      'নালিশের কারণ ও তারিখ',
      'এখতিয়ার',
      'মূল্যমান ও কোর্ট ফি',
      'তামাদি',
      'প্রতিকার',
      'সত্যপাঠ',
    ],
    en: [
      'Court and suit number',
      'Plaintiff',
      'Defendant',
      'Subject of the suit',
      'Facts',
      'Cause of action and date',
      'Jurisdiction',
      'Valuation and court fee',
      'Limitation',
      'Relief sought',
      'Verification',
    ],
  },
  bail: {
    bn: [
      'আদালতের নাম ও মামলা নম্বর',
      'আবেদনকারী',
      'প্রতিপক্ষ',
      'অভিযোগের সংক্ষিপ্ত বিবরণ',
      'গ্রেফতারের তারিখ ও বর্তমান অবস্থা',
      'জামিনের কারণসমূহ',
      'পূর্বের জামিন আবেদন',
      'প্রার্থনা',
    ],
    en: [
      'Court and case number',
      'Applicant',
      'Opposite party',
      'Brief allegation',
      'Date of arrest and present status',
      'Grounds for bail',
      'Previous bail applications',
      'Prayer',
    ],
  },
  notice: {
    bn: ['তারিখ ও প্রাপক', 'বিষয়', 'ঘটনার বিবরণ', 'দাবি', 'সময়সীমা', 'না মানলে পরবর্তী পদক্ষেপ', 'আইনজীবীর স্বাক্ষর'],
    en: [
      'Date and addressee',
      'Subject',
      'Facts',
      'Demand',
      'Time to comply',
      'Consequence of non-compliance',
      "Advocate's signature",
    ],
  },
  writ: {
    bn: [
      'আদালত ও রিট পিটিশন নম্বর',
      'দরখাস্তকারী',
      'প্রতিপক্ষগণ',
      'যে কাজ বা আদেশের বিরুদ্ধে',
      'ঘটনার বিবরণ',
      'যে অধিকার ক্ষুণ্ণ হয়েছে',
      'অন্য কোনো প্রতিকার না থাকা',
      'যুক্তিসমূহ',
      'প্রার্থনা',
    ],
    en: [
      'Court and writ petition number',
      'Petitioner',
      'Respondents',
      'Action or order challenged',
      'Facts',
      'Right affected',
      'No other adequate remedy',
      'Grounds',
      'Prayer',
    ],
  },
};
