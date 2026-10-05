import { expect, test } from '@playwright/test';

// Contrôles propres au build servi par l'API (service worker, en-têtes de cache, repli SPA) : lancés contre `npm run e2e:prod`.
test.skip(!process.env.E2E_BASE_URL, 'ces contrôles portent sur le build de production : test lancé contre l’API qui sert le front (npm run e2e:prod)');
test.skip(({ isMobile }) => isMobile, 'indépendant du viewport : joué une seule fois, par le projet desktop');

const NO_CACHE = 'no-cache';
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Routes que seule l'API sert (même origine que le SPA) : le service worker ne doit jamais y répondre. */
const SERVER_PATHS = [
  '/api/health',
  '/mcp',
  '/authorize?response_type=code',
  '/token',
  '/register',
  '/revoke',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource/mcp',
];
/** Routes du SPA, dont les noms ressemblent à ceux du serveur : le service worker doit au contraire les servir. */
const SPA_PATHS = ['/', '/login', '/calendar', '/clients/new', '/oauth/consent?request=abc', '/apiary', '/tokens', '/registered'];

test.describe('service worker', () => {
  test('denies every server route in its navigation fallback, and only those', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBe(true);
    const source = await res.text();
    // le tableau se termine à la première « / » suivie de « ]} » (un « / » dans une classe de caractères n'est jamais suivi de « ]} »)
    const denylist = /denylist:\[(.*?\/)\]\}/.exec(source)?.[1];
    expect(denylist, 'denylist de NavigationRoute introuvable dans sw.js').toBeTruthy();
    // chaque entrée est un littéral d'expression régulière : on les évalue pour tester leur effet plutôt que leur texte
    const patterns = new Function(`return [${denylist}]`)() as RegExp[];
    expect(patterns.length).toBeGreaterThanOrEqual(7);
    for (const path of SERVER_PATHS) expect(patterns.some((pattern) => pattern.test(path)), `${path} doit être exclu`).toBe(true);
    for (const path of SPA_PATHS) expect(patterns.some((pattern) => pattern.test(path)), `${path} doit rester servi par le SPA`).toBe(false);
  });

  test('lets the server answer its own routes while the worker controls the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // le worker prend la main (clients.claim) : la page est contrôlée avant de naviguer vers les routes du serveur
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null)).toBe('activated');

    const metadata = await page.goto('/.well-known/oauth-authorization-server');
    expect(metadata?.fromServiceWorker()).toBe(false);
    expect(metadata?.headers()['content-type']).toContain('application/json');
    expect(await metadata?.json()).toMatchObject({ issuer: expect.stringContaining(new URL(page.url()).origin) });

    const health = await page.goto('/api/health');
    expect(health?.fromServiceWorker()).toBe(false);
    expect(await health?.json()).toEqual({ status: 'ok', db: 'ok' });

    // et le SPA, lui, reste servi par le worker (coquille précachée) sur une URL profonde
    const deep = await page.goto('/clients/new');
    expect(deep?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
});

test.describe('en-têtes de cache', () => {
  test('revalidates the shell, the service worker, the manifest and the app manifest of Nuxt', async ({ request }) => {
    for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/_nuxt/builds/latest.json', '/calendar', '/clients/new']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['cache-control'], path).toBe(NO_CACHE);
    }
    const latest = (await (await request.get('/_nuxt/builds/latest.json')).json()) as { id: string };
    const meta = await request.get(`/_nuxt/builds/meta/${latest.id}.json`);
    expect(meta.status()).toBe(200);
    expect(meta.headers()['cache-control']).toBe(NO_CACHE);
  });

  test('keeps the fingerprinted assets of _nuxt immutable', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/_nuxt\/[^"]+)"/g)].map((match) => match[1] as string);
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      const res = await request.get(asset);
      expect(res.status(), asset).toBe(200);
      expect(res.headers()['cache-control'], asset).toBe(IMMUTABLE);
    }
  });
});

test.describe('repli SPA', () => {
  test('answers a prerendered folder URL with the shell itself, not a redirect', async ({ request }) => {
    const res = await request.get('/calendar', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('<title>Ma Tréso');
  });

  test('never lets the API be swallowed by the fallback, whatever the case of the path', async ({ request }) => {
    for (const path of ['/api/health', '/API/health', '/Api/Health']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(await res.json(), path).toEqual({ status: 'ok', db: 'ok' });
    }
    const unknown = await request.get('/API/inconnu');
    expect(unknown.status()).toBe(404);
    expect(unknown.headers()['content-type']).toContain('application/json');
    const mcp = await request.get('/Mcp');
    expect(mcp.status()).toBe(401);
    expect(mcp.headers()['content-type']).not.toContain('text/html');
  });
});
