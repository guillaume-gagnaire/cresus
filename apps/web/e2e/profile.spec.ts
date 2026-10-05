import { demoExportFile } from '@matreso/engine';
import { expect, type Page, test } from '@playwright/test';
import { connectApp, freshAccount, mcpStatus } from './helpers';

const OLD_PASSWORD = 'motdepasse1';

/** Fait répondre `/api/auth/me` avec le rôle voulu : l’ordre des tests décide sinon de qui est ADMIN dans la base d’e2e. */
async function asRole(page: Page, role: 'ADMIN' | 'USER'): Promise<void> {
  await page.route('**/api/auth/me', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { user: Record<string, unknown> };
    await route.fulfill({ response, json: { ...body, user: { ...body.user, role } } });
  });
}

test('shows the account and toggles alerts', async ({ page }) => {
  const email = await freshAccount(page);
  await page.goto('/profile');
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('GD').first()).toBeVisible();
  const alert = page.getByRole('switch', { name: 'Mois dans le rouge' });
  // La préférence est bien enregistrée côté serveur avant le rechargement (sinon la requête peut être coupée).
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/profile'));
  await alert.click();
  await saved;
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Mois dans le rouge' })).toHaveAttribute('aria-checked', 'false');
});

test('exports a JSON backup', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mes données' }).click();
  expect((await download).suggestedFilename()).toMatch(/^ma-treso-\d{4}-\d{2}-\d{2}\.json$/);
});

test('releases the export blob URL only after a delay, so iOS Safari can read it', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __exportTimes: { clicked: number[]; revoked: number[] } };
    w.__exportTimes = { clicked: [], revoked: [] };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedClick() {
      if (this.download) w.__exportTimes.clicked.push(performance.now());
      return click.call(this);
    };
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => { w.__exportTimes.revoked.push(performance.now()); revoke(url); };
  });
  await freshAccount(page);
  await page.goto('/profile');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mes données' }).click();
  await download;
  const times = () => page.evaluate(() => (window as unknown as { __exportTimes: { clicked: number[]; revoked: number[] } }).__exportTimes);
  expect((await times()).clicked).toHaveLength(1);
  await expect.poll(async () => (await times()).revoked.length, { timeout: 5_000 }).toBe(1);
  const { clicked, revoked } = await times();
  expect(revoked[0]! - clicked[0]!).toBeGreaterThanOrEqual(900);
});

test('rejects an invalid import file', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  await page.getByLabel('Importer une sauvegarde').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await page.getByRole('button', { name: 'Remplacer mes données' }).click();
  await expect(page.getByRole('status')).toContainText('Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
});

test('logs out', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('deletes the account after confirmation', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await page.getByLabel('Mot de passe').fill('motdepasse1');
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

// Compléments au brief : les comportements de l’écran que le brief décrit sans les tester.

test.describe('identity', () => {
  test('shows the first name, the e-mail and the notifications notice', async ({ page }) => {
    const email = await freshAccount(page, { file: null, firstName: 'Camille' });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Camille');
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText('Les notifications arrivent bientôt : tes préférences sont gardées.')).toBeVisible();
  });

  test('shows the Administrateur badge under the e-mail for an administrator', async ({ page }) => {
    await freshAccount(page);
    await asRole(page, 'ADMIN');
    await page.goto('/profile');
    await expect(page.getByText('Administrateur', { exact: true })).toBeVisible();
  });

  test('hides the Administrateur badge for a regular user', async ({ page }) => {
    await freshAccount(page);
    await asRole(page, 'USER');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Administrateur')).toHaveCount(0);
  });

  test('shows the badge exactly when the API says the account is an administrator', async ({ page }) => {
    await freshAccount(page);
    const me = (await (await page.request.get('/api/auth/me')).json()) as { user: { role: 'ADMIN' | 'USER' } };
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Administrateur', { exact: true })).toHaveCount(me.user.role === 'ADMIN' ? 1 : 0);
  });
});

test.describe('mon compte', () => {
  test('renames the company and keeps it after a reload', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    const company = page.getByLabel('Société');
    await expect(company).toHaveValue('Gagnaire Développement');
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/profile'));
    await company.fill('Atelier Bleu');
    await company.blur();
    await saved;
    // Les initiales de la pastille suivent tout de suite le nom de société.
    await expect(page.getByText('AB', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Société')).toHaveValue('Atelier Bleu');
    await expect(page.getByText('AB', { exact: true }).first()).toBeVisible();
  });

  test('updates the account balance and keeps it after a reload', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    const balance = page.getByLabel('Solde du compte');
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/balance'));
    await balance.fill('52000');
    await balance.blur();
    await saved;
    await page.reload();
    await expect(page.getByLabel('Solde du compte')).toHaveValue('52000');
  });
});

test.describe('sécurité', () => {
  test('hides the Face ID switch when passkeys are unsupported', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true });
    });
    await freshAccount(page);
    await page.goto('/profile');
    await expect(page.getByRole('switch', { name: 'Mois dans le rouge' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveCount(0);
  });

  test('reports a Face ID activation that fails', async ({ page }) => {
    await page.route('**/api/auth/passkeys/register/options', (route) =>
      route.fulfill({ status: 500, json: { code: 'BOOM', message: 'Erreur serveur.' } }));
    await freshAccount(page);
    await page.goto('/profile');
    const face = page.getByRole('switch', { name: 'Face ID' });
    await expect(face).toHaveAttribute('aria-checked', 'false');
    await face.click();
    await expect(page.getByRole('status')).toContainText('Impossible d’activer Face ID sur cet appareil.');
    await expect(face).toHaveAttribute('aria-checked', 'false');
  });

  test('reports a Face ID prompt that is cancelled', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.credentials.create = () => Promise.reject(new DOMException('annulé', 'NotAllowedError'));
    });
    await freshAccount(page);
    await page.goto('/profile');
    await page.getByRole('switch', { name: 'Face ID' }).click();
    await expect(page.getByRole('status')).toContainText('Impossible d’activer Face ID sur cet appareil.');
    await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'false');
  });

  test('turns Face ID on and off with an authenticator', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    await freshAccount(page);
    await page.goto('/profile');
    const face = page.getByRole('switch', { name: 'Face ID' });
    await expect(face).toHaveAttribute('aria-checked', 'false');
    await face.click();
    await expect(face).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('switch', { name: 'Face ID' }).click();
    await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'false');
  });

  test('changes the password', async ({ page }) => {
    const email = await freshAccount(page);
    await page.goto('/profile');
    await expect(page.getByLabel('Nouveau mot de passe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Changer de mot de passe' }).click();
    await page.getByLabel('Mot de passe actuel').fill(OLD_PASSWORD);
    await page.getByLabel('Nouveau mot de passe').fill('nouveaumdp2');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status')).toContainText('Mot de passe modifié.');
    await expect(page.getByLabel('Nouveau mot de passe')).toHaveCount(0);
    const fresh = await page.request.post('/api/auth/login', { data: { email, password: 'nouveaumdp2' } });
    expect(fresh.ok()).toBe(true);
  });

  test('disconnects the connected applications after a confirmation: their access token is then refused', async ({ page }) => {
    await freshAccount(page);
    const token = await connectApp(page.request);
    expect(await mcpStatus(page.request, token)).toBe(200);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Déconnecter les applications (Claude Code…)' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Claude Code et les autres applications connectées à ton compte perdront leur accès.', { exact: false })).toBeVisible();
    // « Annuler » ne révoque rien
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toBeHidden();
    expect(await mcpStatus(page.request, token)).toBe(200);

    await page.getByRole('button', { name: 'Déconnecter les applications (Claude Code…)' }).click();
    const revoked = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/oauth/tokens/revoke-all'));
    await dialog.getByRole('button', { name: 'Déconnecter les applications' }).click();
    expect((await revoked).status()).toBe(200);
    await expect(page.getByRole('status')).toContainText('Applications déconnectées.');
    expect(await mcpStatus(page.request, token)).toBe(401);
    // la session web, elle, reste ouverte
    expect((await page.request.get('/api/auth/me')).ok()).toBe(true);
  });

  test('reports a failure to disconnect the applications and keeps the page usable', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    await page.route('**/api/oauth/tokens/revoke-all', (route) => route.abort());
    await page.getByRole('button', { name: 'Déconnecter les applications (Claude Code…)' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Déconnecter les applications' }).click();
    await expect(page.getByRole('status')).toContainText('Connexion impossible. Vérifie ton réseau.');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Déconnecter les applications (Claude Code…)' })).toBeEnabled();
  });

  test('a password change also cuts the connected applications, and says so beforehand', async ({ page }) => {
    await freshAccount(page);
    const token = await connectApp(page.request);
    expect(await mcpStatus(page.request, token)).toBe(200);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Changer de mot de passe' }).click();
    await expect(page.getByText('Les applications connectées (Claude Code…) seront déconnectées.')).toBeVisible();
    await page.getByLabel('Mot de passe actuel').fill(OLD_PASSWORD);
    await page.getByLabel('Nouveau mot de passe').fill('nouveaumdp2');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status')).toContainText('Mot de passe modifié.');
    expect(await mcpStatus(page.request, token)).toBe(401);
  });

  test('shows the API error on a wrong current password and on a too short new one', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Changer de mot de passe' }).click();
    await page.getByLabel('Mot de passe actuel').fill('pas-le-bon-mdp');
    await page.getByLabel('Nouveau mot de passe').fill('nouveaumdp2');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();

    await page.getByLabel('Nouveau mot de passe').fill('court');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('alert')).toHaveText('Ton mot de passe doit faire au moins 8 caractères.');
    // Le formulaire reste ouvert, et « Annuler » le referme sans rien envoyer.
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByLabel('Nouveau mot de passe')).toHaveCount(0);
  });
});

test.describe('mes données', () => {
  test('replaces the data with a valid backup after confirmation', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    const file = demoExportFile();
    const backup = { ...file, profile: { ...file.profile, companyName: 'Atelier Bleu' } };
    await page.getByLabel('Importer une sauvegarde').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(page.getByText('L’import remplace toutes tes données actuelles.')).toBeVisible();
    await page.getByRole('button', { name: 'Remplacer mes données' }).click();
    await expect(page.getByRole('status')).toContainText('Sauvegarde importée.');
    await expect(page.getByLabel('Société')).toHaveValue('Atelier Bleu');
    await expect(page.getByText('AB', { exact: true }).first()).toBeVisible();
  });

  test('imports nothing when the confirmation is cancelled', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    const imports: string[] = [];
    page.on('request', (r) => { if (r.url().endsWith('/api/import')) imports.push(r.url()); });
    const input = page.getByLabel('Importer une sauvegarde');
    const upload = { name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(demoExportFile())) };
    await input.setInputFiles(upload);
    await expect(page.getByText('L’import remplace toutes tes données actuelles.')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByText('L’import remplace toutes tes données actuelles.')).toBeHidden();
    // Le même fichier peut être choisi de nouveau : la boîte se rouvre.
    await input.setInputFiles(upload);
    await expect(page.getByText('L’import remplace toutes tes données actuelles.')).toBeVisible();
    expect(imports).toHaveLength(0);
  });
});

test.describe('suppression', () => {
  test('keeps the account and explains why when the password is wrong', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    await page.getByLabel('Mot de passe').fill('pas-le-bon-mdp');
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(page.getByRole('status')).toContainText('Mot de passe incorrect.');
    await expect(page).toHaveURL(/\/profile$/);
    expect((await page.request.get('/api/auth/me')).ok()).toBe(true);
  });

  test('deleting really removes the account', async ({ page }) => {
    const email = await freshAccount(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    await page.getByLabel('Mot de passe').fill(OLD_PASSWORD);
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(page).toHaveURL(/\/login$/);
    const login = await page.request.post('/api/auth/login', { data: { email, password: OLD_PASSWORD } });
    expect(login.ok()).toBe(false);
  });
});

test.describe('mobile header', () => {
  test.skip(({ isMobile }) => !isMobile, 'version mobile');

  test('goes back to the home screen', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'version desktop');

  test('keeps the content in a 640 px column', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/profile');
    await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toHaveCount(0);
    const box = await page.locator('section', { has: page.getByRole('heading', { name: 'Mon compte' }) }).boundingBox();
    expect(box?.width).toBe(640);
  });
});
