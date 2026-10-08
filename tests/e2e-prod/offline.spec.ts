import { expect, test } from '@playwright/test';
import { seedMunshiWithHearingToday } from './seed';

const plusDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test('offline: today stays readable; a next date saved offline syncs once after reconnecting (F21)', async ({
  page,
  context,
  baseURL,
}) => {
  const seed = await seedMunshiWithHearingToday(context, baseURL!);

  // Online once: the service worker takes control and the phone saves its snapshot and the offline page.
  await page.goto('/today');
  await expect(page.getByRole('main').getByText('Civil Suit 245/2026').first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(async () => !!(await caches.match('/offline')) && !!navigator.serviceWorker.controller), {
      timeout: 30_000,
    })
    .toBe(true);

  // No internet: any screen shows what the phone saved.
  await context.setOffline(true);
  await page.goto('/today').catch(() => undefined);
  await expect(page).toHaveURL(/\/offline$/);
  await expect(page.getByRole('heading', { name: "Today's list" })).toBeVisible();
  await expect(page.getByText('No internet. You are seeing what this phone saved.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Next date or order photo for Civil Suit 245/2026' }).click();
  await page.getByRole('button', { name: 'In 7 days' }).click();
  await page.getByLabel('What happened today (optional)').fill('Adjourned, entered offline');
  await page.getByRole('button', { name: 'Save on this phone' }).click();
  await expect(page.getByRole('heading', { name: '1 change pending' })).toBeVisible();
  expect(await seed.hearings()).toHaveLength(1);

  // Back online: the outbox sends itself, once.
  await context.setOffline(false);
  await expect(page.getByText('1 saved change was sent.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /change pending/ })).toHaveCount(0);
  expect(await seed.hearings()).toEqual([
    { date: seed.today, outcome_note: 'Adjourned, entered offline' },
    { date: plusDays(seed.today, 7), outcome_note: null },
  ]);

  // A retry of the same key (the reply was lost) changes nothing.
  const key = crypto.randomUUID();
  const item = { key, kind: 'nextDate', payload: { caseId: seed.caseId, date: plusDays(seed.today, 30), note: '' } };
  for (let i = 0; i < 2; i++) {
    const res = await (await page.request.post('/api/offline/sync', { data: { items: [item] } })).json();
    expect(res.results).toEqual([{ key, result: 'ok' }]);
  }
  expect(await seed.hearings()).toHaveLength(3);
});
