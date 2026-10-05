import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'contrôles 390 px');

for (const path of ['/', '/clients', '/calendar', '/expenses', '/profile', '/clients/new']) {
  test(`no horizontal scroll and 44 px targets on ${path}`, async ({ page }) => {
    await freshAccount(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
    for (const el of await page.locator('button:visible, [role="switch"]:visible, .chip:visible').all()) {
      const box = await el.boundingBox();
      if (!box) continue;
      expect.soft(box.height, await el.getAttribute('aria-label') ?? await el.innerText()).toBeGreaterThanOrEqual(44);
      // Colonnes des graphiques à 15 mois (`.chart-col` : MiniBars, SmoothedBars) : 15 colonnes en 350 px ne peuvent pas faire
      // 44 px de large (le pas-à-pas de mois est la commande équivalente) ; leur hauteur, elle, est vérifiée ci-dessus.
      // Même exception que dans ui.spec.ts et micro.spec.ts ; toutes les autres cibles gardent 44 px dans les deux sens.
      if (await el.evaluate((node) => node.classList.contains('chart-col'))) continue;
      expect.soft(box.width, await el.getAttribute('aria-label') ?? await el.innerText()).toBeGreaterThanOrEqual(44);
    }
  });
}

test('the login screen fits 390 px', async ({ page }) => {
  await page.goto('/login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
