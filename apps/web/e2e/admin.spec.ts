import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { eventWithArticles, freshAccount, PASSWORD } from './helpers';

const ADMIN = 'admin@cresus.test';

/** Connecte la page à l'admin de l'instance (ADMIN_EMAILS de apps/api/.env.e2e), créé au premier passage. */
async function asAdmin(page: Page): Promise<void> {
  const signup = await page.request.post('/api/auth/signup', { data: { name: 'Cresus', email: ADMIN, password: PASSWORD } });
  if (!signup.ok()) expect((await page.request.post('/api/auth/login', { data: { email: ADMIN, password: PASSWORD } })).ok()).toBe(true);
}

test('l’admin voit tous les comptes, leurs évènements et chiffres, et peut réinitialiser un mot de passe', async ({ page, browser }) => {
  const asso = await browser.newContext();
  const assoPage = await asso.newPage();
  const email = await freshAccount(assoPage, 'APE des Tilleuls');
  const { eventId, articleIds } = await eventWithArticles(assoPage, [['Crêpe', 250]], 'Kermesse des Tilleuls');
  await assoPage.request.post(`/api/events/${eventId}/sync`, {
    data: { ops: [{ op: 'sale', id: randomUUID(), articleId: articleIds[0], priceCents: 250, soldAt: new Date().toISOString() }] },
  });
  await asso.close();

  await asAdmin(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Panneau d’admin' }).click();
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByTestId('stat-accounts')).not.toHaveText('0');

  await page.getByLabel('Chercher un compte').fill('Tilleuls');
  const row = page.getByRole('link', { name: new RegExp(email) });
  await expect(row).toContainText('APE des Tilleuls');
  await row.click();

  await expect(page.getByRole('heading', { name: 'APE des Tilleuls' })).toBeVisible();
  const event = page.getByRole('listitem').filter({ hasText: 'Kermesse des Tilleuls' });
  await expect(event).toContainText('1 vente');
  await expect(event.getByRole('link', { name: 'Exporter' })).toHaveAttribute('href', `/api/admin/events/${eventId}/export`);
  await event.getByRole('link', { name: 'Bilan' }).click();
  await expect(page.getByTestId('bilan-count')).toHaveText('1 vente');
  await page.goBack();

  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Réinitialiser' }).click();
  const shown = page.getByTestId('new-password');
  await expect(shown).toHaveText(/^[a-z0-9]{12}$/);
  const password = (await shown.textContent())!;
  const check = await browser.newContext();
  expect((await check.request.post('/api/auth/login', { data: { email, password } })).ok()).toBe(true);
  await check.close();
});

test('une asso ordinaire n’a pas accès au panneau d’admin', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Vos évènements' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Panneau d’admin' })).toHaveCount(0);
});
