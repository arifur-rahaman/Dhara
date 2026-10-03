import { expect, test } from '@playwright/test';
import { createAdmin, expectNoSeriousA11yIssues, inviteAndJoin, signInAdmin, signUpOwner } from './helpers';

const todayDhaka = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

test('team: owner adjusts an associate, gives a task to staff, removes a member; others cannot manage', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const viewport = testInfo.project.use.viewport!;
  await signUpOwner(page);
  const associate = await inviteAndJoin(page, browser, 'associate', viewport);
  const staff = await inviteAndJoin(page, browser, 'staff', viewport);

  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Permissions by role' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Client phone, email, NID, address' })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  // Adjustable rules: case scope and fee visibility for one associate.
  await page.getByRole('link', { name: /Test associate, Associate/ }).click();
  await page.getByText('All cases', { exact: true }).click();
  await page.getByLabel(/Can see fees, dues and income/).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Changes saved.');
  await expect(page.getByText('Associate · All cases · Can see fees')).toBeVisible();

  // Tasks (P11): owner assigns, staff sees and ticks it off on Today.
  await page.goto('/tasks');
  await page.getByLabel('Task', { exact: true }).fill('Take the 245 file to court 2');
  await page.getByLabel('Who').selectOption({ label: 'Test staff · Office staff' });
  await page.getByLabel('By (optional)').fill(todayDhaka());
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('status')).toHaveText('Task added.');
  await expect(page.getByText('Take the 245 file to court 2')).toBeVisible();

  await staff.page.goto('/today');
  await staff.page.getByRole('button', { name: 'Mark done: Take the 245 file to court 2' }).click();
  await expect(staff.page.getByRole('button', { name: 'Mark not done: Take the 245 file to court 2' })).toBeVisible();

  // The associate sees neither the team page nor the staff member's task.
  expect((await associate.page.goto('/team'))?.status()).toBe(404);
  expect((await associate.page.goto('/team/activity'))?.status()).toBe(404);
  expect((await associate.page.goto('/support'))?.status()).toBe(404);
  await associate.page.goto('/tasks');
  await expect(associate.page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
  await expect(associate.page.getByText('Take the 245 file to court 2')).toHaveCount(0);
  await expect(associate.page.getByRole('heading', { name: 'Give a task' })).toHaveCount(0);

  // Removing needs the tick; afterwards the member cannot open the chamber.
  await page.goto('/team');
  await page.getByRole('link', { name: /Test staff, Office staff/ }).click();
  await page.getByRole('button', { name: 'Remove member' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Tick the box to confirm.');
  await page.getByLabel('Yes, remove this member').check();
  await page.getByRole('button', { name: 'Remove member' }).click();
  await expect(page.getByRole('status')).toContainText('Member removed');
  await staff.page.goto('/today');
  await expect(staff.page).toHaveURL(/\/onboarding/);

  // Every change is in the owner's activity log.
  await page.goto('/team/activity');
  for (const text of ["changed a member's permissions", 'removed a member', 'sent an invite']) {
    await expect(page.getByText(text).first()).toBeVisible();
  }

  for (const member of [associate, staff]) await member.page.context().close();
});

test('admin portal: account data only; support access needs the owner, lasts until revoked, and is logged', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  test.skip(!testInfo.project.name.startsWith('web'), 'the admin portal is a desktop screen');
  const chamberName = `Admin Test Chamber ${Date.now()}`;
  await signUpOwner(page, chamberName);

  // A client with contact and one case.
  await page.goto('/clients/new');
  await page.getByLabel('Name').fill('Secret Client E2E');
  await page.getByLabel('Phone').fill('01822222222');
  await page.getByLabel('The client agreed to us keeping these details').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Secret Client E2E' })).toBeVisible();
  await page.goto('/cases/new');
  await page.getByLabel('Number').fill('245');
  await page.getByLabel('Year').fill('2026');
  await page.getByLabel('Client').fill('Secret Client E2E');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);

  // Wrong code: refused with the same message as a wrong password.
  const admin = createAdmin();
  const adminContext = await browser.newContext({ viewport: testInfo.project.use.viewport! });
  const ap = await adminContext.newPage();
  expect((await ap.goto('/admin/chambers'))?.url()).toMatch(/\/admin\/login$/);
  await ap.getByLabel('Mobile number').fill(admin.phone);
  await ap.getByLabel('Password').fill(admin.password);
  await ap.getByLabel('Authenticator code').fill('000000');
  await ap.getByRole('button', { name: 'Sign in' }).click();
  await expect(ap.getByRole('main').getByRole('alert')).toContainText('did not match');
  await signInAdmin(ap, admin);

  await ap.goto(`/admin/chambers?q=${encodeURIComponent(chamberName)}`);
  await expect(ap.getByRole('link', { name: new RegExp(chamberName) })).toBeVisible();
  await expectNoSeriousA11yIssues(ap);
  await ap.getByRole('link', { name: new RegExp(chamberName) }).click();
  await expect(ap.getByRole('heading', { level: 1, name: chamberName })).toBeVisible();
  expect(await ap.content()).not.toContain('Secret Client E2E');
  expect(await ap.content()).not.toContain('1822222222');

  // Plan and payment.
  await ap.getByLabel('Plan', { exact: true }).selectOption('chamber');
  await ap.getByRole('button', { name: 'Save plan' }).click();
  await expect(ap.getByText('Plan saved.')).toBeVisible();
  await ap.getByLabel('Amount (taka)').fill('1500');
  await ap.getByRole('button', { name: 'Record payment' }).click();
  await expect(ap.getByText('Payment recorded.')).toBeVisible();
  await expect(ap.getByText('৳1,500')).toBeVisible();

  // Request support; nothing is visible before the owner approves.
  await ap.getByLabel('Reason').fill('Owner reported dates not syncing');
  await ap.getByRole('button', { name: 'Send request' }).click();
  await expect(ap.getByText('A request is already waiting or open for this chamber.')).toBeVisible();
  const chamberUrl = ap.url();
  const chamberId = chamberUrl.split('/').pop()!;
  await ap.goto(`/admin/support/${chamberId}`);
  await expect(ap.getByRole('main').getByRole('alert')).toContainText('no approved');

  // Owner approves for 24 hours.
  await page.goto('/today');
  await page.getByRole('link', { name: 'Platform support is asking for access' }).click();
  await expect(page.getByText('Owner reported dates not syncing')).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole('button', { name: 'Approve for 24 hours' }).click();
  await expect(page.getByText(`${admin.name} has support access now`)).toBeVisible();

  // Support view: case number only, no client.
  await ap.goto(`/admin/support/${chamberId}`);
  await expect(ap.getByRole('cell', { name: 'Civil Suit 245/2026' })).toBeVisible();
  expect(await ap.content()).not.toContain('Secret Client E2E');
  expect(await ap.content()).not.toContain('1822222222');

  // Owner ends it early; the view closes at once.
  await page.getByRole('button', { name: 'End access now' }).click();
  await expect(page.getByText('Earlier requests')).toBeVisible();
  await ap.reload();
  await expect(ap.getByRole('main').getByRole('alert')).toContainText('no approved');

  // Both logs have it.
  await page.goto('/team/activity');
  await expect(page.getByText('viewed case numbers and dates (support)').first()).toBeVisible();
  await expect(page.getByText('asked for support access').first()).toBeVisible();
  await ap.goto('/admin/audit');
  await expect(ap.getByRole('cell', { name: 'Opened the support view' }).first()).toBeVisible();

  // Sign-out ends the session.
  await ap.getByRole('button', { name: 'Log out' }).click();
  await expect(ap).toHaveURL(/\/admin\/login$/);
  expect((await ap.goto('/admin/dashboard'))?.url()).toMatch(/\/admin\/login$/);
  await adminContext.close();
});
