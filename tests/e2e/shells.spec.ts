import { expect, test } from '@playwright/test';
import { signUpOwner } from './helpers';

test('owner web sidebar matches the design and tabs are 44px+ on mobile', async ({ page }, testInfo) => {
  await signUpOwner(page);
  const nav = page.getByRole('navigation', { name: 'Main menu' });
  if (testInfo.project.name.startsWith('web')) {
    await expect(nav.getByRole('link')).toHaveText([
      'Today',
      'Cases',
      'Clients',
      'Accounts',
      'Reports',
      'Team & permissions',
      'Settings',
    ]);
  } else {
    for (const link of await nav.getByRole('link').all()) {
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('settings switches language, theme and Bangla numbers', async ({ page }) => {
  await signUpOwner(page);
  await page.goto('/settings');
  await page.getByRole('group', { name: 'Theme' }).getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('group', { name: 'Language' }).getByText('বাংলা', { exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('সেটিংস');
  const numbers = page.getByRole('group', { name: 'নাম্বার' });
  await numbers.getByText('English 123').click();
  await expect(numbers.getByRole('radio', { name: 'English 123' })).toBeChecked();
});

test('admin portal shell has the dark sidebar (development only until M3)', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('web'), 'web layout');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/chambers$/);
  await expect(page.getByRole('navigation', { name: 'Admin menu' }).getByRole('link')).toHaveCount(6);
});
