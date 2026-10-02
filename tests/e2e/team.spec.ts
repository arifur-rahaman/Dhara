import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yIssues, inviteAndJoin, signUpOwner } from './helpers';

const tabs = {
  associate: ['Today', 'Cases', 'Clients', 'AI draft', 'More'],
  munshi: ['Today', 'Cases', 'Take photo', 'More'],
  staff: ['Today', 'All tasks', 'More'],
} as const;

test('owner invites an associate, a munshi and staff; each gets the role the owner chose', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  await signUpOwner(page);
  const viewport = testInfo.project.use.viewport!;
  const mobile = testInfo.project.name.startsWith('mobile');

  for (const role of ['associate', 'munshi', 'staff'] as const) {
    const member = await inviteAndJoin(page, browser, role, viewport);
    const nav = member.page.getByRole('navigation', { name: 'Main menu' });
    await expect(nav.getByRole('link')).toHaveText([...tabs[role]]);
    if (mobile) await expectNoSeriousA11yIssues(member.page);

    // Team management is owner-only (P10), whatever the URL.
    for (const path of ['/team', '/team/invite']) {
      const response = await member.page.goto(path);
      expect(response?.status(), `${role} ${path}`).toBe(404);
    }
    if (role === 'staff') {
      for (const path of ['/clients', '/cases', '/accounts']) {
        const response = await member.page.goto(path);
        expect(response?.status(), path).toBe(404);
      }
    }
    await member.page.context().close();
  }

  await page.goto('/team');
  await expect(page.getByText('Active', { exact: true })).toHaveCount(4);
});

test('an invitation link only works for the invited number', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-light', 'one run is enough');
  await signUpOwner(page);
  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await signUpOwner(outsiderPage, 'Other Chamber');

  await page.goto('/team/invite');
  await page.getByLabel('Name').fill('Someone');
  await page.getByLabel('Mobile number').fill('01811111111');
  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.getByText('Invite sent by SMS.')).toBeVisible();

  const { readFileSync } = await import('node:fs');
  const { e2eEnv } = await import('./env');
  const lines = readFileSync(e2eEnv.SMS_OUTBOX_FILE, 'utf8').trim().split('\n');
  const sms = lines
    .map((l) => JSON.parse(l))
    .reverse()
    .find((s) => s.to === '+8801811111111');
  const path = new URL(sms.text.match(/https?:\/\/\S+/)[0]).pathname;

  await outsiderPage.goto(path);
  await expect(outsiderPage.getByRole('main').getByRole('alert')).toContainText('This invitation is for 01');
  await expect(outsiderPage.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
  await outsider.close();
});

test('two chambers never see each other: owners see only their own team', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'web-light', 'one run is enough');
  await signUpOwner(page, 'Chamber Alpha');
  const viewport = testInfo.project.use.viewport!;
  const member = await inviteAndJoin(page, browser, 'munshi', viewport);
  await member.page.context().close();

  const other = await browser.newContext({ viewport });
  const otherPage = await other.newPage();
  await signUpOwner(otherPage, 'Chamber Beta');
  await otherPage.goto('/team');
  await expect(otherPage.getByText('Test munshi')).toHaveCount(0);
  await expect(otherPage.getByText('Active', { exact: true })).toHaveCount(1);
  await other.close();
});
