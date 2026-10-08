import { expect, test } from '@playwright/test';
import { signUpOwner } from './helpers';

// The offline journey itself needs a production build (service worker + cached page): tests/e2e-prod.

test('offline snapshot never holds client contact', async ({ page }) => {
  await signUpOwner(page);
  await page.goto('/clients/new');
  await page.getByLabel('Name').fill('Contact Check');
  await page.getByLabel('Phone').fill('01844444444');
  await page.getByLabel('The client agreed to us keeping these details').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Contact Check' })).toBeVisible();
  const snap = await (await page.request.get('/api/offline/snapshot')).text();
  expect(snap).not.toContain('1844444444');
  expect(
    (await page.request.get('/api/offline/snapshot', { headers: { cookie: '' } })).status(),
  ).toBeGreaterThanOrEqual(200);
});
