import { expect, test } from './fixtures';
import { euros, eventWithArticles, freshAccount } from './helpers';

test('sur tablette, la caisse montre 4 colonnes et une colonne de résumé', async ({ page }) => {
  await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250], ['Soda', 150], ['Gaufre', 300], ['Café', 100], ['Frites', 200]]);
  await page.goto(`/evenements/${eventId}`);
  const aside = page.getByRole('complementary', { name: 'Résumé de la caisse' });
  await expect(aside).toBeVisible();

  const tiles = page.getByRole('button', { name: /^Vendre / });
  const tops = await tiles.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops.slice(0, 4)).size).toBe(1);
  expect(tops[4]).toBeGreaterThan(tops[0]!);

  await page.getByRole('button', { name: /^Vendre Gaufre/ }).click();
  await expect(aside.getByTestId('total')).toHaveText(euros('3,00 €'));
  await expect(aside.getByRole('listitem').filter({ hasText: 'Gaufre' })).toBeVisible({ timeout: 8000 });
});
