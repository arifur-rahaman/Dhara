import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues } from './helpers';

test('opens in English and switches to Bangla and back in one tap', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to Dhara');

  await page.getByText('বাংলা', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ধারায় লগইন করুন');
  await expect(page.getByText('মামলা, তারিখ, ক্লায়েন্ট — সব এক ধারায়।')).toBeVisible();

  await page.getByText('English', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('theme switch sets light, dark and follows the system', async ({ page }, testInfo) => {
  await page.goto('/login');
  const html = page.locator('html');

  await page.getByText('Dark', { exact: true }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 20, 23)');

  await page.getByText('Light', { exact: true }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 244, 239)');

  await page.getByText('System', { exact: true }).click();
  const systemTheme = testInfo.project.use.colorScheme === 'dark' ? 'dark' : 'light';
  await expect(html).toHaveAttribute('data-theme', systemTheme);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', systemTheme);
});

test('login screen has no serious accessibility issues', async ({ page }) => {
  await page.goto('/login');
  await expectNoSeriousA11yIssues(page);
});
