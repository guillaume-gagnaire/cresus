import { euros } from '@matreso/engine';
import { expect, test, type Page } from '@playwright/test';
import { freshAccount } from './helpers';

interface TresoWindow {
  __treso: {
    status: string;
    results: Array<{ result: number; balance: number }>;
    balance: { amount: number; date: string } | null;
    data: { leaves: unknown[]; charges: Array<{ id: string; name: string }> };
    today: string;
    loadedAt: number;
    addLeaves: (input: unknown) => Promise<unknown>;
    setBalance: (amount: number) => Promise<unknown>;
    addCharge: (input: unknown) => Promise<unknown>;
  };
}

/** La mise en page charge le store après le premier rendu : on attend qu’il soit prêt avant de le manipuler. */
async function treso(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as Partial<TresoWindow>).__treso?.status === 'ready');
}

test('loads the state once and exposes engine results', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  const result = await page.evaluate(() => {
    const store = (window as unknown as TresoWindow).__treso;
    return { first: store.results[0]?.result, balance: store.results[0]?.balance, count: store.results.length };
  });
  expect(result).toEqual({ first: -231_400, balance: 4_600_600, count: 15 });
});

test('rolls back by reloading when the API refuses a mutation', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  const outcome = await page.evaluate(async () => {
    const store = (window as unknown as TresoWindow).__treso;
    const before = store.data.leaves.length;
    const res = await store.addLeaves({ from: '2026-12-26', scope: 'ALL' }); // samedi → 422
    return { res, before, after: store.data.leaves.length };
  });
  expect(outcome.res).toBeNull();
  expect(outcome.after).toBe(outcome.before);
  await expect(page.getByRole('status')).toContainText('Ce jour n’est pas ouvré');
});

// Compléments au brief : écriture optimiste, date locale du solde (R15), session expirée (R22), solde de la barre latérale.

test('applies a balance optimistically and sends the browser local date', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  await page.route('**/api/balance', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  const request = page.waitForRequest((r) => r.url().endsWith('/api/balance') && r.method() === 'POST');
  const optimistic = await page.evaluate(() => {
    const store = (window as unknown as TresoWindow).__treso;
    void store.setBalance(1_234_500);
    return { amount: store.balance?.amount, date: store.balance?.date }; // avant la réponse de l’API
  });
  expect(optimistic).toEqual({ amount: 1_234_500, date: '2026-10-04' });
  expect((await request).postDataJSON()).toEqual({ amount: 1_234_500, date: '2026-10-04' });
  await page.waitForResponse((r) => r.url().endsWith('/api/balance'));
  const state = await (await page.request.get('/api/state')).json();
  expect(state.balance.latest).toMatchObject({ amount: 1_234_500, date: '2026-10-04' });
});

test('replaces the temporary id of a created charge with the server one', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  const created = await page.evaluate(async () => {
    const store = (window as unknown as TresoWindow).__treso;
    await store.addCharge({ name: 'Assurance pro', amount: 4_500, frequency: 'MONTHLY', month: null, category: null });
    return store.data.charges.find((c) => c.name === 'Assurance pro')?.id ?? null;
  });
  expect(created).not.toBeNull();
  expect(created).not.toMatch(/^tmp-/);
});

test('shows the latest balance in the sidebar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'La barre latérale n’existe que sur desktop.');
  await freshAccount(page);
  const balance = page.getByRole('link', { name: /Sur le compte/ });
  await expect(balance).toContainText(euros(4_832_000));
  await expect(balance).toContainText('Mis à jour le');
});

test('sends the user back to the login screen when the session has expired', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  await page.request.post('/api/auth/logout', { data: {} }); // la session meurt côté serveur, l’app ne le sait pas encore
  const res = await page.evaluate(async () => (window as unknown as TresoWindow).__treso.setBalance(500_000));
  expect(res).toBeNull();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toContainText('Ta session a expiré, reconnecte-toi.');
  const data = await page.evaluate(() => (window as unknown as TresoWindow).__treso.data);
  expect(data).toBeNull();
});

// Revue finale : modification optimiste annulée hors ligne, rafraîchissement à la reprise de la PWA.

const NEW_CHARGE = { name: 'Abonnement e2e', amount: 4_500, frequency: 'MONTHLY', month: null, category: null };

test('rolls an optimistic edit back when the save fails and the reload fails too (offline)', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  await page.route('**/api/charges', (route) => route.abort());
  await page.route('**/api/state', (route) => route.abort());
  const outcome = await page.evaluate(async (charge) => {
    const store = (window as unknown as TresoWindow).__treso;
    const before = store.data.charges.map((c) => c.name);
    const pending = store.addCharge(charge); // la charge est ajoutée tout de suite, avant la réponse
    const optimistic = store.data.charges.map((c) => c.name);
    const res = await pending;
    return { res, before, optimistic, after: store.data.charges.map((c) => c.name), status: store.status };
  }, NEW_CHARGE);
  expect(outcome.optimistic).toEqual([...outcome.before, 'Abonnement e2e']);
  expect(outcome.res).toBeNull();
  expect(outcome.after).toEqual(outcome.before);
  expect(outcome.status).toBe('ready');
  // un seul message : l’échec de l’enregistrement, pas un second « Impossible de charger tes données »
  await expect(page.locator('.toast')).toHaveCount(1);
  await expect(page.locator('.toast')).toHaveText('Connexion impossible. Vérifie ton réseau.');
  // et l’écran n’affiche plus la charge (navigation dans l’app : un rechargement de page échouerait hors ligne)
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Charges' }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByText('Abonnement e2e')).toHaveCount(0);
  await expect(page.getByText('Assurance RC Pro').first()).toBeVisible(); // les charges de démo, elles, sont bien là
});

test('can still snapshot the state after a mutation that reassigned an array of reactive items', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  // addLeaves remplace `data.leaves` par un tableau construit à partir d’éléments réactifs : la copie d’instantané doit le supporter
  const added = await page.evaluate(async () => {
    const store = (window as unknown as TresoWindow).__treso;
    const before = store.data.leaves.length;
    await store.addLeaves({ from: '2026-10-14', scope: 'ALL' });
    return { before, after: store.data.leaves.length };
  });
  expect(added.after).toBe(added.before + 1);
  await page.route('**/api/charges', (route) => route.abort());
  await page.route('**/api/state', (route) => route.abort());
  const outcome = await page.evaluate(async (charge) => {
    const store = (window as unknown as TresoWindow).__treso;
    const before = { leaves: store.data.leaves.length, charges: store.data.charges.length };
    const res = await store.addCharge(charge);
    return { res, before, after: { leaves: store.data.leaves.length, charges: store.data.charges.length } };
  }, NEW_CHARGE);
  expect(outcome.res).toBeNull();
  expect(outcome.after).toEqual(outcome.before);
});

test('keeps the server state (not the snapshot) when the save fails but the reload succeeds', async ({ page }) => {
  await freshAccount(page);
  await treso(page);
  await page.route('**/api/charges', (route) => route.abort());
  // une autre session a ajouté une charge entre-temps : le rechargement la ramène
  await page.request.post('/api/charges', { data: { name: 'Ajoutée ailleurs', amount: 1_000, frequency: 'MONTHLY', month: null, category: null } });
  const after = await page.evaluate(async (charge) => {
    const store = (window as unknown as TresoWindow).__treso;
    await store.addCharge(charge);
    return store.data.charges.map((c) => c.name);
  }, NEW_CHARGE);
  expect(after).toContain('Ajoutée ailleurs');
  expect(after).not.toContain('Abonnement e2e');
});

test.describe('resuming the app', () => {
  const stateRequests = (page: Page): string[] => {
    const seen: string[] = [];
    page.on('request', (r) => { if (r.url().endsWith('/api/state')) seen.push(r.url()); });
    return seen;
  };
  const resume = (page: Page, event: 'visibilitychange' | 'focus') =>
    page.evaluate((name) => (name === 'focus' ? window : document).dispatchEvent(new Event(name)), event);

  test('refreshes “today” and the projection when the day changed while the app slept', async ({ page }) => {
    await freshAccount(page);
    await treso(page);
    await expect(page.getByText('octobre 2026').first()).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-02T08:30:00'));
    await resume(page, 'visibilitychange');
    await expect(page.getByText('novembre 2026').first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as TresoWindow).__treso.today)).toBe('2026-11-02');
  });

  test('also refreshes when the window regains focus', async ({ page }) => {
    await freshAccount(page);
    await treso(page);
    await page.clock.setFixedTime(new Date('2026-11-02T08:30:00'));
    await resume(page, 'focus');
    await expect(page.getByText('novembre 2026').first()).toBeVisible();
  });

  test('reloads data older than 5 minutes, but not fresh data of the same day', async ({ page }) => {
    await freshAccount(page);
    await treso(page);
    const seen = stateRequests(page);
    await page.clock.setFixedTime(new Date('2026-10-04T10:04:00')); // 4 minutes : rien à faire
    await resume(page, 'visibilitychange');
    await resume(page, 'focus');
    await page.waitForTimeout(500);
    expect(seen).toHaveLength(0);
    const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/state'));
    await page.clock.setFixedTime(new Date('2026-10-04T10:06:00')); // 6 minutes
    await resume(page, 'visibilitychange');
    expect((await refreshed).status()).toBe(200);
    // une fois rechargées, les données sont de nouveau fraîches
    await expect.poll(() => page.evaluate(() => (window as unknown as TresoWindow).__treso.loadedAt)).toBe(new Date('2026-10-04T10:06:00').getTime());
    const before = seen.length;
    await resume(page, 'visibilitychange');
    await page.waitForTimeout(500);
    expect(seen).toHaveLength(before);
  });

  test('does not refresh while the page is hidden, and stays silent when the network is down', async ({ page }) => {
    await freshAccount(page);
    await treso(page);
    const seen = stateRequests(page);
    await page.clock.setFixedTime(new Date('2026-11-02T08:30:00'));
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await resume(page, 'visibilitychange');
    await page.waitForTimeout(500);
    expect(seen).toHaveLength(0);
    // de retour au premier plan, mais hors ligne : l’écran reste en place, sans message d’erreur
    await page.route('**/api/state', (route) => route.abort());
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }));
    await resume(page, 'visibilitychange');
    await expect.poll(() => seen.length).toBe(1);
    await page.waitForTimeout(300);
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(page.getByText('octobre 2026').first()).toBeVisible();
    // le réseau revient : la reprise suivante rattrape
    await page.unroute('**/api/state');
    await resume(page, 'focus');
    await expect(page.getByText('novembre 2026').first()).toBeVisible();
  });
});
