import { expect, test } from './fixtures';

test.use({ installPrompt: true });

test('propose d’installer l’appli à la première ouverture, puis garde un bouton sur la connexion', async ({ page }) => {
  await page.goto('/login');
  const dialog = page.getByRole('dialog', { name: 'Installer Cresus' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /plus tard/i }).click();
  await expect(dialog).toBeHidden();
  const button = page.getByRole('button', { name: 'Installer l’appli' });
  await expect(button).toBeVisible();

  await page.reload();
  await expect(button).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('dialog', { name: 'Installer Cresus' })).toBeHidden();

  await button.click();
  await expect(page.getByRole('dialog', { name: 'Installer Cresus' })).toBeVisible();
});
