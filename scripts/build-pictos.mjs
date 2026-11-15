// Extrait les pictos du catalogue (@cresus/shared, construit) depuis le jeu Fluent Emoji (Microsoft, licence MIT)
// vers apps/web/public/pictos/<clé>.svg, avec la licence. À relancer après une modification du catalogue : npm run pictos
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PICTOS } from '../packages/shared/dist/index.js';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'apps/web/public/pictos');
const set = JSON.parse(readFileSync(require.resolve('@iconify-json/fluent-emoji/icons.json'), 'utf8'));

const missing = PICTOS.filter((picto) => !set.icons[picto.key]).map((picto) => picto.key);
if (missing.length > 0) {
  console.error(`Pictos absents du jeu Fluent Emoji : ${missing.join(', ')}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const keys = new Set(PICTOS.map((picto) => picto.key));
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.svg') && !keys.has(file.slice(0, -4))) rmSync(join(outDir, file));
}

let bytes = 0;
for (const { key } of PICTOS) {
  const icon = set.icons[key];
  const left = icon.left ?? set.left ?? 0;
  const top = icon.top ?? set.top ?? 0;
  const width = icon.width ?? set.width ?? 32;
  const height = icon.height ?? set.height ?? 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}">${icon.body}</svg>\n`;
  writeFileSync(join(outDir, `${key}.svg`), svg);
  bytes += svg.length;
}

writeFileSync(
  join(outDir, 'LICENSE.txt'),
  `Pictos : Fluent Emoji, https://github.com/microsoft/fluentui-emoji
Extraits via le paquet npm @iconify-json/fluent-emoji.

MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
);
console.log(`${PICTOS.length} pictos écrits dans apps/web/public/pictos (${Math.round(bytes / 1024)} ko)`);
