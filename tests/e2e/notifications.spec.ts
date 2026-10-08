import { expect, test } from '@playwright/test';
import { inviteAndJoin, signUpOwner } from './helpers';

test('notifications: next date by the munshi reaches the owner; reminder times are saved', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const viewport = testInfo.project.use.viewport!;
  await signUpOwner(page);
  const munshi = await inviteAndJoin(page, browser, 'munshi', viewport);

  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('245');
  await page.getByLabel('Year').fill('2026');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  const casePath = new URL(page.url()).pathname;

  await munshi.page.goto(`${casePath}/next-date`);
  await munshi.page.getByRole('button', { name: 'In 7 days' }).click();
  await munshi.page.getByRole('button', { name: /^Save / }).click();
  await expect(munshi.page.getByRole('status')).toContainText('Next date saved');

  await page.goto('/notifications');
  const notice = page.getByRole('link', { name: /Test munshi added the next date for Civil Suit 245\/2026/ });
  await expect(notice).toBeVisible();
  await expect(page.getByLabel('Unread')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(page.getByLabel('Unread')).toHaveCount(0);
  await notice.click();
  await expect(page).toHaveURL(new RegExp(`${casePath}$`));

  // The munshi gets no notice for their own change.
  await munshi.page.goto('/notifications');
  await expect(munshi.page.getByText('No notifications yet.')).toBeVisible();

  // Reminder switches and times (Settings design).
  await page.goto('/settings');
  await expect(page.getByRole('switch', { name: 'The night before' })).toBeChecked();
  await page.getByRole('switch', { name: 'The night before' }).uncheck();
  await page.getByLabel('In the morning · Time').fill('06:30');
  await page.getByRole('button', { name: 'Save reminders' }).click();
  await expect(page.getByText('Reminders saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'The night before' })).not.toBeChecked();
  await expect(page.getByLabel('In the morning · Time')).toHaveValue('06:30');
  await expect(page.getByText(/never names or case details/)).toBeVisible();

  await munshi.page.context().close();
});
