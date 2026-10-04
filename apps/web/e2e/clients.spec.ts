import { expect, type Page, test } from '@playwright/test';
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
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/rates'));
  await panel.getByRole('button', { name: 'Ajouter' }).click();
  await expect(panel.getByText(fr('750 €/j'))).toBeVisible();
  await expect(panel.getByText('À venir').first()).toBeVisible();
  // Le tarif est bien enregistré côté serveur : il est toujours là après un rechargement.
  await saved;
  await page.reload();
  await expect(page.getByRole('region', { name: 'Client A' }).getByText(fr('750 €/j'))).toBeVisible();
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

/** Réponse de l’API à l’écriture d’un client (PATCH), à attendre avant de recharger la page. */
const clientPatched = (page: Page) =>
  page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/clients\/[^/]+$/.test(new URL(r.url()).pathname));

/** Identifiant d’un client du compte de démo, lu dans le store une fois chargé. */
async function clientId(page: Page, name: string): Promise<string> {
  await page.waitForFunction(() => (window as unknown as Partial<TresoWindow>).__treso?.clients.length === 4);
  return page.evaluate((n) => (window as unknown as TresoWindow).__treso.clients.find((c) => c.name === n)!.id, name);
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
  const id = await clientId(page, 'Client C');
  await page.goto(`/clients/${id}`);
  await expect(page.getByRole('region', { name: 'Client C' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Client C' }).getByText('Piste', { exact: true })).toBeVisible();
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
  await panel.getByRole('switch', { name: 'Piste (pas encore signée)' }).click();
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

// Fiche éditable : piste ou signée, nom, sous-titre, couleur, et garde-fous.

test('turns a prospect into a signed mission and keeps it after a reload', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const frieze = page.getByRole('group', { name: 'Tes missions dans le temps' });
  await expect(frieze.getByRole('button', { name: 'Client C Piste' })).toBeVisible();
  await expect(page.getByText('3 missions · 1 piste')).toBeVisible();
  await page.getByRole('row', { name: /Client C/ }).click();
  const panel = page.getByRole('region', { name: 'Client C' });
  const signed = panel.getByRole('switch', { name: 'Piste (pas encore signée)' });
  await expect(signed).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('Piste', { exact: true })).toBeVisible();
  const saved = clientPatched(page);
  await signed.click();
  await saved;
  await expect(signed).toHaveAttribute('aria-checked', 'false');
  await expect(panel.getByText('Piste', { exact: true })).toHaveCount(0);
  await expect(frieze.getByRole('button', { name: 'Client C', exact: true })).toBeVisible();
  await expect(page.getByText('4 missions · 0 piste')).toBeVisible();
  await expect(page.getByRole('row', { name: /Client C/ })).toContainText(fr('6 020 €'));
  await expect(page.getByRole('row', { name: /Client C/ })).not.toContainText(fr('+6 020 €'));
  await page.reload();
  await expect(page.getByText('4 missions · 0 piste')).toBeVisible();
  await expect(frieze.getByRole('button', { name: 'Client C', exact: true })).toBeVisible();
  await page.getByRole('row', { name: /Client C/ }).click();
  await expect(page.getByRole('region', { name: 'Client C' }).getByRole('switch', { name: 'Piste (pas encore signée)' })).toHaveAttribute('aria-checked', 'false');
});

test('turns a signed mission back into a prospect', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client B/ }).click();
  const panel = page.getByRole('region', { name: 'Client B' });
  const saved = clientPatched(page);
  await panel.getByRole('switch', { name: 'Piste (pas encore signée)' }).click();
  await saved;
  await expect(panel.getByText('Piste', { exact: true })).toBeVisible();
  await expect(page.getByText('2 missions · 2 pistes')).toBeVisible();
  await expect(page.getByRole('row', { name: /Client B/ })).toContainText(fr('+7 740 €'));
});

test('renames, sub-titles and recolours a client, and keeps it after a reload', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client B/ }).click();
  const name = page.getByRole('region', { name: 'Client B' }).getByLabel('Nom du client');
  // Un nom vidé n’est pas enregistré : le champ reprend le nom du client.
  await name.fill('   ');
  await name.blur();
  await expect(name).toHaveValue('Client B');
  const renamed = clientPatched(page);
  await name.fill('  Atelier Bleu ');
  await name.press('Enter');
  await renamed;
  const panel = page.getByRole('region', { name: 'Atelier Bleu' });
  await expect(panel.getByRole('heading', { name: 'Atelier Bleu' })).toBeVisible();
  await expect(panel.getByLabel('Nom du client')).toHaveValue('Atelier Bleu');
  await expect(page.getByRole('row', { name: /Atelier Bleu/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Client B/ })).toHaveCount(0);

  const subtitled = clientPatched(page);
  await panel.getByLabel('Sous-titre').fill(' Pour le studio ');
  await panel.getByLabel('Sous-titre').blur();
  await subtitled;
  await expect(panel.getByLabel('Sous-titre')).toHaveValue('Pour le studio');
  const frieze = page.getByRole('group', { name: 'Tes missions dans le temps' });
  await expect(frieze.getByRole('button', { name: 'Atelier Bleu Pour le studio' })).toBeVisible();

  const recoloured = clientPatched(page);
  await panel.getByRole('button', { name: 'Rose' }).click();
  await recoloured;
  await expect(panel.getByRole('button', { name: 'Rose' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('button', { name: 'Orange' })).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await page.getByRole('row', { name: /Atelier Bleu/ }).click();
  const again = page.getByRole('region', { name: 'Atelier Bleu' });
  await expect(again.getByLabel('Sous-titre')).toHaveValue('Pour le studio');
  await expect(again.getByRole('button', { name: 'Rose' })).toHaveAttribute('aria-pressed', 'true');
});

test('asks for at least one presence day before creating a time-based mission', async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/clients/new');
  const panel = page.getByRole('region', { name: 'Nouveau client' });
  await panel.getByLabel('Nom du client').fill('Globex');
  await panel.getByLabel('TJM (€)').fill('550');
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(panel.getByRole('alert')).toHaveText('Choisis au moins un jour de présence.');
  await expect(page).toHaveURL(/\/clients\/new$/);
  await panel.getByRole('button', { name: 'vendredi' }).click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('row', { name: /Globex/ })).toContainText('Ven');
});

test('stays on the client page when the deletion is refused', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const id = await clientId(page, 'Client C');
  await page.route(`**/api/clients/${id}`, (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, code: 'BOOM', message: 'Suppression impossible.' }) })
      : route.continue(),
  );
  await page.goto(`/clients/${id}`);
  await page.getByRole('region', { name: 'Client C' }).getByRole('button', { name: 'Supprimer ce client' }).click();
  // Après le refus, le store recharge l’état ; on attend ce rechargement, puis on laisse à une éventuelle navigation le temps d’avoir lieu.
  const reloaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/state');
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Suppression impossible.');
  await reloaded;
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(new RegExp(`/clients/${id}$`));
  await expect(page.getByRole('region', { name: 'Client C' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Client C/ })).toBeVisible();
});
