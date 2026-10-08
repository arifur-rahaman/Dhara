import { expect, test } from '@playwright/test';
import { inviteAndJoin, signUpOwner } from './helpers';

// A tiny real PDF and a non-PDF pretending to be one.
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);
const fake = Buffer.from('MZ this is not a pdf at all');

const doc = (p: import('@playwright/test').Page, title: string) =>
  p
    .getByRole('main')
    .getByRole('listitem')
    .getByRole('link', { name: new RegExp(`^${title}`) });

async function addCase(page: import('@playwright/test').Page, number: string, assignee: RegExp) {
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill(number);
  await page.getByLabel('Year').fill('2026');
  const options = await page.getByLabel('Assign to').locator('option').allTextContents();
  await page.getByLabel('Assign to').selectOption({ label: options.find((o) => assignee.test(o))! });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

test('documents: upload, private flag, file check, and who sees what (P5, P6)', async ({ page, browser }, testInfo) => {
  test.slow();
  const viewport = testInfo.project.use.viewport!;
  await signUpOwner(page);
  const associate = await inviteAndJoin(page, browser, 'associate', viewport);
  const munshi = await inviteAndJoin(page, browser, 'munshi', viewport);
  const casePath = await addCase(page, '245', /Test associate/);

  // Owner adds a pleading and a private note.
  await page.goto(`${casePath}?tab=documents`);
  await expect(page.getByText('No documents yet.')).toBeVisible();
  const addFile = async (
    p: typeof page,
    name: string,
    body: Buffer,
    opts: { kind?: string; title: string; private?: boolean },
  ) => {
    await p.getByLabel('Add file').setInputFiles({ name, mimeType: 'application/pdf', buffer: body });
    await p.getByLabel('Name', { exact: true }).fill(opts.title);
    if (opts.kind) await p.getByLabel('Type', { exact: true }).selectOption({ label: opts.kind });
    if (opts.private) await p.getByLabel(/^Private/).check();
    await p.getByRole('button', { name: 'Upload' }).click();
  };
  await addFile(page, 'plaint.pdf', pdf, { title: 'Plaint', kind: 'Plaints and replies' });
  await expect(page.getByRole('status')).toHaveText('Document added.');
  await expect(doc(page, 'Plaint')).toBeVisible();
  await addFile(page, 'strategy.pdf', pdf, { title: 'Hearing strategy', private: true });
  await expect(doc(page, 'Hearing strategy')).toBeVisible();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();

  // A file that is not what it claims is refused after upload and never listed.
  await addFile(page, 'virus.pdf', fake, { title: 'Fake' });
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Only PDF, JPG and PNG files can be added.');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.reload();
  await expect(doc(page, 'Fake')).toHaveCount(0);

  // Opening goes through a permission check and a short-lived signed URL.
  const res = await page.request.get((await doc(page, 'Plaint').getAttribute('href'))!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('application/pdf');
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const strategyHref = (await doc(page, 'Hearing strategy').getAttribute('href'))!;

  // Associate (assigned): sees the pleading, not the owner's private note, and cannot open it by URL.
  await associate.page.goto(`${casePath}?tab=documents`);
  await expect(doc(associate.page, 'Plaint')).toBeVisible();
  await expect(doc(associate.page, 'Hearing strategy')).toHaveCount(0);
  expect((await associate.page.request.get(strategyHref, { maxRedirects: 0 })).status()).toBe(404);

  // Munshi: orders only; uploads as an order without a type choice.
  await munshi.page.goto(`${casePath}?tab=documents`);
  await expect(doc(munshi.page, 'Plaint')).toHaveCount(0);
  await munshi.page
    .getByLabel('Add file')
    .setInputFiles({ name: 'order.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(munshi.page.getByLabel('Type', { exact: true })).toHaveCount(0);
  await expect(munshi.page.getByLabel(/^Private/)).toHaveCount(0);
  await munshi.page.getByLabel('Name', { exact: true }).fill('Order 14 Sep');
  await munshi.page.getByRole('button', { name: 'Upload' }).click();
  await expect(doc(munshi.page, 'Order 14 Sep')).toBeVisible();

  // Owner sees all three, filters to orders, and removes one (audited).
  await page.goto(`${casePath}?tab=documents&kind=order`);
  await expect(doc(page, 'Order 14 Sep')).toBeVisible();
  await expect(doc(page, 'Plaint')).toHaveCount(0);
  await page.goto('/documents');
  await expect(doc(page, 'Hearing strategy')).toBeVisible();
  await page.goto(`${casePath}?tab=documents`);
  await page.getByLabel('More for Plaint').click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(doc(page, 'Plaint')).toHaveCount(0);
  await page.goto('/team/activity');
  await expect(page.getByText('removed a document')).toBeVisible();

  for (const m of [associate, munshi]) await m.page.context().close();
});
