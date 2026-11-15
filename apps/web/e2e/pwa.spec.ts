import { expect, test } from './fixtures';

test.use({ installPrompt: true });

test('le bouton « Installer » ouvre la fenêtre d’installation du navigateur, même annoncée avant le démarrage de l’appli', async ({ page }) => {
  // Chrome et Android annoncent qu'ils savent installer l'appli par « beforeinstallprompt », parfois très tôt
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
      event.prompt = async () => {
        (window as unknown as { __prompted: boolean }).__prompted = true;
      };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
  });
  await page.goto('/login');
  const dialog = page.getByRole('dialog', { name: 'Installer Cresus' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Installer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted === true)).toBe(true);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Installer l’appli' })).toHaveCount(0);
});

test('le site déclare son manifeste (sinon le navigateur ne propose jamais l’installation)', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL, 'manifeste et service worker générés seulement par le build de production (npm run e2e:prod)');
  await page.goto('/login');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'Cresus', display: 'standalone', start_url: '/' });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
});
