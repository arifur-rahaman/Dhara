import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, previewAs } from './helpers';

const tabs = {
  owner: ['Today', 'Cases', 'Clients', 'Accounts', 'More'],
  associate: ['Today', 'Cases', 'Clients', 'Drafts', 'More'],
  munshi: ['Today', 'Cases', 'Calendar', 'More'],
  staff: ['Today', 'Tasks', 'More'],
} as const;

for (const [role, labels] of Object.entries(tabs) as [keyof typeof tabs, readonly string[]][]) {
  test(`${role} gets its bottom tabs on mobile`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile layout');
    await previewAs(page, role);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveText([...labels]);
    await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await expectNoSeriousA11yIssues(page);
  });
}

test('owner gets the 248px sidebar on web and no bottom tabs', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('web'), 'web layout');
  await previewAs(page, 'owner');
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox())?.width).toBe(248);
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1);
  await expectNoSeriousA11yIssues(page);
});

test('tabs are at least 44px tall', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'mobile layout');
  await previewAs(page, 'owner');
  for (const link of await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all()) {
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

test('settings switches language and Bangla digits', async ({ page }) => {
  await previewAs(page, 'munshi');
  await page.goto('/settings');
  await page.getByText('বাংলা', { exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('সেটিংস');
  await expect(page.getByText('বাংলা মোডে নম্বর')).toBeVisible();
  await page.getByText('ইংরেজি (123)').click();
  await expect(page.getByText('ইংরেজি (123)').locator('input')).toBeChecked();
});
