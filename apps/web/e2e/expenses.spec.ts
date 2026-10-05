import { demoExportFile, type ExportFileV1 } from '@matreso/engine';
import { expect, type Page, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

const microDemo = (): ExportFileV1 => {
  const file = demoExportFile();
  return { ...file, profile: { ...file.profile, legalStatus: 'MICRO' } };
};

/** Un forfait de 7 000 € par mois dès janvier : 84 000 € encaissés en 2026, au-dessus du plafond de 83 600 €. */
const overCeilingMicro = (): ExportFileV1 => ({
  ...microDemo(),
  clients: [{
    ref: 'big', name: 'Gros client', subtitle: null, color: 'green', billingMode: 'FORFAIT', weekdays: [],
    startDate: '2026-01-01', endDate: null, paymentTerm: 'RECEPTION', averageDelayDays: 0, isProspect: false, archived: false,
    rates: [{ validFrom: '2026-01-01', amount: 700_000 }],
  }],
  leaves: [],
});

/** Retarde la création d’une charge de 900 ms et note les appels de modification et de suppression. */
async function slowCharges(page: Page): Promise<{ patches: string[]; deletes: string[] }> {
  const calls = { patches: [] as string[], deletes: [] as string[] };
  await page.route('**/api/charges', async (route) => {
    if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  page.on('request', (r) => {
    if (!/\/api\/charges\/.+/.test(r.url())) return;
    if (r.method() === 'PATCH') calls.patches.push(r.url());
    if (r.method() === 'DELETE') calls.deletes.push(r.url());
  });
  return calls;
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'version desktop');

  test('switching to EURL à l’IS lowers the cost from 7 200 € to 5 800 € (acceptance criterion)', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByText(fr('7 200 €')).first()).toBeVisible();
    await page.getByRole('button', { name: 'EURL à l’IS' }).click();
    await expect(page.getByRole('button', { name: 'EURL à l’IS' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(fr('5 800 €')).first()).toBeVisible();
    await expect(page.getByRole('row', { name: /Cotisations sociales/ })).toContainText(fr('1 800 €'));
    await expect(page.getByRole('row', { name: /Cotisations sociales/ })).toContainText('calculé');
  });

  test('adds, edits and deletes a charge', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await page.getByLabel('Nom de la charge').fill('Coworking');
    await page.getByLabel('Montant', { exact: true }).fill('250');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const row = page.getByRole('row', { name: /Coworking/ });
    await expect(row).toBeVisible();
    await row.getByLabel('Montant de Coworking').fill('300');
    // Le montant est bien enregistré côté serveur avant le rechargement (sinon la requête peut être coupée).
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/charges\/.+/.test(r.url()));
    await row.getByLabel('Montant de Coworking').blur();
    await saved;
    await page.reload();
    await expect(page.getByRole('row', { name: /Coworking/ }).getByLabel('Montant de Coworking')).toHaveValue('300');
    const removed = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/charges\/.+/.test(r.url()));
    await page.getByRole('row', { name: /Coworking/ }).getByRole('button', { name: 'Supprimer Coworking' }).click();
    await expect(page.getByRole('row', { name: /Coworking/ })).toHaveCount(0);
    await removed;
    await page.reload();
    await expect(page.getByRole('row', { name: /Logiciels/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Coworking/ })).toHaveCount(0);
  });

  test('a yearly charge asks for its month', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await page.getByLabel('Nom de la charge').fill('Domaine');
    await page.getByLabel('Montant', { exact: true }).fill('15');
    await expect(page.getByLabel('Mois du prélèvement')).toHaveCount(0);
    await page.getByRole('button', { name: 'Annuelle' }).click();
    await page.getByLabel('Mois du prélèvement').selectOption({ label: 'mars' });
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('row', { name: /Domaine/ })).toContainText('Une fois par an');
    await expect(page.getByRole('row', { name: /Domaine/ })).toContainText('mars');
  });

  // Compléments au brief : lignes, chiffres, curseur, statuts, micro, R26 et R33, formulaire, états vides, gabarit.

  test('lists the computed lines first, read-only, then the stored charges', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const rows = page.getByRole('row');
    await expect(rows.nth(1)).toContainText('Salaire (net)');
    await expect(rows.nth(1)).toContainText('Chaque mois · calculé');
    await expect(rows.nth(1)).toContainText(fr('4 000 €'));
    await expect(rows.nth(2)).toContainText('Cotisations sociales');
    await expect(rows.nth(2)).toContainText(fr('3 200 €'));
    for (const name of ['Salaire (net)', 'Cotisations sociales']) {
      await expect(page.getByRole('row', { name: new RegExp(name.replace('(', '\\(').replace(')', '\\)')) }).getByRole('textbox')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Supprimer ${name}` })).toHaveCount(0);
    }
    const insurance = page.getByRole('row', { name: /Assurance RC Pro/ });
    await expect(insurance).toContainText('Une fois par an · janvier');
    await expect(insurance.getByLabel('Montant de Assurance RC Pro')).toHaveValue('660');
    await expect(insurance).toContainText(fr('55 €'));
  });

  test('says the average and the yearly total of the charges', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByTestId('kpi-average')).toContainText('Par mois, en moyenne');
    await expect(page.getByTestId('kpi-average')).toContainText(fr('9 020 €'));
    await expect(page.getByTestId('kpi-average')).toContainText('annuelles lissées sur 12 mois');
    await expect(page.getByTestId('kpi-year')).toContainText(fr('108 230 €'));
    await expect(page.getByTestId('kpi-year')).toContainText('10 charges');
  });

  test('compares the same net under the three social regimes and marks the current one', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const group = page.getByRole('group', { name: 'Le même net selon le régime social' });
    await expect(group.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(group.locator('[aria-current="true"]')).toContainText('Assimilé salarié');
    await expect(group).toContainText(fr('7 200 €'));
    await expect(group).toContainText('Indépendant (TNS)');
    await expect(group).toContainText(fr('5 800 €'));
    await expect(group).toContainText('Micro-entreprise');
    await expect(group).toContainText(fr('5 410 €'));
    await page.getByRole('button', { name: 'EI', exact: true }).click();
    await expect(group.locator('[aria-current="true"]')).toContainText('Indépendant (TNS)');
  });

  test('words the equation and the help sentence after the legal status', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByText('Président assimilé salarié : régime général')).toBeVisible();
    await expect(page.getByText('Coût pour la société')).toBeVisible();
    await expect(page.getByText(/^≈ 80\s% du net$/)).toBeVisible();
    await expect(page.getByText(/soit 86\s400\s€ par an/)).toBeVisible();
    await page.getByRole('button', { name: 'EURL à l’IR' }).click();
    await expect(page.getByText('Pas de salaire : tu prélèves ce que tu veux.')).toBeVisible();
    await expect(page.getByText('Bénéfice nécessaire')).toBeVisible();
    await expect(page.getByText(/^≈ 45\s% du net$/)).toBeVisible();
    await expect(page.getByText('Ce que tu te verses par mois (net)')).toBeVisible();
    await expect(page.getByRole('row', { name: /Ta rémunération \(net\)/ })).toBeVisible();
  });

  test('sets the net pay by typing it and keeps it after a reload', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/profile'));
    await page.getByLabel('Montant exact').fill('3000');
    await page.getByLabel('Montant exact').blur();
    await expect(page.getByText(fr('5 400 €')).first()).toBeVisible();
    await expect(page.getByRole('row', { name: /Salaire \(net\)/ })).toContainText(fr('3 000 €'));
    await expect(page.getByRole('row', { name: /Cotisations sociales/ })).toContainText(fr('2 400 €'));
    // Le total des charges suit : 5 400 € de rémunération + 1 819 € de charges saisies lissées = 7 219 €, arrondis à la dizaine.
    await expect(page.getByTestId('kpi-average')).toContainText(fr('7 220 €'));
    await saved;
    await page.reload();
    await expect(page.getByLabel('Montant exact')).toHaveValue('3000');
    await expect(page.getByText(fr('5 400 €')).first()).toBeVisible();
    await expect(page.getByTestId('kpi-average')).toContainText(fr('7 220 €'));
  });

  test('makes the average of the charges follow the legal status', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByTestId('kpi-average')).toContainText(fr('9 020 €'));
    await page.getByRole('button', { name: 'EURL à l’IS' }).click();
    // 5 800 € de rémunération + 1 819 € de charges saisies lissées = 7 619 €, arrondis à la dizaine.
    await expect(page.getByTestId('kpi-average')).toContainText(fr('7 620 €'));
    await expect(page.getByTestId('kpi-year')).toContainText(fr('91 430 €'));
  });

  test('ends the card with the exact estimate mention, then the assumptions on their own line', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByText('Estimation simplifiée, à affiner avec ton expert-comptable.', { exact: true })).toHaveCount(1);
    await expect(page.getByText(/^Cotisations ≈ 80\s% du net en assimilé salarié, ≈ 45\s% en TNS, 26,1\s% du CA en micro/)).toBeVisible();
    await expect(page.getByText('L’impôt sur le revenu n’est pas compté.', { exact: false })).toBeVisible();
  });

  test('moves the net pay with the slider and saves it when released', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/profile'));
    await page.getByLabel(/Salaire net par mois/).fill('5000');
    await expect(page.getByText(fr('9 000 €')).first()).toBeVisible();
    await saved;
    await page.reload();
    await expect(page.getByLabel('Montant exact')).toHaveValue('5000');
  });

  test('has no computed lines in micro, and says where the contributions went', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await page.getByRole('button', { name: 'Micro', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Micro', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('CA à encaisser')).toBeVisible();
    await expect(page.getByText(fr('5 410 €')).first()).toBeVisible();
    await expect(page.getByText(/Cotisations : 26,1\s% de ce que tu encaisses/)).toBeVisible();
    await expect(page.getByText(/Plafond de CA d’environ 83\s600\s€ par an/)).toBeVisible();
    await expect(page.getByRole('row', { name: /Cotisations sociales/ })).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Salaire \(net\)/ })).toHaveCount(0);
    await expect(page.getByText('En micro-entreprise, tes cotisations sont prélevées sur ce que tu encaisses')).toBeVisible();
    await expect(page.getByTestId('kpi-average')).toContainText(fr('1 820 €'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Micro', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('warns that the micro ceiling is exceeded only in micro and only when it is', async ({ page }) => {
    await freshAccount(page, { file: overCeilingMicro() });
    await page.goto('/expenses');
    const alert = page.getByRole('status').filter({ hasText: 'tu dépasses le plafond de la micro-entreprise' });
    await expect(alert).toContainText(/Avec ton CA actuel \(environ 84\s000\s€ par an\)/);
    await page.getByRole('button', { name: 'SASU', exact: true }).click();
    await expect(page.getByRole('button', { name: 'SASU', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(alert).toHaveCount(0);
  });

  test('stays quiet in micro when the ceiling is not exceeded', async ({ page }) => {
    await freshAccount(page, { file: { ...microDemo(), clients: [], leaves: [] } });
    await page.goto('/expenses');
    await expect(page.getByRole('button', { name: 'Micro', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/tu dépasses le plafond de la micro-entreprise/)).toHaveCount(0);
  });

  test('keeps the last company status for the way back from micro', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await page.getByRole('button', { name: 'EURL à l’IS' }).click();
    await page.getByRole('button', { name: 'Micro', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Micro', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => (window as unknown as { __treso: { setCompanyMode: (m: 'COMPANY') => Promise<unknown> } }).__treso.setCompanyMode('COMPANY'));
    await expect(page.getByRole('button', { name: 'EURL à l’IS' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('freezes a charge until the server has saved it (R26)', async ({ page }) => {
    await freshAccount(page);
    const calls = await slowCharges(page);
    await page.goto('/expenses');
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/charges'));
    await page.getByLabel('Nom de la charge').fill('Coworking');
    await page.getByLabel('Montant', { exact: true }).fill('250');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const row = page.getByRole('row', { name: /Coworking/ });
    await expect(row.getByLabel('Montant de Coworking')).toBeDisabled();
    await expect(row.getByRole('button', { name: 'Supprimer Coworking' })).toBeDisabled();
    await created;
    await expect(row.getByLabel('Montant de Coworking')).toBeEnabled();
    await expect(row.getByRole('button', { name: 'Supprimer Coworking' })).toBeEnabled();
    expect(calls.patches).toHaveLength(0);
    expect(calls.deletes).toHaveLength(0);
  });

  test('deletes only one charge on a double click of its trash button (R33)', async ({ page }) => {
    await freshAccount(page);
    const deletes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'DELETE' && /\/api\/charges\//.test(r.url())) deletes.push(r.url());
    });
    await page.goto('/expenses');
    await expect(page.getByRole('row', { name: /Logiciels/ })).toBeVisible();
    await page.getByRole('button', { name: 'Supprimer Logiciels' }).dblclick();
    await expect(page.getByRole('row', { name: /Logiciels/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Supprimer / }).first()).toBeEnabled();
    await page.waitForTimeout(600);
    expect(deletes).toHaveLength(1);
    await expect(page.getByRole('row', { name: /Banque pro/ })).toBeVisible();
    await expect(page.getByTestId('kpi-year')).toContainText('9 charges');
  });

  test('refuses a charge without a name or an amount, without calling the API', async ({ page }) => {
    await freshAccount(page);
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/charges')) posts.push(r.url());
    });
    await page.goto('/expenses');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Donne un nom à cette charge.' })).toBeVisible();
    await page.getByLabel('Nom de la charge').fill('Coworking');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Indique un montant supérieur à 0.' })).toBeVisible();
    await page.getByLabel('Montant', { exact: true }).fill('250');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /^(Donne un nom|Indique un montant)/ })).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Coworking/ })).toBeVisible();
    expect(posts).toHaveLength(1);
    await expect(page.getByLabel('Nom de la charge')).toHaveValue('');
  });

  test('stores the category of a charge', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await page.getByLabel('Nom de la charge').fill('Mutuelle');
    await page.getByLabel('Montant', { exact: true }).fill('60');
    await page.getByLabel('Catégorie').selectOption('Social');
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/charges'));
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    expect((await (await created).json()).category).toBe('Social');
  });

  test('shows an empty state when a micro account has no charge', async ({ page }) => {
    await freshAccount(page, { file: { ...microDemo(), charges: [] } });
    await page.goto('/expenses');
    await expect(page.getByText('Aucune charge pour le moment')).toBeVisible();
    await expect(page.getByTestId('kpi-year')).toContainText('0 charge');
  });

  test('fits the width of the screen and keeps every control at 44 px', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByRole('heading', { name: 'Tes charges' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Logiciels/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const el of await page.locator('button:visible, input[type="range"]:visible, select:visible, input[type="text"]:visible').all()) {
      const box = await el.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'version mobile');

  test('shows the remuneration card and switches the legal status', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByRole('heading', { name: 'Tes charges' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ta rémunération' })).toBeVisible();
    await expect(page.getByText(fr('7 200 €')).first()).toBeVisible();
    await page.getByRole('button', { name: 'EURL à l’IS' }).click();
    await expect(page.getByRole('button', { name: 'EURL à l’IS' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(fr('5 800 €')).first()).toBeVisible();
    await expect(page.getByText('Gérant indépendant (TNS) : moins de cotisations')).toBeVisible();
    await expect(page.getByText(/\(≈ 45\s%\)/)).toBeVisible();
    const regimes = page.getByRole('group', { name: 'Le même net selon le régime' });
    await expect(regimes.locator('[aria-current="true"]')).toContainText('Indépendant (TNS)');
    // Le total des charges suit : 5 800 € de rémunération + 1 819 € de charges saisies lissées = 7 619 €, arrondis à la dizaine.
    await expect(page.getByRole('region', { name: 'Total des charges' })).toContainText(fr('7 620 €'));
  });

  test('ends the card with the exact estimate mention, then the short assumptions', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByText('Estimation simplifiée, à affiner avec ton expert-comptable.', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Impôt sur le revenu non compté.', { exact: true })).toBeVisible();
  });

  test('sets aria-controls on a charge line only while its editor is open', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const toggle = page.getByRole('region', { name: 'Tes charges' }).getByRole('button', { name: /^Logiciels/ });
    await expect(toggle).not.toHaveAttribute('aria-controls', /.*/);
    await toggle.click();
    const target = await toggle.getAttribute('aria-controls');
    expect(target).toMatch(/^charge-/);
    await expect(page.locator(`[id="${target}"]`)).toBeVisible();
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-controls', /.*/);
  });

  test('lists the computed lines read-only and the stored charges', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const list = page.getByRole('region', { name: 'Tes charges' });
    await expect(list.getByRole('listitem').nth(0)).toContainText('Salaire (net)');
    await expect(list.getByRole('listitem').nth(0)).toContainText('Chaque mois · calculé');
    await expect(list.getByRole('listitem').nth(1)).toContainText('Cotisations sociales');
    await expect(list.getByRole('listitem').nth(1)).toContainText(fr('3 200 €'));
    await expect(list.getByRole('button', { name: /Cotisations sociales/ })).toHaveCount(0);
    await expect(list.getByRole('listitem').filter({ hasText: 'Assurance RC Pro' })).toContainText(`Une fois par an · janvier (${fr('660 €')})`);
    await expect(list.getByRole('listitem').filter({ hasText: 'Assurance RC Pro' })).toContainText(fr('55 €'));
  });

  test('switches the total between a month and a year', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const total = page.getByRole('region', { name: 'Total des charges' });
    await expect(total).toContainText('Chaque mois, en moyenne');
    await expect(total).toContainText(fr('9 020 €'));
    await expect(page.getByRole('button', { name: 'Par mois', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Par an', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Par an', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(total).toContainText('Sur un an');
    await expect(total).toContainText(fr('108 230 €'));
    await expect(total).toContainText('Les charges annuelles sont lissées sur 12 mois');
    const list = page.getByRole('region', { name: 'Tes charges' });
    await expect(list.getByRole('listitem').filter({ hasText: 'Logiciels' })).toContainText(fr('1 140 €'));
  });

  test('folds the form behind a button, adds a charge and folds it again', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const open = page.getByRole('button', { name: 'Ajouter une charge' });
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Nom de la charge')).toHaveCount(0);
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await page.getByLabel('Nom de la charge').fill('Domaine');
    await page.getByLabel('Montant', { exact: true }).fill('15');
    await page.getByRole('button', { name: 'Annuelle' }).click();
    await page.getByLabel('Mois du prélèvement').selectOption({ label: 'mars' });
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByLabel('Nom de la charge')).toHaveCount(0);
    const item = page.getByRole('region', { name: 'Tes charges' }).getByRole('listitem').filter({ hasText: 'Domaine' });
    await expect(item).toContainText(`Une fois par an · mars (${fr('15 €')})`);
  });

  test('edits the amount of a charge and deletes it from the unfolded line', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    const item = page.getByRole('region', { name: 'Tes charges' }).getByRole('listitem').filter({ hasText: 'Logiciels' });
    const toggle = item.getByRole('button', { name: /^Logiciels/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const amount = item.getByLabel('Montant de Logiciels');
    await expect(amount).toHaveValue('95');
    await amount.fill('120');
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/charges\/.+/.test(r.url()));
    await amount.blur();
    await saved;
    await expect(item).toContainText(fr('120 €'));
    await page.reload();
    await expect(page.getByRole('region', { name: 'Tes charges' }).getByRole('listitem').filter({ hasText: 'Logiciels' })).toContainText(fr('120 €'));
    await page.getByRole('region', { name: 'Tes charges' }).getByRole('button', { name: /^Logiciels/ }).click();
    const removed = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/charges\/.+/.test(r.url()));
    await page.getByRole('button', { name: 'Supprimer Logiciels' }).click();
    await expect(page.getByRole('region', { name: 'Tes charges' }).getByText('Logiciels')).toHaveCount(0);
    await removed;
    await page.reload();
    await expect(page.getByRole('region', { name: 'Tes charges' }).getByText('Banque pro')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tes charges' }).getByText('Logiciels')).toHaveCount(0);
  });

  test('puts the micro warning in its short form and has no computed line', async ({ page }) => {
    await freshAccount(page, { file: overCeilingMicro() });
    await page.goto('/expenses');
    await expect(page.getByRole('status').filter({ hasText: /Avec ton CA actuel \(~84\s000\s€\/an\), tu dépasses le plafond micro\./ })).toBeVisible();
    await expect(page.getByText('CA à encaisser')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tes charges' }).getByText('Cotisations sociales')).toHaveCount(0);
    await expect(page.getByText('En micro-entreprise, tes cotisations sont prélevées sur ce que tu encaisses')).toBeVisible();
  });

  test('fits the width of the screen and keeps every control at 44 px', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/expenses');
    await expect(page.getByRole('heading', { name: 'Tes charges' })).toBeVisible();
    await page.getByRole('region', { name: 'Tes charges' }).getByRole('button', { name: /^Logiciels/ }).click();
    await page.getByRole('button', { name: 'Ajouter une charge' }).click();
    await expect(page.getByLabel('Nom de la charge')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const el of await page.locator('button:visible, input[type="range"]:visible, select:visible, input[type="text"]:visible').all()) {
      const box = await el.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});
