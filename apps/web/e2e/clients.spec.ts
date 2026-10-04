import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test.skip(({ isMobile }) => isMobile, 'version desktop');

test('shows the timeline and the missions table', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'Tes missions dans le temps' })).toBeVisible();
  await expect(page.getByText(/Creux repéré : juin 2027/)).toBeVisible();
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText(fr('650 €/j'));
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText(fr('→ 700 € au 1er janv.'));
});

test('selects a mission and shows the path of an invoice', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client A/ }).click();
  const panel = page.getByRole('region', { name: 'Client A' });
  await expect(panel.getByText('31 oct.')).toBeVisible();
  await expect(panel.getByText('Soit 30 jours d’attente entre la fin du mois travaillé et l’argent sur ton compte.')).toBeVisible();
});

test('adds a future rate and protects the last rate', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client A/ }).click();
  const panel = page.getByRole('region', { name: 'Client A' });
  await panel.getByLabel('Nouveau TJM (€)').fill('750');
  await panel.getByLabel('À partir du').fill('2027-04-01');
  await panel.getByRole('button', { name: 'Ajouter' }).click();
  await expect(panel.getByText(fr('750 €/j'))).toBeVisible();
  await expect(panel.getByText('À venir').first()).toBeVisible();
  await page.getByRole('row', { name: /Client C/ }).click();
  const c = page.getByRole('region', { name: 'Client C' });
  await expect(c.getByRole('button', { name: /Supprimer le tarif/ })).toHaveCount(0);
});

test('edits payment terms and the path follows', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client A/ }).click();
  const panel = page.getByRole('region', { name: 'Client A' });
  await panel.getByRole('button', { name: '60 jours' }).click();
  await expect(panel.getByText('Soit 60 jours d’attente', { exact: false })).toBeVisible();
});

test('creates a new client', async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  const panel = page.getByRole('region', { name: 'Nouveau client' });
  await panel.getByLabel('Nom du client').fill('Acme');
  await panel.getByLabel('TJM (€)').fill('600');
  await panel.getByRole('button', { name: 'lundi' }).click();
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page.getByRole('row', { name: /Acme/ })).toBeVisible();
});

// Compléments au brief : sélection, clavier, pistes, mode de facturation, fin de mission, suppressions, liens directs, comptes vides.

interface TresoWindow {
  __treso: { clients: Array<{ id: string; name: string }> };
}

test('opens on the first mission and moves the selection with the keyboard', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await expect(page.getByRole('region', { name: 'Client A' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Client A/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('row', { name: /Client C/ })).toHaveAttribute('aria-selected', 'false');
  await page.getByRole('row', { name: /Client C/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Client C' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Client C/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('row', { name: /Client D/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Client D' })).toBeVisible();
});

test('opens a mission from the timeline, and from a direct link', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('button', { name: /Ouvrir Client D/ }).click();
  await expect(page.getByRole('region', { name: 'Client D' })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as Partial<TresoWindow>).__treso?.clients.length === 4);
  const id = await page.evaluate(() => (window as unknown as TresoWindow).__treso.clients.find((c) => c.name === 'Client C')!.id);
  await page.goto(`/clients/${id}`);
  await expect(page.getByRole('region', { name: 'Client C' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Client C' }).getByText('Piste')).toBeVisible();
  await page.goto('/clients/inconnu');
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole('region', { name: 'Client A' })).toBeVisible();
});

test('words the table rows without any demo-specific copy', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await expect(page.getByText('3 missions · 1 piste')).toBeVisible();
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText('Lun, Ven');
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText('Du 1er oct. au 31 mai');
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText(fr('5 590 €'));
  await expect(page.getByRole('row', { name: /Client B/ })).toContainText('2 tarifs dans l’historique');
  await expect(page.getByRole('row', { name: /Client B/ })).toContainText('+ 10 j de retard en moyenne');
  await expect(page.getByRole('row', { name: /Client C/ })).toContainText(fr('+6 020 €'));
  await expect(page.getByRole('row', { name: /Client D/ })).toContainText('Forfait mensuel');
  await expect(page.getByRole('row', { name: /Client D/ })).toContainText(fr('1 200 €/mois'));
  await expect(page.getByText('Il manque une mission pour remplir tes jours.')).toBeVisible();
  await expect(page.getByText(/lundis/)).toHaveCount(0);
});

test('counts the prospects on demand and remembers it', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const box = page.getByLabel('Compter les pistes');
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(box).toBeChecked();
  await expect(page.getByRole('img', { name: /Creux de CA/ })).toHaveAttribute('aria-label', /juil\. : .* facturés/);
  await page.reload();
  await expect(page.getByLabel('Compter les pistes')).toBeChecked();
});

test('switches between billed and cashed amounts', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const seg = page.getByRole('group', { name: 'Montants affichés' });
  await expect(seg.getByRole('button', { name: 'Encaissé' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: /^octobre 2026 : .* encaissés$/ })).toBeVisible();
  await seg.getByRole('button', { name: 'Facturé' }).click();
  await expect(seg.getByRole('button', { name: 'Facturé' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: /^octobre 2026 : .* facturés$/ })).toBeVisible();
  await expect(page.getByText(/ facturés$/).first()).toBeVisible();
  await expect(page.getByText(/ encaissés$/).first()).toBeVisible();
});

test('switches a flat-rate mission to time spent and back', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client D/ }).click();
  const panel = page.getByRole('region', { name: 'Client D' });
  await expect(panel.getByLabel('Nouveau forfait (€)')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'lundi' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Au temps passé' }).click();
  await expect(panel.getByLabel('Nouveau TJM (€)')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'lundi' })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'mardi' }).click();
  await expect(panel.getByRole('button', { name: 'mardi' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('row', { name: /Client D/ })).toContainText('Lun, Mar');
  await panel.getByRole('button', { name: 'Forfait mensuel' }).click();
  await expect(panel.getByRole('button', { name: 'lundi' })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Client D/ })).toContainText('Forfait mensuel');
});

test('gives a mission an end date six months after its start, and refuses an end before the start', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client B/ }).click();
  const panel = page.getByRole('region', { name: 'Client B' });
  await expect(panel.getByText('Sans date de fin', { exact: true })).toBeVisible();
  await panel.getByRole('switch', { name: 'Mission sans date de fin' }).click();
  await expect(panel.getByLabel('Fin', { exact: true })).toHaveValue('2026-09-02');
  await panel.getByLabel('Fin', { exact: true }).fill('2026-01-15');
  await expect(page.getByRole('status')).toContainText('La date de fin doit être après la date de début.');
  await expect(panel.getByLabel('Fin', { exact: true })).toHaveValue('2026-09-02');
});

test('deletes a rate but never the last one', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const panel = page.getByRole('region', { name: 'Client A' });
  await panel.getByRole('button', { name: 'Supprimer le tarif du 1er janv.' }).click();
  await expect(panel.getByText(fr('700 €/j'))).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /Supprimer le tarif/ })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Client A/ })).not.toContainText('→');
});

test('deletes a client after a confirmation', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client C/ }).click();
  await page.getByRole('region', { name: 'Client C' }).getByRole('button', { name: 'Supprimer ce client' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('row', { name: /Client C/ })).toBeVisible();
  await page.getByRole('region', { name: 'Client C' }).getByRole('button', { name: 'Supprimer ce client' }).click();
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('row', { name: /Client C/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Client A' })).toBeVisible();
  await expect(page.getByText('3 missions · 0 piste')).toBeVisible();
});

test('asks for a name and a rate before creating, then opens the new mission', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients/new');
  const panel = page.getByRole('region', { name: 'Nouveau client' });
  await expect(page.getByRole('row', { name: /Client A/ })).toHaveAttribute('aria-selected', 'false');
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page.getByRole('status')).toContainText('Donne un nom à ce client.');
  await panel.getByLabel('Nom du client').fill('Initech');
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page.getByRole('status').last()).toContainText('Indique ton TJM.');
  await panel.getByLabel('Sous-titre').fill('Via ESN');
  await panel.getByRole('button', { name: 'Forfait mensuel' }).click();
  await panel.getByLabel('Forfait (€)').fill('2500');
  await panel.getByRole('button', { name: '45 jours' }).click();
  await panel.getByRole('checkbox', { name: /Piste/ }).check();
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('region', { name: 'Initech' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Initech/ })).toContainText('Forfait mensuel');
  await expect(page.getByRole('row', { name: /Initech/ })).toContainText('45 jours');
  await expect(page.getByRole('row', { name: /Initech/ })).toContainText(fr('+2 500 €'));
  await expect(page.getByText('3 missions · 2 pistes')).toBeVisible();
});

test('shows a brand new account without any mission, without NaN', async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/clients');
  await expect(page.getByText('0 mission · 0 piste')).toBeVisible();
  await expect(page.getByText('Aucun client pour l’instant')).toBeVisible();
  await expect(page.getByText('Aucun revenu prévu sur ces 12 mois. Ajoute une mission pour commencer.')).toBeVisible();
  await expect(page.getByText('tes jours sont remplis')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Supprimer ce client' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('NaN');
});
