// Renders the app icons (book mark from docs/design) with headless Chromium.
// Run: node scripts/generate-icons.mjs   (set PLAYWRIGHT_CHROMIUM_PATH to use a local Chromium)
// Then copy public/icons/icon-192.png to src/app/icon.png and apple-touch-icon.png to src/app/apple-icon.png.
import { chromium } from '@playwright/test';

const book = 'M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10.5';

const icons = [
  { file: 'icon-192.png', size: 192, radius: 0.22, glyph: 0.5 },
  { file: 'icon-512.png', size: 512, radius: 0.22, glyph: 0.5 },
  // Maskable icons keep the mark inside the central safe zone.
  { file: 'icon-maskable-512.png', size: 512, radius: 0, glyph: 0.4 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, glyph: 0.5 },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();

for (const { file, size, radius, glyph } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const g = Math.round(size * glyph);
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    div{width:${size}px;height:${size}px;border-radius:${radius * size}px;background:#2F4FA3;color:#fff;
    display:flex;align-items:center;justify-content:center}
    </style></head><body><div>
    <svg width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"><path d="${book}"/></svg>
    </div></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: true });
}

await browser.close();
console.log('icons written to public/icons/');
