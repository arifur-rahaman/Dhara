import { expect, test } from '@playwright/test';
import { signUpOwner } from './helpers';

const todayDhaka = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

test('printable daily list and hearing history come out as PDFs (F6)', async ({ page }, testInfo) => {
  test.slow();
  test.skip(!testInfo.project.name.startsWith('web'), 'one size is enough for the PDF itself');
  await signUpOwner(page);
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('245');
  await page.getByLabel('Year').fill('2026');
  await page.getByLabel('Next date').fill(todayDhaka());
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  const casePath = new URL(page.url()).pathname;

  await page.goto('/today');
  const listHref = (await page.getByRole('link', { name: 'Print list (PDF)' }).getAttribute('href'))!;
  const list = await page.request.get(listHref);
  expect(list.status()).toBe(200);
  expect(list.headers()['content-type']).toBe('application/pdf');
  expect((await list.body()).toString('latin1')).toMatch(/Hind[\s_-]?Siliguri/i);

  // The print view itself: grouped by court, blank columns to fill in at court.
  await page.goto(`/print/day?date=${todayDhaka()}`);
  await expect(page.getByRole('heading', { name: 'Daily hearing list' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Civil Suit 245\/2026/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'What happened' })).toBeVisible();

  await page.goto(casePath);
  const history = await page.request.get(
    (await page.getByRole('link', { name: 'Hearing history (PDF)' }).getAttribute('href'))!,
  );
  expect(history.status()).toBe(200);
  expect((await history.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
