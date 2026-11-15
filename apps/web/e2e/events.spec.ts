import { expect, test } from './fixtures';
import { eventWithArticles, freshAccount } from './helpers';

test('créer un évènement, ajouter des articles au picto automatique, le changer, réordonner, masquer', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouvel évènement' }).click();
  await page.getByLabel('Nom', { exact: true }).fill('Kermesse 2027');
  await page.getByLabel('Date', { exact: true }).fill('2026-06-20');
  await page.getByRole('button', { name: 'Créer l’évènement' }).click();

  await expect(page.getByRole('heading', { name: 'Kermesse 2027' })).toBeVisible();
  await expect(page.getByText('Ajoutez vos articles')).toBeVisible();
  await page.getByRole('link', { name: 'Articles', exact: true }).click();

  const form = page.getByRole('form', { name: 'Ajouter un article' });
  await form.getByLabel('Nom').fill('Crêpe nutella');
  await expect(form.getByRole('button', { name: /Changer le picto/ }).locator('img')).toHaveAttribute('src', '/pictos/pancakes.svg');
  await form.getByLabel('Prix').fill('2,50');
  await form.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Crêpe nutella' })).toContainText('2,50 €');

  await form.getByLabel('Nom').fill('Coca');
  await form.getByLabel('Prix').fill('1.5');
  await form.getByRole('button', { name: 'Ajouter' }).click();
  const coca = page.getByRole('listitem').filter({ hasText: 'Coca' });
  await expect(coca.locator('img')).toHaveAttribute('src', '/pictos/cup-with-straw.svg');

  await coca.getByRole('button', { name: 'Changer le picto de Coca' }).click();
  const picker = page.getByRole('dialog', { name: /Picto de « Coca »/ });
  await picker.getByLabel('Chercher un picto').fill('jus');
  await picker.getByRole('button', { name: 'Choisir Jus de fruits' }).click();
  await expect(picker).toBeHidden();
  await expect(coca.locator('img')).toHaveAttribute('src', '/pictos/beverage-box.svg');

  await page.getByRole('button', { name: 'Réordonner' }).click();
  await coca.getByRole('button', { name: 'Monter Coca' }).click();
  await expect(page.getByRole('listitem').first()).toContainText('Coca');
  await page.getByRole('button', { name: 'Terminé' }).click();

  await page.getByRole('switch', { name: 'Crêpe nutella en vente' }).click();
  await expect(page.getByRole('switch', { name: 'Crêpe nutella en vente' })).not.toBeChecked();
  await page.getByRole('link', { name: 'Caisse', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Vendre Coca/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vendre Crêpe nutella/ })).toHaveCount(0);
});

test('reprendre les articles d’un évènement précédent', async ({ page }) => {
  await freshAccount(page);
  await eventWithArticles(page, [['Crêpe', 250], ['Soda', 150]], 'Fête de l’école 2026');
  await page.goto('/evenements/nouveau');
  await page.getByLabel('Nom', { exact: true }).fill('Kermesse 2027');
  await page.getByLabel('Reprendre les articles de…').selectOption({ label: 'Fête de l’école 2026' });
  await expect(page.getByText('Soda')).toBeVisible();
  await page.getByRole('button', { name: 'Créer l’évènement' }).click();
  await expect(page.getByRole('button', { name: /^Vendre Crêpe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vendre Soda/ })).toBeVisible();
});

test('renommer puis supprimer un évènement', async ({ page }) => {
  await freshAccount(page);
  const { eventId } = await eventWithArticles(page, [['Crêpe', 250]]);
  await page.goto(`/evenements/${eventId}/articles`);
  await page.getByLabel('Nom de l’évènement').fill('Fête de fin d’année');
  await page.getByRole('button', { name: 'Enregistrer l’évènement' }).click();
  await expect(page.getByText('Fête de fin d’année').first()).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer l’évènement' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page.getByRole('heading', { name: 'Vos évènements' })).toBeVisible();
  await expect(page.getByText('Fête de fin d’année')).toHaveCount(0);
});
