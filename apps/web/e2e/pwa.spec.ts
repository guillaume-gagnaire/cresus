import { expect, test } from '@playwright/test';

test.skip(!process.env.E2E_BASE_URL, 'le service worker n’est généré qu’au build : test lancé contre l’image (Task 34)');

test('exposes an installable manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: 'Ma Tréso', short_name: 'Ma Tréso', display: 'standalone', theme_color: '#1F1A2E', background_color: '#FFF7EC', lang: 'fr' });
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});
