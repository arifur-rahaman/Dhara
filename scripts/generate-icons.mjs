// Renders the app icons (Pocket Chamber logo: a document in a pocket) with headless Chromium.
// Run: node scripts/generate-icons.mjs   (set PLAYWRIGHT_CHROMIUM_PATH to use a local Chromium)
// Then copy public/icons/favicon-64.png to src/app/icon.png and apple-touch-icon.png to src/app/apple-icon.png.
import { chromium } from '@playwright/test';

// Same path as `brand` in src/components/icons.tsx.
const mark =
  'M7.2 8.9V4.3a1.2 1.2 0 0 1 1.2-1.2h5.2l3.2 3.2v2.6M13.6 3.1v2.2a1 1 0 0 0 1 1h2.2M7.2 7.3H6.2A1.2 1.2 0 0 0 5 8.5v8a2 2 0 0 0 1 1.73l5 2.9a2 2 0 0 0 2 0l5-2.9a2 2 0 0 0 1-1.73v-8a1.2 1.2 0 0 0-1.2-1.2h-1M5 8.9h14';

const icons = [
  { file: 'icon-192.png', size: 192, radius: 0.22, glyph: 0.58 },
  { file: 'icon-512.png', size: 512, radius: 0.22, glyph: 0.58 },
  // Maskable icons keep the mark inside the central safe zone.
  { file: 'icon-maskable-512.png', size: 512, radius: 0, glyph: 0.46 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, glyph: 0.58 },
  // Browser tab icon: a thicker line so it still reads at 16 px.
  { file: 'favicon-64.png', size: 64, radius: 0.22, glyph: 0.7, stroke: 2.2 },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();

for (const { file, size, radius, glyph, stroke = 1.4 } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const g = Math.round(size * glyph);
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    div{width:${size}px;height:${size}px;border-radius:${radius * size}px;background:#2F4FA3;color:#fff;
    display:flex;align-items:center;justify-content:center}
    </style></head><body><div>
    <svg width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}"
      stroke-linecap="round" stroke-linejoin="round"><path d="${mark}"/></svg>
    </div></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: true });
}

await browser.close();
console.log('icons written to public/icons/');
