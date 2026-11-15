import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { euros, eventWithArticles, freshAccount, PASSWORD } from './helpers';

const tile = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^Vendre ${name}`) });
const count = (page: Page, name: string) => tile(page, name).getByTestId('count');
const total = (page: Page) => page.getByTestId('total');
const pill = (page: Page) => page.getByTestId('sync');

async function serverCount(page: Page, eventId: string): Promise<number> {
  return (await (await page.request.get(`/api/events/${eventId}/summary`)).json()).salesCount as number;
}

test('un appui = une vente, et « Annuler » retire la dernière', async ({ page }) => {
  await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250], ['Soda', 150]]);
  await page.goto(`/evenements/${eventId}`);
  await tile(page, 'Crêpe').click();
  await tile(page, 'Crêpe').click();
  await tile(page, 'Crêpe').click();
  await expect(count(page, 'Crêpe')).toHaveText('3');
  await expect(total(page)).toHaveText(euros('7,50 €'));
  await expect(page.getByRole('status').filter({ hasText: 'Crêpe +1' })).toBeVisible();

  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(count(page, 'Crêpe')).toHaveText('2');
  await expect(total(page)).toHaveText(euros('5,00 €'));
  await expect(pill(page)).toHaveText(/À jour/);
  await expect.poll(() => serverCount(page, eventId)).toBe(2);

  await page.reload();
  await expect(count(page, 'Crêpe')).toHaveText('2');
});

test('hors ligne, les ventes attendent sur le téléphone puis partent toutes seules', async ({ page, context }) => {
  await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250], ['Soda', 150]]);
  await page.goto(`/evenements/${eventId}`);
  await tile(page, 'Crêpe').click();
  await expect.poll(() => serverCount(page, eventId)).toBe(1);

  await context.setOffline(true);
  await tile(page, 'Soda').click();
  await tile(page, 'Soda').click();
  await expect(pill(page)).toHaveText(/2 en attente/);
  await expect(count(page, 'Soda')).toHaveText('2');
  await expect(total(page)).toHaveText(euros('5,50 €'));

  await context.setOffline(false);
  await expect(pill(page)).toHaveText(/À jour/, { timeout: 15_000 });
  expect(await serverCount(page, eventId)).toBe(3);
});

test('session expirée : les ventes sont gardées et partent après la reconnexion', async ({ page, context }) => {
  const email = await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250]]);
  await page.goto(`/evenements/${eventId}`);
  await tile(page, 'Crêpe').click();
  await expect.poll(() => serverCount(page, eventId)).toBe(1);

  await context.clearCookies();
  await tile(page, 'Crêpe').click();
  await expect(pill(page)).toHaveText(/Reconnexion/);
  await expect(count(page, 'Crêpe')).toHaveText('2');

  await pill(page).click();
  await page.getByLabel('Email de l’asso').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(pill(page)).toHaveText(/À jour/, { timeout: 15_000 });
  expect(await serverCount(page, eventId)).toBe(2);
});

test('deux téléphones de l’asso : les ventes de l’un apparaissent en direct sur l’autre', async ({ page, browser }) => {
  await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250], ['Soda', 150]]);
  await page.goto(`/evenements/${eventId}`);
  await expect(pill(page)).toHaveText(/À jour/);

  const other = await browser.newContext({ storageState: await page.context().storageState() });
  const phone2 = await other.newPage();
  await phone2.goto(`/evenements/${eventId}`);
  await tile(phone2, 'Soda').click();
  await tile(phone2, 'Soda').click();

  await expect(count(page, 'Soda')).toHaveText('2', { timeout: 8000 });
  await expect(total(page)).toHaveText(euros('3,00 €'));
  await other.close();
});

test('évènement supprimé ailleurs pendant que des ventes attendent : la file ne reste pas bloquée', async ({ page, context }) => {
  await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250]]);
  await page.goto(`/evenements/${eventId}`);
  await expect(pill(page)).toHaveText(/À jour/);
  await context.setOffline(true);
  await tile(page, 'Crêpe').click();
  await expect(pill(page)).toHaveText(/1 en attente/);
  await context.setOffline(false);
  // supprimé depuis un autre appareil, avant que ce téléphone ne retrouve le réseau
  await page.request.delete(`/api/events/${eventId}`);
  await expect(page.getByText('Cet évènement n’existe plus')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Vos évènements' })).toBeVisible();
  const queue = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cresus:queue:')).map((k) => localStorage.getItem(k)));
  expect(queue.every((raw) => raw === null || raw === '[]')).toBe(true);
});
