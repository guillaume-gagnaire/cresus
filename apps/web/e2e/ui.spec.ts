import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/dev/ui');
});

test('segmented control and chips expose aria-pressed', async ({ page }) => {
  const seg = page.getByRole('group', { name: 'Démo segment' });
  await seg.getByRole('button', { name: 'Micro-entreprise' }).click();
  await expect(seg.getByRole('button', { name: 'Micro-entreprise' })).toHaveAttribute('aria-pressed', 'true');
  const chips = page.getByRole('group', { name: 'Démo jours' });
  await chips.getByRole('button', { name: 'mercredi' }).click();
  await expect(chips.getByRole('button', { name: 'mercredi' })).toHaveAttribute('aria-pressed', 'true');
});

test('switch toggles aria-checked', async ({ page }) => {
  const sw = page.getByRole('switch', { name: 'Démo interrupteur' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

test('money input emits cents', async ({ page }) => {
  await page.getByLabel('Démo montant').fill('1234,5');
  await page.getByLabel('Démo montant').blur();
  await expect(page.getByTestId('money-value')).toHaveText('123450');
});

test('targets are at least 44 px', async ({ page }) => {
  for (const el of await page.locator('button:visible, [role="switch"]:visible').all()) {
    const box = await el.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // Colonnes des graphiques à 15 mois (`.chart-col` : MiniBars, SmoothedBars) : 15 colonnes en 350 px, ou dans une carte
    // étroite, ne peuvent pas faire 44 px de large (le pas-à-pas de mois est la commande équivalente). Leur hauteur,
    // elle, est vérifiée ci-dessus ; toutes les autres cibles gardent 44 px dans les deux sens.
    const chartColumn = await el.evaluate((node) => node.classList.contains('chart-col'));
    if (!chartColumn) expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

// Compléments au brief : états et cas limites que les écrans suivants supposent acquis.

test('segmented control moves the pressed state to the chosen option only', async ({ page }) => {
  const seg = page.getByRole('group', { name: 'Démo segment' });
  await expect(seg.getByRole('button', { name: 'Société' })).toHaveAttribute('aria-pressed', 'true');
  await expect(seg.getByRole('button', { name: 'Micro-entreprise' })).toHaveAttribute('aria-pressed', 'false');
  await seg.getByRole('button', { name: 'Micro-entreprise' }).click();
  await expect(seg.getByRole('button', { name: 'Société' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('seg-value')).toHaveText('micro');
});

test('multiple chips toggle on and off and emit values in option order', async ({ page }) => {
  const chips = page.getByRole('group', { name: 'Démo jours' });
  await chips.getByRole('button', { name: 'vendredi' }).click();
  await chips.getByRole('button', { name: 'mardi' }).click();
  await expect(page.getByTestId('days-value')).toHaveText('1,4');
  await chips.getByRole('button', { name: 'vendredi' }).click();
  await expect(chips.getByRole('button', { name: 'vendredi' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('days-value')).toHaveText('1');
});

test('single chips keep exactly one pressed option', async ({ page }) => {
  const chips = page.getByRole('group', { name: 'Démo délai' });
  await chips.getByRole('button', { name: '45 jours' }).click();
  await expect(chips.getByRole('button', { name: '45 jours' })).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.getByRole('button', { name: '30 jours' })).toHaveAttribute('aria-pressed', 'false');
  await chips.getByRole('button', { name: '45 jours' }).click();
  await expect(chips.getByRole('button', { name: '45 jours' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('delay-value')).toHaveText('45');
});

test('switch works from the keyboard and from its visible label', async ({ page }) => {
  const sw = page.getByRole('switch', { name: 'Démo interrupteur' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.getByText('Démo interrupteur', { exact: true }).click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

test('switch off state keeps a visible 2 px boundary, on state is the indigo fill', async ({ page }) => {
  const sw = page.getByRole('switch', { name: 'Démo interrupteur' });
  const track = sw.locator('.track');
  // WCAG 1.4.11 : le fond de la piste éteinte (#E8DDCB) ne suffit pas, d’où le filet intérieur --muted (#6B6478).
  const off = await track.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(off).toContain('rgb(107, 100, 120)');
  expect(off).toContain('inset');
  expect(off).toContain('2px');
  const box = await track.boundingBox();
  expect([box!.width, box!.height]).toEqual([56, 34]);
  await sw.click();
  // `toHaveCSS` réessaie : la piste passe à l’indigo avec une transition de 150 ms.
  await expect(track).toHaveCSS('background-color', 'rgb(75, 75, 224)');
  await expect(track).toHaveCSS('box-shadow', 'none');
  // La taille ne bouge pas (le clic peut avoir fait défiler la page : on ne compare pas la position).
  const after = await track.boundingBox();
  expect([after!.width, after!.height]).toEqual([56, 34]);
});

test('money input accepts French typing, clamps to its bounds and rejects garbage', async ({ page }) => {
  const input = page.getByLabel('Démo montant');
  const value = page.getByTestId('money-value');
  await input.fill('1 234,56');
  await input.blur();
  await expect(value).toHaveText('123456');
  await expect(input).toHaveValue('1234,56');
  await input.fill('abc');
  await input.blur();
  await expect(value).toHaveText('123456');
  await expect(input).toHaveValue('1234,56');
  await input.fill('99999');
  await input.blur();
  await expect(value).toHaveText('1000000');
  await expect(input).toHaveValue('10000');
  await input.fill('−12');
  await input.blur();
  await expect(value).toHaveText('0');
  await input.fill('');
  await input.blur();
  await expect(value).toHaveText('null');
});

test('money input steps with the arrow keys', async ({ page }) => {
  const input = page.getByLabel('Démo montant');
  await input.fill('100');
  await input.press('Enter');
  await input.press('ArrowUp');
  await input.press('ArrowUp');
  await expect(page.getByTestId('money-value')).toHaveText('11000');
  await input.press('ArrowDown');
  await expect(page.getByTestId('money-value')).toHaveText('10500');
});

test('date input emits an ISO date', async ({ page }) => {
  await page.getByLabel('Démo date').fill('2026-10-12');
  await expect(page.getByTestId('date-value')).toHaveText('2026-10-12');
});

test('month stepper emits prev/next and disables the unavailable direction', async ({ page }) => {
  const stepper = page.getByTestId('stepper-lg');
  await expect(stepper.getByRole('button', { name: 'Mois précédent' })).toBeDisabled();
  await stepper.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(stepper).toContainText('novembre 2026');
  await stepper.getByRole('button', { name: 'Mois précédent' }).click();
  await expect(stepper).toContainText('octobre 2026');
  const small = page.getByTestId('stepper-sm');
  await small.getByRole('button', { name: 'Mois suivant' }).click();
  await small.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(small.getByRole('button', { name: 'Mois suivant' })).toBeDisabled();
});

test('month stepper label inherits the surrounding colour in both sizes', async ({ page }) => {
  // Régression : le modificateur `sm` du pas-à-pas collisionnait avec la classe globale `.sm` (13 px, --muted).
  for (const id of ['stepper-lg', 'stepper-sm']) {
    const wrapper = page.getByTestId(id);
    const colors = await wrapper.evaluate((el) => {
      const root = el.firstElementChild as HTMLElement;
      const month = root.querySelector('.month') as HTMLElement;
      return { parent: getComputedStyle(el).color, root: getComputedStyle(root).color, month: getComputedStyle(month).color };
    });
    expect(colors.parent).toBe('rgb(31, 26, 46)');
    expect(colors.root).toBe(colors.parent);
    expect(colors.month).toBe(colors.parent);
  }
});

test('confirm dialog: Escape cancels, focus is trapped and restored', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Ouvrir la confirmation' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer ce client ?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Ses missions seront supprimées.');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('dialog-result')).toHaveText('annulé');
  await expect(opener).toBeFocused();
});

test('confirm dialog: confirm emits, and the password variant sends the password', async ({ page }) => {
  await page.getByRole('button', { name: 'Ouvrir la confirmation' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByTestId('dialog-result')).toHaveText('confirmé');

  await page.getByRole('button', { name: 'Ouvrir avec mot de passe' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer mon compte ?' });
  await expect(dialog.getByLabel('Mot de passe')).toBeFocused();
  await dialog.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Mot de passe').fill('motdepasse1');
  await dialog.getByLabel('Mot de passe').press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('dialog-result')).toHaveText('confirmé avec motdepasse1');

  await page.getByRole('button', { name: 'Ouvrir avec mot de passe' }).click();
  await expect(page.getByRole('dialog').getByLabel('Mot de passe')).toHaveValue('');
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByTestId('dialog-result')).toHaveText('annulé');
});

test('buttons: variants render, disabled does not emit', async ({ page }) => {
  await page.getByRole('button', { name: 'Principal' }).click();
  await page.getByRole('button', { name: 'Secondaire' }).click();
  await page.getByRole('button', { name: 'Discret' }).click();
  await expect(page.getByTestId('click-count')).toHaveText('3');
  const disabled = page.getByRole('button', { name: 'Indisponible' });
  await expect(disabled).toBeDisabled();
  await disabled.click({ force: true });
  await expect(page.getByTestId('click-count')).toHaveText('3');
});

test('estimate note, empty state, tip and list rows show their texts', async ({ page }) => {
  await expect(page.getByText('Estimation simplifiée, à affiner avec ton expert-comptable.')).toBeVisible();
  await expect(page.getByText('Aucune charge pour le moment')).toBeVisible();
  await expect(page.getByText(/Pourquoi certains mois sont dans le rouge/)).toBeVisible();
  await expect(page.getByText('+1\u202F200\u00A0€')).toBeVisible();
});

test('kpi sub text stays ink-2 (AA on every tint, also on mobile)', async ({ page }) => {
  // Régression : en mobile, `.sub` passait en --muted (4,09:1 sur la teinte danger).
  await expect(page.locator('.kpi .sub')).toHaveCount(5);
  const colors = await page.locator('.kpi .sub').evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
  for (const color of colors) expect(color).toBe('rgb(78, 71, 98)');
});

test('no horizontal scroll and visible keyboard focus', async ({ page }) => {
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.inner);
  await page.getByRole('button', { name: 'Principal' }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const outline = await page.getByRole('button', { name: 'Principal' }).evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: s.outlineWidth, style: s.outlineStyle };
  });
  expect(outline).toEqual({ width: '3px', style: 'solid' });
});
