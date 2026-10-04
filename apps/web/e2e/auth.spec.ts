import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test('creates an account and lands on the dashboard', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00'));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Créer un compte' }).first().click();
  await page.getByLabel('Prénom').fill('Camille');
  await page.getByLabel('E-mail').fill(`camille-${Date.now()}@matreso.test`);
  await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse1');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/$/);
  // Le tableau de bord (Task 26) affichera « Ce mois-ci, ça passe ? » : on vérifie ici l’arrivée dans l’app connectée.
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('shows the API error on wrong credentials', async ({ page }) => {
  const email = await freshAccount(page, { file: null });
  await page.request.post('/api/auth/logout', { data: {} });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).last().click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
});

test('toggles password visibility and announces the unavailable reset', async ({ page }) => {
  await page.goto('/login');
  const pwd = page.getByLabel('Mot de passe', { exact: true });
  await expect(pwd).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
  await expect(pwd).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.getByRole('status')).toContainText('Bientôt disponible');
});

// Compléments au brief : les comportements de l’écran que le brief décrit sans les tester.

test('switches between sign-in and sign-up', async ({ page }) => {
  await page.goto('/login');
  const mode = page.getByRole('group', { name: 'Mode' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Content de te revoir');
  await expect(page.getByLabel('Prénom')).toHaveCount(0);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByRole('button', { name: 'Mot de passe oublié ?' })).toBeVisible();

  await mode.getByRole('button', { name: 'Créer un compte' }).click();
  await expect(mode.getByRole('button', { name: 'Créer un compte' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bienvenue !');
  await expect(page.getByLabel('Prénom')).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAccessibleDescription('8 caractères minimum.');
  await expect(page.getByRole('button', { name: 'Mot de passe oublié ?' })).toHaveCount(0);
});

test('shows the API validation message on sign-up and clears it when the mode changes', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Créer un compte' }).first().click();
  await page.getByLabel('Prénom').fill('Camille');
  await page.getByLabel('E-mail').fill(`camille-${Date.now()}@matreso.test`);
  await page.getByLabel('Mot de passe', { exact: true }).fill('court');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('alert')).toHaveText('Ton mot de passe doit faire au moins 8 caractères.');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).first().click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('disables the submit button while the request is pending', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('personne@matreso.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Un instant…' })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true }).last()).toBeEnabled();
});

test('reports a cancelled passkey prompt', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.credentials.get = () => Promise.reject(new DOMException('annulé', 'NotAllowedError'));
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Se connecter avec Face ID' }).click();
  await expect(page.getByRole('alert')).toHaveText('Connexion par Face ID annulée.');
});

test('hides the Face ID button when passkeys are unsupported', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: /Face ID/ })).toHaveCount(0);
});
