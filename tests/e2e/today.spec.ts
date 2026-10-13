import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, signUpOwner } from './helpers';

const plusDays = (n: number) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test("owner's Today (F3, F4): tomorrow's list, fees due and open tasks in the briefing", async ({ page }) => {
  test.slow();
  await signUpOwner(page);

  await page.goto('/today');
  await expect(page.getByRole('heading', { name: "Tomorrow's hearings" })).toBeVisible();
  await expect(page.getByText('No hearings tomorrow.')).toBeVisible();
  await expect(page.getByRole('link', { name: /No open tasks/ })).toBeVisible();

  // A case heard tomorrow, with a fee nobody has paid yet.
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('812');
  await page.getByLabel('Year').fill('2026');
  await page.getByLabel('Client').fill('Briefing Client');
  await page.getByLabel('Next date').fill(plusDays(1));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  await page.goto(`${new URL(page.url()).pathname}?tab=fees`);
  await page.getByLabel('For', { exact: true }).fill('Hearing fee');
  await page.getByLabel('Amount (taka)').fill('5000');
  await page.getByRole('button', { name: 'Add fee' }).click();
  await expect(page.getByText('Fee added.')).toBeVisible();

  // A task due today.
  await page.goto('/tasks');
  await page.getByLabel('Task', { exact: true }).fill('Collect the certified copy');
  await page.getByLabel('By (optional)').fill(plusDays(0));
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('status')).toHaveText('Task added.');

  await page.goto('/today');
  const tomorrow = page.getByRole('region', { name: "Tomorrow's hearings" });
  await expect(tomorrow.getByRole('link', { name: /Civil Suit 812\/2026/ })).toBeVisible();
  await expect(page.getByText('hearings tomorrow').locator('..')).toContainText('1');
  await expect(page.getByRole('link', { name: /1 client has fees due/ })).toHaveAttribute('href', '/accounts');
  await expect(page.getByRole('link', { name: /1 open task in the chamber.*1 is due today or late/ })).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});
