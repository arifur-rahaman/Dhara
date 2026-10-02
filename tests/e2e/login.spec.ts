import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, randomPhone } from './helpers';

test('opens in English and switches to Bangla and back in one tap', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to your chamber');

  await page.getByRole('button', { name: 'বাংলায় দেখুন' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('লগইন করুন');

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('theme button flips light and dark, and the choice survives a reload', async ({ page }, testInfo) => {
  await page.goto('/login');
  const html = page.locator('html');
  const system = testInfo.project.use.colorScheme === 'dark' ? 'dark' : 'light';
  const other = system === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', system);
  await page.getByRole('button', { name: 'Change theme' }).click();
  await expect(html).toHaveAttribute('data-theme', other);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', other);
});

test('says what is wrong with a bad phone number', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Enter a Bangladeshi mobile number, like 01712345678.',
  );
});

test('rejects a wrong code and does not sign in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Mobile number').fill(randomPhone());
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  await page.getByLabel('Code').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('That code is not right');
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login$/);
});

test('signed-out visitors cannot open chamber screens', async ({ page }) => {
  for (const path of ['/today', '/team', '/settings', '/clients']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login$/);
  }
});

test('login screen has no serious accessibility issues', async ({ page }) => {
  await page.goto('/login');
  await expectNoSeriousA11yIssues(page);
});
