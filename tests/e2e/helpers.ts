import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function previewAs(page: Page, role: 'owner' | 'associate' | 'munshi' | 'staff') {
  const labels = { owner: 'Owner', associate: 'Associate', munshi: 'Munshi', staff: 'Office staff' };
  await page.goto('/login');
  await page.getByRole('button', { name: labels[role], exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
}

export async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
