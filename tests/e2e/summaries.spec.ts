import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, signUpOwner } from './helpers';

const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

test('document summary (F38): off until allowed; then the owner summarises an uploaded judgment', async ({ page }) => {
  test.slow();
  await signUpOwner(page);
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('61');
  await page.getByLabel('Year').fill('2026');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  const casePath = new URL(page.url()).pathname;

  await page.goto(`${casePath}?tab=documents`);
  await page.getByLabel('Add file').setInputFiles({ name: 'judgment.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('link', { name: 'Summary' }).first().click();
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}\/summary$/);
  await expect(page.getByText('Reading documents with AI is off for this chamber.')).toBeVisible();

  await page.getByRole('link', { name: 'Open Settings' }).click();
  await page.getByRole('region', { name: 'AI' }).getByRole('button', { name: 'Turn on' }).click();
  await page.goBack();
  await page.reload();
  await page.getByRole('button', { name: 'Summarise with AI' }).click();
  await expect(page.getByText("The court allowed the plaintiff's application.")).toBeVisible();
  await expect(page.getByText('• The defendant is to file a reply.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Summarise again' })).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});
