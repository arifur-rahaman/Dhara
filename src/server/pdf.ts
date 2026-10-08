import 'server-only';
import type { Browser } from 'playwright-core';
import { env } from '@/server/env';

/**
 * HTML → PDF with headless Chromium (TECH_GUIDE section 14). The page is the app's own print view,
 * so fonts (Hind Siliguri, Tiro Bangla, self-hosted by next/font) and Bangla conjuncts match the screen.
 * One browser is reused; each PDF gets a fresh context carrying only the requester's session cookie.
 */
let browser: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browser) {
    const { chromium } = await import('playwright-core');
    browser = chromium
      .launch({ executablePath: env().PDF_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
      .catch((e) => {
        browser = null;
        throw e;
      });
  }
  return browser;
}

export async function renderPdf(url: string, cookie: { name: string; value: string }) {
  const b = await getBrowser();
  const context = await b.newContext({ colorScheme: 'light', javaScriptEnabled: false });
  try {
    const target = new URL(url);
    await context.addCookies([{ name: cookie.name, value: cookie.value, url: target.origin, httpOnly: true }]);
    const page = await context.newPage();
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });
    if (!res?.ok()) throw new Error(`Print page answered ${res?.status()}`);
    await page.locator('[data-print-ready]').waitFor({ timeout: 5_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print', colorScheme: 'light' });
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await context.close();
  }
}
