import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, signInWithOtp, signUpOwner } from './helpers';

test('a new owner sets up a chamber, turns on two-step, and must use it to sign in again', async ({
  page,
}, testInfo) => {
  const owner = await signUpOwner(page);
  expect(owner.recoveryCodes).toHaveLength(10);

  if (testInfo.project.name.startsWith('mobile')) {
    await expect(page.getByRole('navigation', { name: 'Main menu' }).getByRole('link')).toHaveText([
      'Today',
      'Cases',
      'Clients',
      'Accounts',
      'More',
    ]);
  } else {
    await expect(page.locator('aside')).toBeVisible();
    expect((await page.locator('aside').boundingBox())?.width).toBe(248);
  }
  await expectNoSeriousA11yIssues(page);

  // Settings shows two-step as on; sign out.
  await page.goto('/settings');
  await expect(page.getByText('On', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // OTP alone is not enough for an owner: the second step is required. A recovery code works once.
  await signInWithOtp(page, owner.phone);
  await expect(page).toHaveURL(/\/login\/two-step/);
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login\/two-step/);
  await page.getByLabel('Code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('That code is not right');
  await page.getByLabel('Code').fill(owner.recoveryCodes[0]);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/today$/);
});

test('an owner can set a password and sign in with it', async ({ page }) => {
  const owner = await signUpOwner(page);
  await page.goto('/settings');
  await page.getByLabel('New password (at least 8 characters)').fill('correct horse battery');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByText('Password saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('link', { name: 'Sign in with password' }).click();
  await expect(page).toHaveURL(/\/login\/password$/);
  await page.getByLabel('Mobile number').fill(owner.phone);
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Mobile number or password is not right.');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login\/two-step/);
});
