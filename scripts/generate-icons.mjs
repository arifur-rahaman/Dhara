// Renders the placeholder app icons (until a logo exists) with headless Chromium.
// Run: TITLE_FONT_FILE=/path/to/TiroBangla.woff2 node scripts/generate-icons.mjs
// (set PLAYWRIGHT_CHROMIUM_PATH to use a local Chromium)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const fontFile = process.env.TITLE_FONT_FILE;
if (!fontFile) throw new Error('Set TITLE_FONT_FILE to a Tiro Bangla font file');
const font = readFileSync(fontFile).toString('base64');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();

const icons = [
  { file: 'icon-192.png', size: 192, inset: 0, radius: 0.22 },
  { file: 'icon-512.png', size: 512, inset: 0, radius: 0.22 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0, radius: 0, glyph: 0.45 },
];

for (const { file, size, radius, glyph = 0.6 } of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><head>
    <style>@font-face{font-family:'Tiro Bangla';src:url(data:font/woff2;base64,${font}) format('woff2')}
    html,body{margin:0;background:transparent}
    div{width:${size}px;height:${size}px;border-radius:${radius * size}px;background:#2F4FA3;color:#fff;
    display:flex;align-items:center;justify-content:center;font:${glyph * size}px/1 'Tiro Bangla',serif}</style>
    </head><body><div>ধ</div></body></html>`);
  await page.evaluate(async () => {
    await document.fonts.load("100px 'Tiro Bangla'", 'ধ');
    await document.fonts.ready;
  });
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: true });
}

await browser.close();
console.log('icons written to public/icons/ (copy icon-192.png to src/app/icon.png)');
