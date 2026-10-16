import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues } from './helpers';

test('the user guide opens from the login page without signing in', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Read the user guide' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('User guide');

  const twoStep = page.locator('section#two-step');
  await page.locator('a[href="#two-step"]').click();
  await expect(twoStep).toBeInViewport();
  await expect(twoStep).toContainText('বন্ধ');
  await expectNoSeriousA11yIssues(page);

  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
