import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, previewAs } from './helpers';

const tabs = {
  owner: ['Today', 'Cases', 'Clients', 'Accounts', 'More'],
  associate: ['Today', 'Cases', 'Clients', 'AI draft', 'More'],
  munshi: ['Today', 'Cases', 'Take photo', 'More'],
  staff: ['Today', 'All tasks', 'More'],
} as const;

for (const [role, labels] of Object.entries(tabs) as [keyof typeof tabs, readonly string[]][]) {
  test(`${role} gets its bottom tabs on mobile`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile layout');
    await previewAs(page, role);
    const nav = page.getByRole('navigation', { name: 'Main menu' });
    await expect(nav.getByRole('link')).toHaveText([...labels]);
    await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await expectNoSeriousA11yIssues(page);
  });
}

test('owner gets the 248px light sidebar on web and no bottom tabs', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('web'), 'web layout');
  await previewAs(page, 'owner');
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox())?.width).toBe(248);
  const nav = page.getByRole('navigation', { name: 'Main menu' });
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole('link')).toHaveText([
    'Today',
    'Cases',
    'Clients',
    'Accounts',
    'Reports',
    'Team & permissions',
    'Settings',
  ]);
  await expectNoSeriousA11yIssues(page);
});

test('tabs are at least 44px tall', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile layout');
  await previewAs(page, 'owner');
  for (const link of await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link').all()) {
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});

test('staff cannot open screens outside their role', async ({ page }) => {
  await previewAs(page, 'staff');
  for (const path of ['/clients', '/cases', '/accounts', '/team']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test('settings switches language, theme and Bangla numbers', async ({ page }) => {
  await previewAs(page, 'munshi');
  await page.goto('/settings');

  await page.getByRole('group', { name: 'Theme' }).getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('group', { name: 'Language' }).getByText('বাংলা', { exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('সেটিংস');
  const numbers = page.getByRole('group', { name: 'নাম্বার' });
  await expect(numbers.getByRole('radio', { name: 'বাংলা ১২৩' })).toBeChecked();
  await numbers.getByText('English 123').click();
  await expect(numbers.getByRole('radio', { name: 'English 123' })).toBeChecked();
});

test('admin portal shell has the dark sidebar', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('web'), 'web layout');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/chambers$/);
  await expect(page.getByRole('navigation', { name: 'Admin menu' }).getByRole('link')).toHaveCount(6);
  await expect(page.locator('aside')).toHaveCSS('background-color', /rgb\((27, 29, 34|12, 14, 17)\)/);
});
