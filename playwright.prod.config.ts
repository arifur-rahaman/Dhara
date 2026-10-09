import { defineConfig, devices } from '@playwright/test';
import { prodEnv } from './tests/e2e-prod/env';

/** Journeys that need a production build (run `pnpm build` first). See tests/e2e-prod/env.ts. */
const port = Number(process.env.E2E_PROD_PORT ?? 3200);

export default defineConfig({
  testDir: 'tests/e2e-prod',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
  },
  projects: [{ name: 'mobile-prod', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm exec next start --port ${port}`,
    env: { ...prodEnv, APP_URL: `http://localhost:${port}` },
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
