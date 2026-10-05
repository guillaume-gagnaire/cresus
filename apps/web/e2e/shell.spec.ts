import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test('redirects to /login without a session, remembering the requested page', async ({ page }) => {
  await page.goto('/expenses');
  // vue-router n’encode pas les « / » d’une valeur de requête : les deux écritures désignent le même paramètre.
  await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)expenses$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('navigates between the four sections', async ({ page, isMobile }) => {
  await freshAccount(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('link', { name: isMobile ? 'Charges' : 'Charges' }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await nav.getByRole('link', { name: isMobile ? 'Missions' : 'Clients & missions' }).click();
  await expect(page).toHaveURL(/\/clients$/);
});
