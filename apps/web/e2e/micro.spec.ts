import { demoExportFile, type ExportFileV1 } from '@matreso/engine';
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

const microDemo = (): ExportFileV1 => {
  const file = demoExportFile();
  return { ...file, profile: { ...file.profile, legalStatus: 'MICRO' } };
};

test('shows what is left for you this month', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await expect(page.getByText('Pour toi ce mois-ci').first()).toBeVisible();
  await expect(page.getByText(fr('4 040 €')).first()).toBeVisible();
  await expect(page.getByText(fr('sur 6 600 € encaissés'))).toBeVisible();
});

test('switches to versement libératoire', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await page.getByRole('switch', { name: /Versement libératoire/ }).click();
  await expect(page.getByRole('switch', { name: /Versement libératoire/ })).toHaveAttribute('aria-checked', 'true');
  // 6 600 − 1 722,60 − 145,20 − 180 = 4 552,20
  await expect(page.getByText(fr('4 550 €')).first()).toBeVisible();
});

test('the test mission tips the year over the ceiling and names the month', async ({ page }) => {
  const file: ExportFileV1 = {
    ...microDemo(),
    clients: [{
      ref: 'big', name: 'Gros client', subtitle: null, color: 'green', billingMode: 'FORFAIT', weekdays: [],
      startDate: '2026-01-01', endDate: null, paymentTerm: 'RECEPTION', averageDelayDays: 0, isProspect: false, archived: false,
      rates: [{ validFrom: '2026-01-01', amount: 680_000 }],
    }],
    leaves: [],
  };
  await freshAccount(page, { file });
  await expect(page.getByText(/Tu frôles le plafond/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Tester une mission en plus/ }).check();
  await expect(page.getByText(/tu dépasses le plafond en décembre 2026/)).toBeVisible();
  // Le dépassement est dit en rouge (teinte « danger »), pas seulement par le texte : avant la mission test, la jauge est en jaune.
  const message = page.getByRole('status').filter({ hasText: 'tu dépasses le plafond' });
  await expect(message).toHaveClass(/level-OVER/);
  await expect(message).toHaveCSS('background-color', 'rgb(251, 210, 206)');
  await expect(message).toHaveCSS('color', 'rgb(122, 26, 19)');
});

test('the status switch goes back to company mode', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await page.getByRole('group', { name: 'Statut' }).getByRole('button', { name: 'Société' }).click();
  await expect(page.getByText('Tu es dans le rouge ce mois-ci')).toBeVisible();
});

// Compléments au brief : titres par écran, pas-à-pas, plafond, provision d'impôt, cas limites.

test('greets the user and asks the question of the micro mode', async ({ page, isMobile }) => {
  await freshAccount(page, { file: microDemo() });
  const title = page.getByRole('heading', { level: 1 });
  if (isMobile) {
    await expect(title).toHaveText(fr('Combien il te reste ?'));
  } else {
    await expect(title).toContainText('Salut Guillaume');
    await expect(title).toContainText(fr('Ce mois-ci, combien il te reste ?'));
  }
  await expect(page.getByText('Mode micro-entreprise')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Statut' }).getByRole('button', { name: /^Micro/ })).toHaveAttribute('aria-pressed', 'true');
});

test('splits the month between contributions, tax, expenses and what is left', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  // 6 600 € : cotisations 26,1 % = 1 722,60 ; impôt (provision 10 %) = 660 ; frais pro 180 ; reste 4 037,40.
  await expect(page.getByRole('img', { name: fr('Cotisations 1 720 €, Impôt 660 €, Frais pro 180 €, Pour toi 4 040 €') })).toBeVisible();
  await expect(page.getByText('Cotisations URSSAF')).toBeVisible();
  await expect(page.getByText('Déclarées et payées fin novembre')).toBeVisible();
  await expect(page.getByText('Impôt sur le revenu')).toBeVisible();
  await expect(page.getByText('À garder pour ta déclaration au printemps')).toBeVisible();
});

test('says in words that the month is low, and stops saying it on the next one', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  // Octobre : 4 040 € contre 7 550 € de moyenne lissée, sous 60 % : le texte porte le sens, la teinte l'accompagne.
  await expect(page.getByText('Mois bas : nettement sous ta moyenne lissée.')).toBeVisible();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByText('novembre 2026').first()).toBeVisible();
  await expect(page.getByText('Mois bas : nettement sous ta moyenne lissée.')).toHaveCount(0);
});

test('navigates months with the arrows and the bars', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  const prev = page.getByRole('button', { name: 'Mois précédent' });
  await expect(prev).toBeDisabled();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByText('novembre 2026').first()).toBeVisible();
  await expect(page.getByText(fr('8 930 €')).first()).toBeVisible();
  await expect(page.getByText(fr('sur 14 250 € encaissés'))).toBeVisible();
  await expect(page.getByText('Déclarées et payées fin décembre')).toBeVisible();
  const bar = page.getByRole('button', { name: fr('février 2027 : 4 040 € pour toi (mois bas)') });
  await bar.click();
  await expect(bar).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('février 2027').first()).toBeVisible();
  await expect(page.getByText(fr('sur 6 600 € encaissés'))).toBeVisible();
});

test('stops the month arrows at both ends of the 15 months', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  const next = page.getByRole('button', { name: 'Mois suivant' });
  for (let i = 0; i < 14; i++) await next.click();
  await expect(page.getByText('décembre 2027').first()).toBeVisible();
  await expect(next).toBeDisabled();
});

test('shows the smoothed income over 12 months', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await expect(page.getByRole('heading', { name: /te verser chaque mois/i })).toBeVisible();
  await expect(page.getByText(fr('7 550 €')).first()).toBeVisible();
  await expect(page.getByRole('img', { name: fr('Revenu lissé sur 12 mois : 7 550 € / mois') })).toBeVisible();
  await expect(page.getByRole('button', { name: fr('octobre 2026 : 4 040 € pour toi (mois bas)') })).toBeVisible();
  await expect(page.getByRole('button', { name: fr('novembre 2026 : 8 930 € pour toi') })).toBeVisible();
});

test('reads the ceiling of the year, then of the next one', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await expect(page.getByRole('img', { name: fr('Plafond 2026 : 70 900 € sur 83 600 €, 85 %') })).toBeVisible();
  await expect(page.getByText('Tranquille : 85 % du plafond prévus sur 2026.')).toBeVisible();
  await expect(page.getByText(/Seuil de franchise de TVA dépassé en octobre 2026/)).toBeVisible();
  const years = page.getByRole('group', { name: 'Année du plafond' });
  await expect(years.getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true');
  await years.getByRole('button', { name: '2027' }).click();
  await expect(years.getByRole('button', { name: '2027' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: fr('Plafond 2027 : 131 500 € sur 83 600 €, 157 %') })).toBeVisible();
  await expect(page.getByText(/Au rythme prévu, tu dépasses le plafond en juillet 2027 \(157\s%\)/)).toBeVisible();
  await expect(page.getByText(/Seuil de franchise de TVA dépassé en mars 2027/)).toBeVisible();
  // Le signe % ne passe jamais seul en début de ligne : espace insécable, comme partout ailleurs (Playwright normalise les espaces, d'où la lecture brute).
  const message = await page.getByRole('status').filter({ hasText: 'Au rythme prévu' }).textContent();
  expect(message).toContain(`157${String.fromCharCode(0xa0)}%`);
});

test('names the next month and no client in the test mission label', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  const test650 = page.getByRole('checkbox', { name: fr('Tester une mission en plus : lundi, 650 €/j, dès novembre') });
  await expect(test650).not.toBeChecked();
  await test650.check();
  await expect(page.getByText('Tu frôles le plafond : 89 % prévus sur 2026.')).toBeVisible();
  await test650.uncheck();
  await expect(page.getByText('Tranquille : 85 % du plafond prévus sur 2026.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Client [A-D]/);
});

test('keeps the versement libératoire after a reload and hides the tax slider', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  const slider = page.getByLabel('Part à garder pour l’impôt');
  await expect(slider).toBeVisible();
  const toggle = page.getByRole('switch', { name: /Versement libératoire/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(slider).toHaveCount(0);
  await expect(page.getByText('Payé avec tes cotisations')).toBeVisible();
  await expect(page.getByText(fr('150 €')).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: /Versement libératoire/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(fr('4 550 €')).first()).toBeVisible();
});

test('saves the income tax provision from the slider', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  const slider = page.getByLabel('Part à garder pour l’impôt');
  await expect(slider).toHaveValue('10');
  await slider.fill('20');
  // 6 600 − 1 722,60 − 1 320 − 180 = 3 377,40
  await expect(page.getByText(fr('3 380 €')).first()).toBeVisible();
  await expect(page.getByText('20 %', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Part à garder pour l’impôt')).toHaveValue('20');
  await expect(page.getByText(fr('3 380 €')).first()).toBeVisible();
});

test('shows an empty account without NaN and without flagging every month as low', async ({ page }) => {
  await freshAccount(page, { file: { ...microDemo(), clients: [], leaves: [] } });
  await expect(page.getByText(fr('sur 0 € encaissés'))).toBeVisible();
  await expect(page.getByText('Tranquille : 0 % du plafond prévus sur 2026.')).toBeVisible();
  await expect(page.getByText('Sous le seuil de franchise de TVA : tu factures sans TVA.')).toBeVisible();
  await expect(page.getByText('Mois bas : nettement sous ta moyenne lissée.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /\(mois bas\)/ })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('fits the width of the screen', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await expect(page.getByText('Pour toi ce mois-ci').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keeps every control at 44 px', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await expect(page.getByText('Pour toi ce mois-ci').first()).toBeVisible();
  const targets = page.locator('button:visible, [role="switch"]:visible, input[type="range"]:visible, label:has(input[type="checkbox"]):visible');
  for (const el of await targets.all()) {
    const box = await el.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // Colonnes des graphiques (`.chart-col`) : 15 mois dans une carte, le pas-à-pas de mois est la commande équivalente.
    const chartColumn = await el.evaluate((node) => node.classList.contains('chart-col'));
    if (!chartColumn) expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

// Fix round 1 : le pas-à-pas ne reçoit pas la marge de la carte (une règle `.size-sm` de la carte atteignait aussi la racine de MonthStepper).
test('keeps the month stepper flush inside the card padding', async ({ page, isMobile }) => {
  await freshAccount(page, { file: microDemo() });
  const card = page.locator('section', { has: page.getByText('Pour toi ce mois-ci') });
  const arrow = card.getByRole('button', { name: 'Mois précédent' });
  const padding = isMobile ? 20 : 28;
  const cardBox = (await card.boundingBox())!;
  const arrowBox = (await arrow.boundingBox())!;
  expect(Math.round(arrowBox.x - cardBox.x)).toBe(padding);
  expect(Math.round(arrowBox.y - cardBox.y)).toBe(padding);
  await expect(arrow.locator('xpath=..')).toHaveCSS('padding', '0px');
});

test('shows the account badge, which links to the profile on mobile', async ({ page, isMobile }) => {
  await freshAccount(page, { file: microDemo() });
  if (isMobile) {
    const badge = page.getByRole('link', { name: 'Ton profil' });
    await expect(badge).toHaveText('GD');
    await expect(badge).toHaveAttribute('href', '/profile');
  } else {
    // Barre latérale : le logo et la pastille de la ligne de profil.
    await expect(page.getByText('GD', { exact: true })).toHaveCount(2);
  }
});
