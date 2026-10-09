import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { expectNoSeriousA11yIssues, signUpOwner } from './helpers';

test('import (F20): empty case list offers import; CSV preview flags problems; XLSX dates import; duplicates skipped', async ({
  page,
}) => {
  test.slow();
  await signUpOwner(page);

  // First run: the empty case list offers adding and importing (EmptyState design).
  await page.goto('/cases');
  await expect(page.getByRole('heading', { name: 'No cases yet' })).toBeVisible();
  await page.getByRole('link', { name: 'Import from Excel' }).click();
  await expect(page).toHaveURL(/\/cases\/import$/);

  // CSV with a header row; one good row, one with an unknown court, one with an impossible date.
  const csv = [
    'Case No,Year,Court,Client,Next date,Phone',
    '701,2026,Joint District Judge Court,Import Client,15/11/2031,01811111111',
    '702,2026,Moon Court,Moon Client,,',
    '703,2026,Joint District Judge Court,,31/02/2031,',
  ].join('\n');
  await page
    .getByLabel('File', { exact: true })
    .setInputFiles({ name: 'diary.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('diary.csv: 3 rows')).toBeVisible();
  // Guessed from the headers; the phone column is never offered as a field.
  await expect(page.getByLabel('Case number')).toHaveValue('0');
  await expect(page.getByLabel('Client name')).toHaveValue('3');
  await expect(page.getByLabel('Next date')).toHaveValue('4');
  await expectNoSeriousA11yIssues(page);

  await page.getByRole('button', { name: 'Check the rows' }).click();
  const preview = page.getByRole('region', { name: '3. Check before importing' });
  await expect(preview.getByText('1 ready')).toBeVisible();
  await expect(preview.getByText('2 with problems')).toBeVisible();
  await expect(preview.getByText('court not found')).toBeVisible();
  await expect(preview.getByText('date not readable')).toBeVisible();

  await preview.getByRole('button', { name: 'Import 1 case' }).click();
  await expect(page.getByRole('status')).toContainText('1 case added, with 1 date and 1 new client.');
  await page.getByRole('link', { name: 'Open cases' }).click();
  await expect(page.getByRole('main').getByRole('link', { name: /Civil Suit 701\/2026/ })).toBeVisible();

  // No contact came in with the import: the client page has no phone.
  await page.goto('/clients');
  await page.getByRole('link', { name: /Import Client/ }).click();
  await expect(page.getByText('01811')).toHaveCount(0);

  // XLSX: a real date cell and "number/year" in one column; 701 again is a duplicate.
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Diary');
  sheet.addRow(['মামলা নং', 'আদালত', 'পরবর্তী তারিখ', 'ধরন']);
  sheet.addRow(['704/2026', 'Joint District Judge Court', new Date(Date.UTC(2031, 11, 3)), 'GR']);
  sheet.addRow(['701/2026', 'Joint District Judge Court', '', '']);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await page.goto('/cases/import');
  await page.getByLabel('File', { exact: true }).setInputFiles({
    name: 'diary.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByText('diary.xlsx: 2 rows')).toBeVisible();
  await page.getByRole('button', { name: 'Check the rows' }).click();
  await expect(page.getByText('1 already here')).toBeVisible();
  await expect(page.getByText('Already here, skipped')).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 case' }).click();
  await expect(page.getByRole('status')).toContainText('1 case added, with 1 date and 0 new clients.');

  await page.goto('/cases');
  await page
    .getByRole('main')
    .getByRole('link', { name: /GR Case 704\/2026/ })
    .click();
  await expect(page.getByText(/3 Dec 2031|December 3, 2031|3 December 2031/).first()).toBeVisible();
});
