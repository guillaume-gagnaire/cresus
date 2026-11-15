import { expect, test } from './fixtures';
import { freshAccount, PASSWORD } from './helpers';

test('inscription de l’asso puis arrivée sur ses évènements', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('tab', { name: 'Créer le compte' }).click();
  await page.getByLabel('Nom de l’asso').fill('APE Jean Moulin');
  await page.getByLabel('Email de l’asso').fill(`e2e-signup-${Date.now()}@cresus.test`);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByRole('heading', { name: 'Vos évènements' })).toBeVisible();
  await expect(page.getByText('APE Jean Moulin')).toBeVisible();
});

test('mauvais mot de passe, puis connexion et déconnexion', async ({ page, context }) => {
  const email = await freshAccount(page);
  await context.clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email de l’asso').fill(email);
  await page.getByLabel('Mot de passe').fill('pas-le-bon');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vos évènements' })).toBeVisible();

  await page.getByRole('link', { name: 'Réglages de l’asso' }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('réglages : renommer l’asso et changer le mot de passe', async ({ page, context }) => {
  const email = await freshAccount(page);
  await page.goto('/reglages');
  await page.getByLabel('Nom de l’asso').fill('APE Victor Hugo');
  await page.getByRole('button', { name: 'Enregistrer le nom' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Nom enregistré' })).toBeVisible();

  await page.getByLabel('Mot de passe actuel').fill(PASSWORD);
  await page.getByLabel('Nouveau mot de passe').fill('nouveau-mdp-2027');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Mot de passe changé' })).toBeVisible();

  await context.clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email de l’asso').fill(email);
  await page.getByLabel('Mot de passe').fill('nouveau-mdp-2027');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('APE Victor Hugo')).toBeVisible();
});

test('le site demande à ne pas être indexé', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});

test('l’appli ouverte prolonge la session toutes les 5 minutes', async ({ page }) => {
  await page.clock.install();
  await freshAccount(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vos évènements' })).toBeVisible();
  const keepAlive = page.waitForRequest((req) => req.url().endsWith('/api/auth/me'));
  await page.clock.fastForward('05:01');
  await keepAlive;
});
