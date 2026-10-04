import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test('answers the question for October 2026 with the demo data', async ({ page }) => {
  await freshAccount(page);
  await expect(page.getByText('Tu es dans le rouge ce mois-ci')).toBeVisible();
  await expect(page.getByText(fr('−2 310 €')).first()).toBeVisible();
  await expect(page.getByText(fr('46 010 €')).first()).toBeVisible();
  await expect(page.getByText(fr('Il manque ce montant pour couvrir tes charges, mais ton solde absorbe le choc : il reste 46 010 € sur le compte.'))).toBeVisible();
});

test('lists what comes in and what goes out', async ({ page }) => {
  await freshAccount(page);
  await expect(page.getByText('Facture d’août · vers le 25 oct.')).toBeVisible();
  await expect(page.getByText(fr('+6 600 €')).first()).toBeVisible();
  await expect(page.getByText('Salaire (net)')).toBeVisible();
  await expect(page.getByText('Cotisations sociales')).toBeVisible();
});

test('navigates months with the arrows and the bars', async ({ page, isMobile }) => {
  await freshAccount(page);
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByText('novembre 2026').first()).toBeVisible();
  await expect(page.getByText('Tu es dans le positif')).toBeVisible();
  await expect(page.getByText(fr('+5 340 €')).first()).toBeVisible();
  const bar = page.getByRole('button', { name: fr('février 2027 : −2 310 €') });
  await bar.click();
  await expect(bar).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sans tes vacances, ce mois serait dans le positif.')).toBeVisible();
  if (!isMobile) await expect(page.getByText('6 mois dans le rouge, jamais à découvert')).toBeVisible();
});

test('updates the balance and the projection follows', async ({ page }) => {
  await freshAccount(page);
  const field = page.getByLabel('Solde du compte');
  await field.fill('50000');
  await field.blur();
  await expect(page.getByText(fr('47 690 €')).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(fr('47 690 €')).first()).toBeVisible();
});

test('shows empty states on a brand new account, without NaN', async ({ page, isMobile }) => {
  await freshAccount(page, { file: null, firstName: 'Camille' });
  await expect(page.getByText('Aucun paiement client attendu ce mois-ci.')).toBeVisible();
  if (isMobile) await expect(page.getByRole('link', { name: 'Ton profil' })).toHaveText('C');
  else await expect(page.getByText('Salut Camille', { exact: false })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
});

// Compléments au brief : bornes du pas-à-pas, statut, solde vidé, fraîcheur du solde.

test('stops the month arrows at both ends of the 15 months', async ({ page }) => {
  await freshAccount(page);
  const prev = page.getByRole('button', { name: 'Mois précédent' });
  const next = page.getByRole('button', { name: 'Mois suivant' });
  await expect(page.getByText('octobre 2026').first()).toBeVisible();
  await expect(prev).toBeDisabled();
  for (let i = 0; i < 14; i++) await next.click();
  await expect(page.getByText('décembre 2027').first()).toBeVisible();
  await expect(next).toBeDisabled();
  await prev.click();
  await expect(page.getByText('novembre 2027').first()).toBeVisible();
});

test('switches the status to micro-entreprise and back', async ({ page }) => {
  await freshAccount(page);
  const status = page.getByRole('group', { name: 'Statut' });
  await expect(status.getByRole('button', { name: 'Société' })).toHaveAttribute('aria-pressed', 'true');
  await status.getByRole('button', { name: /^Micro/ }).click();
  await expect(status.getByRole('button', { name: /^Micro/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Tu es dans le rouge ce mois-ci')).toHaveCount(0);
  await status.getByRole('button', { name: 'Société' }).click();
  await expect(page.getByText('Tu es dans le rouge ce mois-ci')).toBeVisible();
});

test('keeps the saved balance when the field is emptied', async ({ page }) => {
  await freshAccount(page);
  const field = page.getByLabel('Solde du compte');
  await expect(field).toHaveValue('48320');
  await field.fill('');
  await field.blur();
  await expect(field).toHaveValue('48320');
  await expect(page.getByText(fr('46 010 €')).first()).toBeVisible();
});

test('says when the balance was last updated', async ({ page }) => {
  await freshAccount(page);
  await expect(page.getByText('Mis à jour aujourd’hui')).toBeVisible();
});

test('asks for the balance on a brand new account', async ({ page }) => {
  await freshAccount(page, { file: null });
  await expect(page.getByText('Indique ton solde pour démarrer')).toBeVisible();
  await expect(page.getByLabel('Solde du compte')).toHaveValue('');
});
