import { createHash, randomBytes } from 'node:crypto';
import { expect, type APIRequestContext, type Page, test } from '@playwright/test';

const ORIGIN = 'http://localhost:3000';
const RESOURCE = `${ORIGIN}/mcp`;
const CALLBACK = 'http://localhost:3999/callback';
const CONSENT_PATH = /^\/oauth\/consent\?request=[0-9a-f-]{36}$/;
const EXPIRED ='Cette demande d’autorisation a expiré. Relance la connexion depuis Claude Code.';
const PASSWORD = 'motdepasse1';

const b64url = (buffer: Buffer): string => buffer.toString('base64url');

/** Enregistrement dynamique d’un client public (RFC 7591), par le proxy Nuxt comme le ferait Claude Code. */
async function registerClient(request: APIRequestContext, opts: { name?: string; redirectUri?: string } = {}): Promise<string> {
  const res = await request.post('/register', {
    data: {
      client_name: opts.name ?? 'Claude Code',
      redirect_uris: [opts.redirectUri ?? CALLBACK],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

/** Demande d’autorisation PKCE S256 : l’URL à ouvrir, l’état attendu au retour et le vérificateur du jeton. */
function authorization(clientId: string, redirectUri = CALLBACK) {
  const verifier = b64url(randomBytes(32));
  const state = b64url(randomBytes(12));
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: b64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    state,
    scope: 'cresus',
    resource: RESOURCE,
  });
  return { url: `/authorize?${query}`, state, verifier };
}

/** Compte neuf créé dans un contexte à part : la page, elle, reste déconnectée. */
async function accountElsewhere(request: APIRequestContext): Promise<string> {
  const email = `oauth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@matreso.test`;
  const res = await request.post('/api/auth/register', { data: { email, password: PASSWORD, firstName: 'Camille' } });
  expect(res.ok(), await res.text()).toBe(true);
  return email;
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).last().click();
}

/** Le « callback » de Claude Code (localhost:3999) n’existe pas : on répond nous-mêmes pour que la navigation aboutisse. */
async function fakeCallback(page: Page): Promise<void> {
  await page.route('http://localhost:3999/callback**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }));
}

/** Sur /login, avec le chemin demandé en paramètre `redirect` (vue-router laisse les « / » et « ? » d’une valeur sans les encoder : on compare la valeur décodée). */
async function expectLoginRedirect(page: Page, target: RegExp): Promise<void> {
  await expect.poll(() => {
    const url = new URL(page.url());
    return url.pathname === '/login' ? url.searchParams.get('redirect') : null;
  }).toMatch(target);
}

const consentHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Claude Code veut accéder à ton compte Ma Tréso' });

test('signs up from the login redirect, approves, and hands a usable code back', async ({ page }) => {
  await fakeCallback(page);
  const clientId = await registerClient(page.request);
  const { url, state, verifier } = authorization(clientId);

  await page.goto(url);
  await expectLoginRedirect(page, CONSENT_PATH);

  await page.getByRole('button', { name: 'Créer un compte' }).first().click();
  await page.getByLabel('Prénom').fill('Camille');
  await page.getByLabel('E-mail').fill(`oauth-${Date.now()}@matreso.test`);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page).toHaveURL(/\/oauth\/consent\?request=/);
  await expect(consentHeading(page)).toBeVisible();
  await expect(page.getByText('Il pourra consulter ta trésorerie et modifier tes clients, congés et charges en ton nom.')).toBeVisible();
  await expect(page.getByText('Après validation, tu seras renvoyé vers localhost:3999.')).toBeVisible();
  await expect(page.getByText('Tu pourras révoquer l’accès en te déconnectant de l’app MCP.')).toBeVisible();

  await page.getByRole('button', { name: 'Autoriser' }).click();
  await page.waitForURL(/localhost:3999\/callback\?/);
  const back = new URL(page.url());
  expect(back.searchParams.get('state')).toBe(state);
  const code = back.searchParams.get('code');
  expect(code).toBeTruthy();

  // Le code est bien échangeable contre un jeton (PKCE vérifié), par le proxy /token.
  const token = await page.request.post('/token', {
    form: { grant_type: 'authorization_code', code: code ?? '', code_verifier: verifier, client_id: clientId, redirect_uri: CALLBACK, resource: RESOURCE },
  });
  expect(token.status(), await token.text()).toBe(200);
  expect(((await token.json()) as { access_token?: string }).access_token).toBeTruthy();
});

test('signs in from the login redirect, then denies with access_denied', async ({ page, request }) => {
  await fakeCallback(page);
  const email = await accountElsewhere(request);
  const clientId = await registerClient(page.request);
  const { url, state } = authorization(clientId);

  await page.goto(url);
  await expectLoginRedirect(page, CONSENT_PATH);
  await signIn(page, email);

  await expect(page).toHaveURL(/\/oauth\/consent\?request=/);
  await expect(consentHeading(page)).toBeVisible();
  await page.getByRole('button', { name: 'Refuser' }).click();
  await page.waitForURL(/localhost:3999\/callback\?/);
  const back = new URL(page.url());
  expect(back.searchParams.get('error')).toBe('access_denied');
  expect(back.searchParams.get('state')).toBe(state);
  expect(back.searchParams.get('code')).toBeNull();
});

test('opens the consent screen directly when a session already exists', async ({ page }) => {
  await accountElsewhere(page.request); // session dans le contexte de la page
  const clientId = await registerClient(page.request);
  await page.goto(authorization(clientId).url);
  await expect(page).toHaveURL(/\/oauth\/consent\?request=/);
  await expect(consentHeading(page)).toBeVisible();
  // Écran sans barre latérale ni onglets : le layout `auth`.
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);
});

test('shows the redirect host prominently, whatever name the client gives itself', async ({ page }) => {
  await accountElsewhere(page.request);
  const evil = 'https://evil.example:8443/callback';
  const clientId = await registerClient(page.request, { redirectUri: evil });
  await page.goto(authorization(clientId, evil).url);
  await expect(consentHeading(page)).toBeVisible();
  const host = page.getByText('evil.example:8443', { exact: true });
  await expect(host).toBeVisible();
  await expect(host).toHaveCSS('font-weight', '800');
  await expect(page.getByText('Après validation, tu seras renvoyé vers evil.example:8443.')).toBeVisible();
});

test('reports an expired or unknown request with a link back home', async ({ page }) => {
  await accountElsewhere(page.request);
  for (const path of ['/oauth/consent?request=00000000-0000-4000-8000-000000000000', '/oauth/consent?request=pas-un-identifiant', '/oauth/consent']) {
    await page.goto(path);
    await expect(page.getByRole('alert')).toHaveText(EXPIRED);
    await expect(page.getByRole('button', { name: 'Autoriser' })).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Retour à Ma Tréso' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('switches to the expired state when the request expires while the screen is open', async ({ page }) => {
  await accountElsewhere(page.request);
  const clientId = await registerClient(page.request);
  await page.goto(authorization(clientId).url);
  await expect(consentHeading(page)).toBeVisible();
  await page.route('**/api/oauth/requests/*/approve', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'NOT_FOUND', message: EXPIRED }) }),
  );
  await page.getByRole('button', { name: 'Autoriser' }).click();
  await expect(page.getByRole('alert')).toHaveText(EXPIRED);
  await expect(page.getByRole('button', { name: 'Autoriser' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Retour à Ma Tréso' })).toHaveAttribute('href', '/');
});

test('keeps the buttons usable after a network failure so the user can retry', async ({ page }) => {
  await accountElsewhere(page.request);
  const clientId = await registerClient(page.request);
  await page.goto(authorization(clientId).url);
  await expect(consentHeading(page)).toBeVisible();
  await page.route('**/api/oauth/requests/*/deny', (route) => route.abort());
  await page.getByRole('button', { name: 'Refuser' }).click();
  await expect(page.getByRole('alert')).toHaveText('Connexion impossible. Vérifie ton réseau.');
  await expect(page.getByRole('button', { name: 'Refuser' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Autoriser' })).toBeEnabled();
});

test('refuses to follow a redirect target that is not an http(s) address', async ({ page }) => {
  await accountElsewhere(page.request);
  const clientId = await registerClient(page.request);
  await page.goto(authorization(clientId).url);
  await expect(consentHeading(page)).toBeVisible();
  await page.route('**/api/oauth/requests/*/approve', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ redirectUrl: 'javascript:alert(1)' }) }),
  );
  await page.getByRole('button', { name: 'Autoriser' }).click();
  await expect(page.getByRole('alert')).toHaveText('Une erreur est survenue. Réessaie dans un instant.');
  await expect(page).toHaveURL(/\/oauth\/consent\?request=/);
  await expect(page.getByRole('button', { name: 'Autoriser' })).toBeEnabled();
});

test('sends the user back through the login when the session is lost on the consent screen', async ({ page }) => {
  await accountElsewhere(page.request);
  const clientId = await registerClient(page.request);
  await page.goto(authorization(clientId).url);
  await expect(consentHeading(page)).toBeVisible();
  await page.route('**/api/oauth/requests/*/approve', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'Connecte-toi pour continuer.' }) }),
  );
  await page.getByRole('button', { name: 'Autoriser' }).click();
  await expectLoginRedirect(page, CONSENT_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Content de te revoir');
});

test('goes back to the page that required a session after signing in',async ({ page, request }) => {
  const email = await accountElsewhere(request);
  await page.goto('/expenses');
  await expectLoginRedirect(page, /^\/expenses$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/expenses$/);
});

test('ignores a redirect that leaves the app after signing in', async ({ page, request }) => {
  const email = await accountElsewhere(request);
  await page.goto('/login?redirect=https://evil.example');
  await signIn(page, email);
  await expect(page).toHaveURL(`${ORIGIN}/`);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
});

test('only follows same-app relative paths for an already signed-in visitor', async ({ page }) => {
  await accountElsewhere(page.request);
  const hostile = ['https://evil.example', '//evil.example', '/\\evil.example', '/%5Cevil.example', '/%2F%2Fevil.example', '/\t/evil.example', 'javascript:alert(1)', 'expenses', '/%E0%A4%A'];
  for (const redirect of hostile) {
    await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
    await expect(page, redirect).toHaveURL(`${ORIGIN}/`);
  }
  await page.goto(`/login?redirect=${encodeURIComponent('/expenses')}`);
  await expect(page).toHaveURL(`${ORIGIN}/expenses`);
});
