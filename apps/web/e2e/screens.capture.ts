import { randomUUID } from 'node:crypto';
import { test } from './fixtures';
import { eventWithArticles, freshAccount } from './helpers';

// Captures pour la revue visuelle (pas un test) : npx playwright test e2e/screens.capture.ts --config playwright.capture.config.ts
const OUT = '.impeccable/review';

test('captures', async ({ page }, info) => {
  const tag = info.project.name;
  await freshAccount(page, 'APE Jules Ferry');
  const { eventId, articleIds } = await eventWithArticles(page, [
    ['Crêpe nutella', 250], ['Gaufre', 250], ['Hot-dog', 300], ['Frites', 200],
    ['Soda', 150], ['Jus de pomme', 100], ['Café', 100], ['Ticket tombola', 200],
  ], 'Fête de l’école', '2026-06-27');
  const counts = [42, 18, 31, 27, 37, 22, 25, 63];
  const prices = [250, 250, 300, 200, 150, 100, 100, 200];
  const base = Date.now() - 4 * 3600 * 1000;
  const ops = counts.flatMap((n, i) => Array.from({ length: n }, (_, k) => ({ op: 'sale', id: randomUUID(), articleId: articleIds[i], priceCents: prices[i], soldAt: new Date(base + (k * 211_000 + i * 97_000) % (4 * 3600 * 1000)).toISOString() })));
  await page.request.post(`/api/events/${eventId}/sync`, { data: { ops } });
  await eventWithArticles(page, [], 'Marché de Noël', '2026-12-12');

  await page.goto(`/evenements/${eventId}`);
  await page.getByRole('button', { name: /^Vendre Ticket tombola/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${tag}-caisse.png` });
  if (tag === 'tablet') return;
  await page.goto('/');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${tag}-evenements.png` });
  await page.goto(`/evenements/${eventId}/articles`);
  await page.getByLabel('Nom', { exact: true }).first().fill('Crêpe sucre');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${tag}-articles.png` });
  await page.getByRole('button', { name: 'Changer le picto de Soda' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-picto.png` });
  await page.goto(`/evenements/${eventId}/bilan`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${tag}-bilan.png` });
  await page.getByRole('heading', { name: 'Dernières ventes' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${tag}-bilan-historique.png` });
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${tag}-connexion-installer.png` });
});
