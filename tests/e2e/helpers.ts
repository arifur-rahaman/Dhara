import AxeBuilder from '@axe-core/playwright';
import { expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { generate } from 'otplib';
import { e2eEnv } from './env';

export type Role = 'owner' | 'associate' | 'munshi' | 'staff';

/** A unique, valid Bangladeshi mobile number for each test person. */
export function randomPhone() {
  return `01${7 + Math.floor(Math.random() * 3)}${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

const e164 = (local: string) => `+88${local}`;

async function lastSms(phone: string, match: RegExp, after: number): Promise<RegExpMatchArray> {
  for (let i = 0; i < 50; i++) {
    const lines = readFileSync(e2eEnv.SMS_OUTBOX_FILE, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of lines.reverse()) {
      const sms = JSON.parse(line) as { to: string; text: string; at: string };
      if (sms.to === e164(phone) && Date.parse(sms.at) >= after) {
        const m = sms.text.match(match);
        if (m) return m;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No SMS to ${phone} matching ${match}`);
}

/** Phone + OTP sign-in. Returns once the code is accepted. */
export async function signInWithOtp(page: Page, phone: string) {
  if (!page.url().endsWith('/login')) await page.goto('/login');
  const sentAfter = Date.now() - 1000;
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  const [code] = await lastSms(phone, /\d{6}/, sentAfter);
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function agreeToPrivacyNotice(page: Page) {
  await expect(page.getByRole('heading', { name: 'Before we start' })).toBeVisible();
  await page.getByLabel('I have read this and agree').check();
  await page.getByRole('button', { name: 'Next step' }).click();
}

/** New owner: OTP → consent → chamber → two-step setup. Ends on Today. */
export async function signUpOwner(page: Page, chamberName = `Test Chamber ${Date.now()}`) {
  const phone = randomPhone();
  await signInWithOtp(page, phone);
  await agreeToPrivacyNotice(page);
  await page.getByLabel('Chamber name').fill(chamberName);
  await page.getByLabel('Your name').fill('Advocate Test Owner');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page).toHaveURL(/\/onboarding\/next/);
  await page.getByRole('link', { name: 'Later' }).click();

  // Owners must turn on two-step verification before using the app.
  await expect(page).toHaveURL(/\/security\/two-step/);
  await page.getByRole('button', { name: 'Start setup' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('6-digit code from the app').fill(await generate({ secret }));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByText('Two-step verification is on')).toBeVisible();
  const recoveryCodes = await page.getByTestId('recovery-code').allTextContents();
  await page.getByRole('link', { name: 'I saved them, continue' }).click();
  await expect(page).toHaveURL(/\/today$/);
  return { phone, secret, recoveryCodes, chamberName };
}

/** Owner invites a member; the member opens the SMS link in their own browser and joins. */
export async function inviteAndJoin(
  ownerPage: Page,
  browser: Browser,
  role: Exclude<Role, 'owner'>,
  viewport: { width: number; height: number },
) {
  const phone = randomPhone();
  await ownerPage.goto('/team/invite');
  await ownerPage.getByLabel('Name').fill(`Test ${role}`);
  await ownerPage.getByLabel('Mobile number').fill(phone);
  const roleLabel = { associate: 'Associate', munshi: 'Munshi', staff: 'Office staff or peon' }[role];
  await ownerPage.getByRole('radio', { name: new RegExp(`^${roleLabel}`) }).check();
  const sentAfter = Date.now() - 1000;
  await ownerPage.getByRole('button', { name: 'Send invite' }).click();
  await expect(ownerPage.getByText('Invite sent by SMS.')).toBeVisible();
  const [link] = await lastSms(phone, /https?:\/\/\S+\/invite\/[\w-]+/, sentAfter);

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(new URL(link).pathname);
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInWithOtp(page, phone);
  await expect(page).toHaveURL(/\/invite\//);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await agreeToPrivacyNotice(page);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(/\/today$/);
  return { page, phone };
}

export async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
