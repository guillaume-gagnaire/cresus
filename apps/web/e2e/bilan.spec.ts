import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { expect, test } from './fixtures';
import { euros, eventWithArticles, freshAccount } from './helpers';

test('bilan : totaux, par article, suppression d’une vente, export Excel', async ({ page }) => {
  await freshAccount(page);
  const { eventId, articleIds } = await eventWithArticles(page, [['Crêpe nutella', 250], ['Coca', 150]]);
  const soldAt = new Date(Date.now() - 60_000).toISOString();
  const ops = [
    { op: 'sale', id: randomUUID(), articleId: articleIds[0], priceCents: 250, soldAt },
    { op: 'sale', id: randomUUID(), articleId: articleIds[0], priceCents: 250, soldAt },
    { op: 'sale', id: randomUUID(), articleId: articleIds[1], priceCents: 150, soldAt },
  ];
  expect((await page.request.post(`/api/events/${eventId}/sync`, { data: { ops } })).ok()).toBe(true);

  await page.goto(`/evenements/${eventId}/bilan`);
  await expect(page.getByTestId('bilan-total')).toHaveText(euros('6,50 €'));
  await expect(page.getByTestId('bilan-count')).toHaveText('3 ventes');
  const crepe = page.getByRole('row').filter({ hasText: 'Crêpe nutella' });
  await expect(crepe).toContainText('2');
  await expect(crepe).toContainText(euros('5,00 €'));

  await page.getByRole('button', { name: /^Supprimer la vente Coca/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer la vente' }).click();
  await expect(page.getByTestId('bilan-total')).toHaveText(euros('5,00 €'));
  await expect(page.getByTestId('bilan-count')).toHaveText('2 ventes');
  await expect(page.getByRole('button', { name: /^Supprimer la vente Coca/ })).toHaveCount(0);

  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exporter en Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('cresus-kermesse-2027-2026-06-20.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  expect(workbook.worksheets.map((s) => s.name)).toEqual(['Récapitulatif', 'Ventes', 'Par heure']);
});
