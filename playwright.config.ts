import { defineConfig, devices } from '@playwright/test';
import { e2eEnv } from './tests/e2e/env';

const port = Number(process.env.E2E_PORT ?? 3100);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const sizes = {
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  web: { viewport: { width: 1280, height: 860 } },
};

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  // Every journey at 390px and 1280px, in light and dark (TECH_GUIDE section 20).
  projects: (['mobile', 'web'] as const).flatMap((size) =>
    (['light', 'dark'] as const).map((colorScheme) => ({
      name: `${size}-${colorScheme}`,
      use: { ...devices['Desktop Chrome'], ...sizes[size], colorScheme },
    })),
  ),
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    env: { ...e2eEnv, APP_URL: `http://localhost:${port}` },
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
