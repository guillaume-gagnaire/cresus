import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'version mobile');

test('cycles a weekday in the typical week', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const monday = page.getByRole('button', { name: /^lundi/ });
  await expect(monday).toContainText('A');
  await monday.click();
  await expect(monday).toContainText('B');
  await monday.click();
  await expect(monday).toContainText('Libre');
});

test('opens a mission as a pushed screen with a back button', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('link', { name: 'Modifier la mission Client A' }).click();
  await expect(page).toHaveURL(/\/clients\/.+/);
  await expect(page.getByRole('heading', { name: 'Ta mission' })).toBeVisible();
  await expect(page.getByText(fr('650 €/j')).first()).toBeVisible();
  await page.getByRole('link', { name: 'Retour' }).click();
  await expect(page).toHaveURL(/\/clients$/);
});

// Compléments au brief : fiches, persistance, sélecteur, édition, création, suppression, lien inconnu.

test('shows one card per client with its figures and the average monthly revenue', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'Qui te fait vivre ?' })).toBeVisible();
  await expect(page.getByText('3 missions · 1 piste')).toBeVisible();
  await expect(page.getByText('CA moyen par mois').locator('..')).toContainText(fr('14 530 €'));
  const a = page.locator('article', { hasText: 'Client A' });
  await expect(a).toContainText('Via ESN · Lun, Ven');
  await expect(a).toContainText(fr('650 €/j'));
  await expect(a).toContainText('9 jours / mois');
  await expect(a).toContainText(fr('5 590 € / mois'));
  await expect(a).toContainText('Du 1er oct. au 31 mai');
  await expect(a).toContainText('30 j fin de mois');
  await expect(page.locator('article', { hasText: 'Client C' })).toContainText('Piste');
  await expect(page.locator('article', { hasText: 'Client C' })).toContainText(fr('+6 020 € / mois'));
  await expect(page.locator('article', { hasText: 'Client D' })).toContainText('Forfait');
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('keeps a changed weekday after a reload', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const monday = page.getByRole('button', { name: /^lundi/ });
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/clients\/[^/]+$/.test(new URL(r.url()).pathname));
  await monday.click();
  await expect(monday).toContainText('B');
  await expect(monday).toHaveAttribute('aria-label', 'lundi : Client B, toucher pour changer');
  // Le changement touche deux clients : on attend que les deux écritures soient parties.
  await saved;
  await expect(monday).not.toHaveAttribute('aria-disabled', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /^lundi/ })).toContainText('B');
  await expect(page.locator('article', { hasText: 'Client B' })).toContainText('17 jours / mois');
});

test('switches mission with the client chips and edits it', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('link', { name: 'Modifier la mission Client A' }).click();
  const picker = page.getByRole('group', { name: 'Client', exact: true });
  await expect(picker.getByRole('button', { name: 'Client A' })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: 'Client B' }).click();
  await expect(page.getByLabel('Nom du client')).toHaveValue('Client B');
  await expect(page.getByText(fr('600 €/j')).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour' })).toBeVisible();

  // Un tarif futur s’ajoute, puis se supprime.
  await page.getByLabel('Nouveau TJM (€)').fill('650');
  await page.getByLabel('À partir du').fill('2027-04-01');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText(fr('650 €/j'))).toBeVisible();
  await expect(page.getByText('À venir').first()).toBeVisible();
  const removed = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('/rates/'));
  await page.getByRole('button', { name: 'Supprimer le tarif du 1er avr.' }).click();
  await removed;
  await expect(page.getByText(fr('650 €/j'))).toHaveCount(0);

  // Délai de paiement, dates et piste.
  await page.getByRole('button', { name: '60 jours' }).click();
  await expect(page.getByText('Soit 70 jours d’attente', { exact: false })).toBeVisible();
  await expect(page.getByText('Du 2 mars 2026, sans fin')).toBeVisible();
  await page.getByRole('switch', { name: 'Mission sans date de fin' }).click();
  await expect(page.getByLabel('Fin', { exact: true })).toHaveValue('2026-09-02');
  await expect(page.getByText('Du 2 mars 2026 au 2 septembre 2026')).toBeVisible();
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/clients\/[^/]+$/.test(new URL(r.url()).pathname));
  await page.getByRole('switch', { name: 'Piste (pas encore signée)' }).click();
  await saved;
  await expect(page.getByRole('region', { name: 'Client B' })).toContainText('Piste');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Piste (pas encore signée)' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('region', { name: 'Client B' })).toContainText(fr('+7 740 € /mois'));
});

test('renames a client and recolours it from the pushed screen', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('link', { name: 'Modifier la mission Client B' }).click();
  const name = page.getByLabel('Nom du client');
  await name.fill('   ');
  await name.blur();
  await expect(name).toHaveValue('Client B');
  const renamed = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/clients\/[^/]+$/.test(new URL(r.url()).pathname));
  await name.fill('  Atelier Bleu ');
  await name.press('Enter');
  await renamed;
  await expect(page.getByRole('region', { name: 'Atelier Bleu' })).toBeVisible();
  await page.getByRole('button', { name: 'Rose' }).click();
  await expect(page.getByRole('button', { name: 'Rose' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Retour' }).click();
  await expect(page.locator('article', { hasText: 'Atelier Bleu' })).toBeVisible();
  await expect(page.locator('article', { hasText: 'Client B' })).toHaveCount(0);
});

test('creates a mission on mobile and opens it', async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/clients');
  await expect(page.getByText('Aucun client pour l’instant')).toBeVisible();
  await expect(page.getByRole('button', { name: /^lundi/ })).toContainText('Libre');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  await expect(page).toHaveURL(/\/clients\/new$/);
  await expect(page.getByRole('heading', { name: 'Nouveau client' })).toBeVisible();
  await page.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page.getByRole('status')).toContainText('Donne un nom à ce client.');
  await page.getByLabel('Nom du client').fill('Acme');
  await page.getByLabel('TJM (€)').fill('600');
  await page.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page.getByRole('alert')).toHaveText('Choisis au moins un jour de présence.');
  await page.getByRole('button', { name: 'lundi' }).click();
  await page.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Ta mission' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Acme' })).toContainText(fr('600 €/j'));
  await page.getByRole('link', { name: 'Retour' }).click();
  await expect(page.locator('article', { hasText: 'Acme' })).toContainText('4 jours / mois');
  await expect(page.getByRole('button', { name: /^lundi/ })).toContainText('A');
});

test('deletes a mission after a confirmation, then goes back to the list', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('link', { name: 'Modifier la mission Client C' }).click();
  await page.getByRole('button', { name: 'Supprimer ce client' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('region', { name: 'Client C' })).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer ce client' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.locator('article', { hasText: 'Client C' })).toHaveCount(0);
  await expect(page.getByText('3 missions · 0 piste')).toBeVisible();
});

test('goes back to the list from an unknown mission link', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients/inconnu');
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole('heading', { name: 'Qui te fait vivre ?' })).toBeVisible();
});
