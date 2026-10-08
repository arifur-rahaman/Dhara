import { expect, test } from '@playwright/test';
import { inviteAndJoin, signUpOwner } from './helpers';

// Conjunct-heavy text (TECH_GUIDE section 14): ক্ষ, স্ত্র, ক্ষ্ম, ন্ত্র.
const ADDRESS = 'লক্ষ্মীপুর, স্ত্রীরোড, মন্ত্রী ভবন';

test('money: fees, payments with sequential receipts, dues, PDF, and who sees money (P9)', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const viewport = testInfo.project.use.viewport!;
  await signUpOwner(page, 'খান ল চেম্বার');
  const associate = await inviteAndJoin(page, browser, 'associate', viewport);

  await page.goto('/settings');
  await page.getByLabel('Address').fill(ADDRESS);
  await page.getByRole('button', { name: 'Save chamber details' }).click();
  await expect(page.getByText('Chamber details saved.')).toBeVisible();

  await page.goto('/clients/new');
  await page.getByLabel('Name').fill('Salma Begum');
  await page.getByLabel('Phone').fill('01833333333');
  await page.getByLabel('The client agreed to us keeping these details').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Salma Begum' })).toBeVisible();

  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('88');
  await page.getByLabel('Year').fill('2026');
  await page.getByLabel('Client').fill('Salma Begum');
  const options = await page.getByLabel('Assign to').locator('option').allTextContents();
  await page.getByLabel('Assign to').selectOption({ label: options.find((o) => /Test associate/.test(o))! });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  const casePath = new URL(page.url()).pathname;

  // Fee 15,000 on the case.
  await page.goto(`${casePath}?tab=fees`);
  await page.getByLabel('For', { exact: true }).fill('Hearing fee');
  await page.getByLabel('Amount (taka)').fill('15,000');
  await page.getByRole('button', { name: 'Add fee' }).click();
  await expect(page.getByText('Fee added.')).toBeVisible();

  // bKash needs a transaction ID; then receipt 0001.
  await page.getByRole('link', { name: 'Record payment' }).click();
  await expect(page).toHaveURL(/\/accounts\/pay/);
  await page.getByText('bKash', { exact: true }).click();
  await page.getByLabel('Amount (taka)').fill('5000');
  await page.getByRole('button', { name: 'Save and make receipt' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Write the bKash or Nagad transaction ID.');
  await page.getByLabel('Transaction ID').fill('8N7A6B5C4D');
  await page.getByRole('button', { name: 'Save and make receipt' }).click();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}\?new=1$/);
  const receipt = page.getByRole('article', { name: 'Receipt' });
  await expect(receipt).toContainText('Receipt no. 0001');
  await expect(receipt).toContainText('৳5,000');
  await expect(receipt).toContainText('bKash · Ref. 8N7A6B5C4D');
  await expect(receipt).toContainText(ADDRESS);
  // The paper stays white in dark mode.
  expect(await receipt.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  const receiptPath = new URL(page.url()).pathname;

  // Second payment: receipt 0002, cash.
  await page.goto(`/accounts/pay?case=${casePath.split('/').pop()}`);
  await page.getByLabel('Amount (taka)').fill('2000');
  await page.getByRole('button', { name: 'Save and make receipt' }).click();
  await expect(page.getByRole('article', { name: 'Receipt' })).toContainText('Receipt no. 0002');

  // Accounts: month collection 7,000; due 8,000.
  await page.goto('/accounts');
  await expect(page.getByText('৳7,000')).toBeVisible();
  await expect(page.getByText('৳8,000').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send a reminder to Salma Begum' })).toBeVisible();

  // PDF: real PDF with the Bangla font embedded.
  const pdf = await page.request.get(`${receiptPath}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.toString('latin1')).toMatch(/Hind[\s_-]?Siliguri/i);

  // The print view shapes conjuncts: ক্ষ is narrower as a conjunct than when forced apart with a ZWNJ.
  await page.goto(`/print${receiptPath}`);
  await page.evaluate(() => document.fonts.ready);
  const widths = await page.evaluate(() => {
    const measure = (text: string) => {
      const span = document.createElement('span');
      span.style.fontSize = '40px';
      span.textContent = text;
      document.querySelector('[data-print-ready]')!.appendChild(span);
      const w = span.getBoundingClientRect().width;
      span.remove();
      return w;
    };
    return ['ক্ষ', 'স্ত্র', 'ন্ত্র'].map((c) => [measure(c), measure(c.replaceAll('্', '্‌'))]);
  });
  for (const [joined, apart] of widths) expect(joined).toBeLessThan(apart);

  // Associate: no money until the owner allows it; then read-only.
  expect((await associate.page.goto('/accounts'))?.status()).toBe(404);
  expect((await associate.page.goto(receiptPath))?.status()).toBe(404);
  await associate.page.goto(casePath);
  await expect(associate.page.getByRole('link', { name: 'Fees' })).toHaveCount(0);
  expect((await associate.page.request.get(`${receiptPath}/pdf`)).status()).toBe(404);

  await page.goto('/team');
  await page.getByRole('link', { name: /Test associate, Associate/ }).click();
  await page.getByLabel(/Can see fees, dues and income/).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Changes saved.');

  await associate.page.goto('/accounts');
  await expect(associate.page.getByText('৳8,000').first()).toBeVisible();
  await expect(associate.page.getByRole('link', { name: 'Payment' })).toHaveCount(0);
  await expect(associate.page.getByRole('button', { name: /Send a reminder/ })).toHaveCount(0);
  expect((await associate.page.goto('/accounts/pay'))?.status()).toBe(404);
  await associate.page.goto(receiptPath);
  await expect(associate.page.getByRole('article', { name: 'Receipt' })).toContainText('Receipt no. 0001');
  await expect(associate.page.getByRole('button', { name: 'Send to client on WhatsApp' })).toHaveCount(0);
  expect(await associate.page.content()).not.toContain('1833333333');

  await associate.page.context().close();
});
