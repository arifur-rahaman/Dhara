import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, signUpOwner } from './helpers';

test('AI draft (F33): checklist, names hidden from what is sent, draft streamed with DRAFT mark, saved and reopened', async ({
  page,
}) => {
  test.slow();
  await signUpOwner(page);
  await page.goto('/drafts');
  await page.getByRole('button', { name: 'Bail petition' }).click();
  await expect(page.getByRole('button', { name: 'Bail petition' })).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByLabel('Write the facts of the case')
    .fill('Rahim Uddin was arrested on 2 October; his phone is 01811-222333. He has no previous record.');
  await page.getByLabel('Names to hide').fill('Rahim Uddin');
  await expectNoSeriousA11yIssues(page);

  await page.getByRole('button', { name: 'Check what the draft needs' }).click();
  const checks = page.getByRole('region', { name: 'What the draft needs' });
  await expect(checks.getByText('Date of arrest')).toBeVisible();
  await checks.getByText('See what was sent to AI').click();
  await expect(checks.getByText(/\[PERSON_1\] was arrested/)).toBeVisible();
  await expect(checks.getByText(/Rahim Uddin|01811/)).toHaveCount(0);

  await checks.getByRole('button', { name: /Write the draft/ }).click();
  const output = page.getByRole('region', { name: 'Draft' });
  await expect(output.getByText('Grounds for bail')).toBeVisible();
  // Names come back on screen only; the citation the fake model wrote was removed.
  await expect(output.getByText('Rahim Uddin')).toBeVisible();
  await expect(output.getByText(/1 sentence citing a law report was removed/)).toBeVisible();
  await expect(output.getByText(/DLR/)).toHaveCount(0);
  await expect(output.getByText('This is a draft.', { exact: false })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await output.getByRole('link', { name: 'Open and print' }).click();
  await expect(page).toHaveURL(/\/drafts\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Rahim Uddin')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();

  await page.goto('/drafts');
  await expect(
    page.getByRole('region', { name: 'Recent drafts' }).getByRole('link', { name: /Bail petition/ }),
  ).toBeVisible();
});
