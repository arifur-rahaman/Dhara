import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, signInWithOtp, signUpOwner } from './helpers';

test('settings (M6): font size follows the account; another device can be logged out from the device list', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const { phone, recoveryCodes } = await signUpOwner(page);

  await page.goto('/settings');
  await page.getByRole('group', { name: 'Font size' }).getByText('Large').click();
  await expect(page.locator('[data-text-size="lg"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-text-size="lg"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Font size' }).getByLabel('Large')).toBeChecked();
  await expectNoSeriousA11yIssues(page);

  // A second sign-in on another "phone".
  const other = await browser.newContext({ viewport: testInfo.project.use.viewport! });
  const otherPage = await other.newPage();
  await signInWithOtp(otherPage, phone);
  // A recovery code: the authenticator code from sign-up may not be reused in the same 30 seconds.
  await otherPage.locator('#totp-code').fill(recoveryCodes[0]);
  await otherPage.getByRole('button', { name: 'Continue' }).click();
  await expect(otherPage).toHaveURL(/\/today$/);

  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /Login devices\s*2 devices/ })).toBeVisible();
  await page.getByRole('link', { name: /Login devices/ }).click();
  await expect(page.getByText('This device')).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole('button', { name: 'Log out all other devices' }).click();
  await expect(page.getByRole('button', { name: 'Log out all other devices' })).toHaveCount(0);

  await otherPage.goto('/today');
  await expect(otherPage).toHaveURL(/\/login$/);
  // This device is still signed in.
  await page.goto('/today');
  await expect(page).toHaveURL(/\/today$/);
  await other.close();

  // Normal size again: the attribute goes away.
  await page.goto('/settings');
  await page.getByRole('group', { name: 'Font size' }).getByText('Normal').click();
  await expect(page.locator('[data-text-size]')).toHaveCount(0);
});

test('courses (F24, F25): the basic course lists six modules; marking one done moves the progress', async ({
  page,
}) => {
  await signUpOwner(page);
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'Basic computer skills' })).toBeVisible();
  const modules = page.getByRole('region', { name: 'Modules of Basic computer skills' });
  await expect(modules.getByRole('link')).toHaveCount(6);
  await expect(page.getByText('0/6')).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await page.getByRole('link', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Typing in Bangla and English' })).toBeVisible();
  await expect(page.getByText('The video for this module is being made.')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as done' }).click();
  await expect(page.getByRole('button', { name: 'Done (tap to undo)' })).toBeVisible();
  // The title is streamed with the page after the action re-renders it; check once it is there.
  await expect(page).toHaveTitle(/Typing in Bangla and English/);
  await expectNoSeriousA11yIssues(page);

  await page.goto('/courses');
  await expect(page.getByText('1/6')).toBeVisible();
  await page.getByRole('link', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Formatting plaints and notices in Word' })).toBeVisible();
});
