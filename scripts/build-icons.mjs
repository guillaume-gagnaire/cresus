// Rend les icônes PNG de la PWA (192, 512 et « maskable » 512) depuis apps/web/public/favicon.svg, avec le Chromium
// de Playwright (pas de dépendance d'image). À relancer si le logo change : node scripts/build-icons.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const svg = readFileSync(join(root, 'apps/web/public/favicon.svg'), 'utf8');
const out = join(root, 'apps/web/public/icons');

const page = (size, maskable) => `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:${maskable ? '#CF3519' : 'transparent'};display:flex;align-items:center;justify-content:center">
<div style="width:${maskable ? Math.round(size * 0.72) : size}px;height:${maskable ? Math.round(size * 0.72) : size}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`;

const browser = await chromium.launch();
for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]]) {
  const tab = await browser.newPage({ viewport: { width: size, height: size } });
  await tab.setContent(page(size, maskable));
  await tab.screenshot({ path: join(out, name), omitBackground: !maskable });
  await tab.close();
}
await browser.close();
console.log('icônes écrites dans apps/web/public/icons');
