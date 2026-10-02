import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues } from './helpers';

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
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    other === 'dark' ? 'rgb(18, 20, 23)' : 'rgb(246, 244, 239)',
  );

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', other);
});

test('login screen has no serious accessibility issues', async ({ page }) => {
  await page.goto('/login');
  await expectNoSeriousA11yIssues(page);
});
