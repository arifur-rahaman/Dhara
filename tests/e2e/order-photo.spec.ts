import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, inviteAndJoin, signUpOwner } from './helpers';

const todayDhaka = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
const plusDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test('order photo (F37): off until the owner allows it; the munshi checks what was read, then saves date and photo', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  await signUpOwner(page);
  const munshi = await inviteAndJoin(page, browser, 'munshi', testInfo.project.use.viewport!);

  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('517');
  await page.getByLabel('Year').fill('2026');
  await page.getByLabel('Next date').fill(todayDhaka());
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  const casePath = new URL(page.url()).pathname;

  // Off by default: the munshi is told to ask the owner.
  await munshi.page.goto('/photo');
  await expect(munshi.page.getByText('The owner can turn it on in Settings.')).toBeVisible();

  await page.goto('/settings');
  const ai = page.getByRole('region', { name: 'AI' });
  await expect(ai.getByText('Off')).toBeVisible();
  await ai.getByRole('button', { name: 'Turn on' }).click();
  await expect(ai.getByText('On', { exact: true })).toBeVisible();

  await munshi.page.goto('/photo');
  await expect(munshi.page.getByLabel('Case')).toContainText('Civil Suit 517/2026');
  await expectNoSeriousA11yIssues(munshi.page);

  // A photo made in the browser (the fake AI provider in tests does not look at the pixels).
  const png = await munshi.page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 400, 300);
    g.fillStyle = '#000';
    g.fillText('Next date 12/11/2026', 20, 40);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await munshi.page
    .getByLabel('Take photo of the order')
    .setInputFiles({ name: 'order.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });

  const found = munshi.page.getByRole('region', { name: 'What the AI found' });
  const expected = plusDays(todayDhaka(), 30);
  await expect(found.getByLabel('Next date')).toHaveValue(expected);
  await expect(found.getByLabel('Order summary')).toHaveValue("Plaintiff's time petition allowed");
  await expect(found.getByText('Handwriting can be misread.')).toBeVisible();
  await expectNoSeriousA11yIssues(munshi.page);

  // The person can correct the summary before saving.
  await found.getByLabel('Order summary').fill('Time petition allowed; next date fixed');
  await found.getByRole('button', { name: 'Save date and photo' }).click();
  await expect(munshi.page).toHaveURL(new RegExp(`${casePath}\\?saved=${expected}$`));

  await page.goto(casePath);
  await expect(page.getByText('Time petition allowed; next date fixed')).toBeVisible();
  await page.goto(`${casePath}?tab=documents`);
  await expect(
    page
      .getByRole('main')
      .getByText(/^Order /)
      .first(),
  ).toBeVisible();
});
