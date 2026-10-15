import { expect, test } from '@playwright/test';
import { signUpOwner } from './helpers';

test('two-step is optional: an owner can turn it off from Settings with a recovery code', async ({ page }) => {
  test.slow();
  const { recoveryCodes } = await signUpOwner(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Turn off' }).click();
  await page.getByLabel('Enter a code from your authenticator app, or one recovery code.').fill('000000');
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await page.getByLabel('Enter a code from your authenticator app, or one recovery code.').fill(recoveryCodes[0]);
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(
    page.getByText('Optional. Adds a second check with an authenticator app when you sign in.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Turn on' })).toBeVisible();
});
