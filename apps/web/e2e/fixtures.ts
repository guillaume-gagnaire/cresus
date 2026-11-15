import { test as base } from '@playwright/test';

/**
 * Par défaut, la fenêtre « Installer Cresus » est considérée comme déjà refusée : elle masquerait sinon chaque écran.
 * Les tests de l'invitation l'activent avec `test.use({ installPrompt: true })`.
 */
export const test = base.extend<{ installPrompt: boolean }>({
  installPrompt: [false, { option: true }],
  page: async ({ page, installPrompt }, use) => {
    if (!installPrompt) await page.addInitScript(() => localStorage.setItem('cresus:install-dismissed', 'true'));
    await use(page);
  },
});

export { expect } from '@playwright/test';
