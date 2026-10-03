import { expect, test } from '@playwright/test';
import { inviteAndJoin, signUpOwner } from './helpers';

const todayDhaka = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

test('cases journey: owner adds, associate sees only assigned without contact, munshi adds next date, staff sees court list', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const viewport = testInfo.project.use.viewport!;
  await signUpOwner(page);
  const associate = await inviteAndJoin(page, browser, 'associate', viewport);
  const munshi = await inviteAndJoin(page, browser, 'munshi', viewport);
  const staff = await inviteAndJoin(page, browser, 'staff', viewport);

  // Owner adds a client with contact (owner-only, with consent).
  await page.goto('/clients/new');
  await page.getByLabel('Name').fill('E2E Client');
  await page.getByLabel('Phone').fill('01811111111');
  await page.getByLabel('NID').fill('1234567890');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('client agreed');
  await page.getByLabel('The client agreed to us keeping these details').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Client' })).toBeVisible();
  await expect(page.getByText('01811-111111')).toBeVisible();

  // Case 245 assigned to the associate, with a hearing today; case 310 stays with the owner.
  const addCase = async (number: string, assignee: RegExp) => {
    await page.goto('/cases/new');
    await page.getByLabel('Number').fill(number);
    await page.getByLabel('Year').fill('2026');
    await page.getByLabel('Client').fill('E2E Client');
    await page.getByLabel('Assign to').selectOption({
      label: (await page.getByLabel('Assign to').locator('option').allTextContents()).find((o) => assignee.test(o))!,
    });
    await page.getByLabel('Next date').fill(todayDhaka());
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
    return page.url();
  };
  const case245 = await addCase('245', /Test associate/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Civil Suit 245/2026');
  await expect(page.getByText('Joint District Judge Court, Chattogram')).toBeVisible();
  await addCase('310', /^You$/);

  // Associate: only the assigned case; client contact locked and absent from the page.
  await associate.page.goto('/cases');
  await expect(associate.page.getByRole('main').getByRole('link', { name: /Civil Suit/ })).toHaveCount(1);
  await expect(associate.page.getByText('Civil Suit 245/2026')).toBeVisible();
  await associate.page.getByText('E2E Client').first().click();
  await associate.page.goto('/clients');
  await associate.page.getByRole('link', { name: /E2E Client/ }).click();
  await expect(associate.page.getByText('Contact info is private')).toBeVisible();
  const html = await associate.page.content();
  expect(html).not.toContain('1811111111');
  expect(html).not.toContain('1234567890');
  expect((await associate.page.goto(case245.replace(/[^/]+$/, '') + 'does-not-exist'))?.status()).toBe(404);

  // Munshi: both cases today; adds the next date with what happened.
  await munshi.page.goto('/today');
  await expect(munshi.page.getByRole('link', { name: 'Add next date' })).toHaveCount(2);
  await munshi.page.goto(`${new URL(case245).pathname}/next-date`);
  await munshi.page.getByRole('button', { name: 'In 7 days' }).click();
  await munshi.page.getByLabel('What happened today').fill('Time petition allowed');
  await munshi.page.getByRole('button', { name: /^Save / }).click();
  await expect(munshi.page.getByRole('status')).toContainText('Next date saved');

  // Owner sees it at once in the timeline, with who added it.
  await page.goto(case245);
  await expect(page.getByText('Time petition allowed')).toBeVisible();
  await expect(page.getByText('Added by Test munshi')).toBeVisible();

  // Staff: court, case number and serial only; no client names; no case or client screens.
  await staff.page.goto('/today');
  await expect(staff.page.getByText('Which court today')).toBeVisible();
  await expect(staff.page.getByText(/Civil Suit 245\/2026/)).toBeVisible();
  expect(await staff.page.content()).not.toContain('E2E Client');
  for (const path of ['/cases', '/clients', new URL(case245).pathname, '/calendar']) {
    expect((await staff.page.goto(path))?.status(), path).toBe(404);
  }

  for (const member of [associate, munshi, staff]) await member.page.context().close();
});

test('next-date sheet fits a 390px screen and works with one hand', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone layout');
  await signUpOwner(page);
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('77');
  await page.getByLabel('Year').fill('২০২৬');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Civil Suit 77/২০২৬');
  await page.getByRole('link', { name: 'Add next date' }).click();
  const sheet = page.getByRole('region', { name: 'Add next date' });
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(390);
  for (const button of await sheet.getByRole('button', { name: /In 7 days|In 14 days|In 1 month|Other date/ }).all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await sheet.getByRole('button', { name: 'In 14 days' }).click();
  await sheet.getByRole('button', { name: /^Save / }).click();
  await expect(page.getByRole('status')).toContainText('Next date saved');
});

test('an empty chamber shows the empty state with a way to add the first case', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-light', 'one run is enough');
  await signUpOwner(page);
  await page.goto('/cases');
  await expect(page.getByRole('heading', { name: 'No cases yet' })).toBeVisible();
  await page.getByRole('link', { name: 'Add first case' }).click();
  await expect(page).toHaveURL(/\/cases\/new$/);
});

test('owner edits, closes and deletes a case; an associate cannot delete', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'web-light', 'one run is enough');
  await signUpOwner(page);
  const associate = await inviteAndJoin(page, browser, 'associate', testInfo.project.use.viewport!);
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('900');
  await page.getByLabel('Year').fill('2026');
  const options = await page.getByLabel('Assign to').locator('option').allTextContents();
  await page.getByLabel('Assign to').selectOption({ label: options.find((o) => /Test associate/.test(o))! });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  const caseUrl = page.url();

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Number').fill('901');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Civil Suit 901/2026');

  // The associate can edit their case but has no delete.
  await associate.page.goto(`${new URL(caseUrl).pathname}/edit`);
  await expect(associate.page.getByLabel('Number')).toHaveValue('901');
  await expect(associate.page.getByRole('button', { name: 'Delete case' })).toHaveCount(0);
  await expect(associate.page.getByLabel('Assign to')).toHaveCount(0);
  await associate.page.context().close();

  await page.goto(`${new URL(caseUrl).pathname}/edit`);
  await page.getByRole('button', { name: 'Delete case' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Tick the box');
  await page.getByLabel(/Yes, delete this case/).check();
  await page.getByRole('button', { name: 'Delete case' }).click();
  await expect(page).toHaveURL(/\/cases$/);
  expect((await page.goto(caseUrl))?.status()).toBe(404);
});
