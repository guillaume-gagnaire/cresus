import { expect, type Page, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

/** Sur mobile, le formulaire « Poser des vacances » est replié derrière un bouton ; sur desktop, il est toujours là. */
async function openForm(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.getByRole('button', { name: 'Poser des vacances' }).click();
}

test('poses and removes a leave by clicking a day', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  const days = page.getByTestId('kpi-days');
  await expect(days).toContainText('21');
  const cell = page.getByRole('button', { name: /^mercredi 14 octobre 2026/ });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(days).toContainText('22');
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
  await expect(days).toContainText('21');
});

test('weekends and holidays are not clickable', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByRole('button', { name: /^samedi 10 octobre 2026/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByRole('button', { name: /^mercredi 11 novembre 2026/ })).toBeDisabled();
  await expect(page.getByText('Armistice')).toBeVisible();
});

test('adds a period with the form and shows its cost immediately', async ({ page, isMobile }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await openForm(page, isMobile);
  await page.getByLabel('Du', { exact: true }).fill('2027-02-15');
  await page.getByLabel('Au', { exact: true }).fill('2027-02-19');
  await page.getByRole('button', { name: 'Ajouter et simuler' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'jours ajoutés' })).toHaveText(fr('5 jours ajoutés : −3 200 € encaissés'));
  await expect(page.getByText('15 févr. → 19 févr.', { exact: false })).toBeVisible();
});

test('lists periods with their cost and impact months', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByText(fr('Se voit en janv. (−650 €), févr. (−2 400 €)'))).toBeVisible();
});

// Compléments au brief : R26 (jamais d’appel à l’API avec un identifiant tmp-), suppression, messages, cibles, pistes, états vides.

const periodsList = (page: Page) => page.getByRole('list', { name: 'Périodes de vacances' });

/** Retarde la création d’un congé de 900 ms et note les appels à l’API, pour attraper un second toucher pendant l’enregistrement. */
async function slowLeaves(page: Page): Promise<{ posts: string[]; deletes: string[] }> {
  const calls = { posts: [] as string[], deletes: [] as string[] };
  await page.route('**/api/leaves', async (route) => {
    calls.posts.push(route.request().postData() ?? '');
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  page.on('request', (r) => {
    if (r.url().endsWith('/api/leaves/delete')) calls.deletes.push(r.postData() ?? '');
  });
  return calls;
}

test('ignores a second tap on a day while its leave is still being saved (R26)', async ({ page }) => {
  await freshAccount(page);
  const calls = await slowLeaves(page);
  await page.goto('/calendar');
  const days = page.getByTestId('kpi-days');
  const cell = page.getByRole('button', { name: /^mercredi 14 octobre 2026/ });
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/leaves'));
  await cell.dblclick();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(days).toContainText('22');
  await saved;
  // Pas de 422 ni de message d’erreur, un seul appel de création, aucun appel de suppression.
  await page.waitForTimeout(300);
  await expect(page.getByRole('status').filter({ hasText: /identifiant|invalide|Impossible/ })).toHaveCount(0);
  expect(calls.posts).toHaveLength(1);
  expect(calls.deletes).toHaveLength(0);
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(days).toContainText('22');
  // L’état est bien celui du serveur.
  await page.reload();
  await expect(page.getByRole('button', { name: /^mercredi 14 octobre 2026/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('kpi-days')).toContainText('22');
});

test('keeps the delete button of a period disabled until its leave is saved (R26)', async ({ page }) => {
  await freshAccount(page);
  const calls = await slowLeaves(page);
  await page.goto('/calendar');
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/leaves'));
  await page.getByRole('button', { name: /^mercredi 14 octobre 2026/ }).click();
  const remove = page.getByRole('button', { name: 'Supprimer les vacances du 14 oct.' });
  await expect(remove).toBeDisabled();
  await saved;
  await expect(remove).toBeEnabled();
  expect(calls.deletes).toHaveLength(0);
  await remove.click();
  await expect(page.getByTestId('kpi-days')).toContainText('21');
  await expect(remove).toHaveCount(0);
});

test('removes a period and keeps it removed after a reload', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByTestId('kpi-days')).toContainText('21');
  const removed = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/leaves/delete'));
  await page.getByRole('button', { name: 'Supprimer les vacances du 24 déc.' }).click();
  await expect(page.getByTestId('kpi-days')).toContainText('16');
  await expect(page.getByText(fr('Se voit en janv. (−650 €), févr. (−2 400 €)'))).toHaveCount(0);
  await removed;
  await page.reload();
  await expect(page.getByTestId('kpi-days')).toContainText('16');
});

test('deletes only one period on a double click of its trash button (R33)', async ({ page }) => {
  await freshAccount(page);
  const deletes: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/leaves/delete')) deletes.push(r.postData() ?? '');
  });
  await page.goto('/calendar');
  await expect(page.getByTestId('kpi-days')).toContainText('21');
  await page.getByRole('button', { name: 'Supprimer les vacances du 24 déc.' }).dblclick();
  await expect(page.getByTestId('kpi-days')).toContainText('16');
  await expect(periodsList(page).getByRole('listitem')).toHaveCount(2);
  // Les corbeilles attendent la fin de la suppression, puis se réarment.
  await expect(page.getByRole('button', { name: /^Supprimer les vacances du/ }).first()).toBeEnabled();
  await page.waitForTimeout(600);
  expect(deletes).toHaveLength(1);
  await expect(page.getByTestId('kpi-days')).toContainText('16');
  await expect(periodsList(page).getByRole('listitem').filter({ hasText: '7 mai 2027' })).toHaveCount(1);
  await expect(periodsList(page).getByRole('listitem').filter({ hasText: '2 août → 20 août 2027' })).toHaveCount(1);
});

test('says when the days of a period were already posted', async ({ page, isMobile }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await openForm(page, isMobile);
  await page.getByLabel('Du', { exact: true }).fill('2026-12-24');
  await page.getByLabel('Au', { exact: true }).fill('2026-12-31');
  await page.getByRole('button', { name: 'Ajouter et simuler' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'déjà posés' })).toHaveText('Ces jours étaient déjà posés.');
  await expect(page.getByTestId('kpi-days')).toContainText('21');
});

test('refuses an end date before the start without calling the API', async ({ page, isMobile }) => {
  await freshAccount(page);
  const calls = await slowLeaves(page);
  await page.goto('/calendar');
  await openForm(page, isMobile);
  await page.getByLabel('Du', { exact: true }).fill('2027-02-19');
  await page.getByLabel('Au', { exact: true }).fill('2027-02-15');
  await page.getByRole('button', { name: 'Ajouter et simuler' }).click();
  await expect(page.getByRole('alert')).toHaveText('La date de fin ne peut pas être avant la date de début.');
  await page.getByLabel('Du', { exact: true }).fill('2027-02-20');
  await page.getByLabel('Au', { exact: true }).fill('2027-02-21');
  await page.getByRole('button', { name: 'Ajouter et simuler' }).click();
  await expect(page.getByRole('alert')).toHaveText('Aucun jour ouvré sur cette période.');
  expect(calls.posts).toHaveLength(0);
  await expect(page.getByTestId('kpi-days')).toContainText('21');
});

test('poses a leave at one client only and removes it again', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  const who = page.getByRole('group', { name: 'Poser le congé chez' });
  await expect(who.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true');
  await who.getByRole('button', { name: 'Client A' }).click();
  await expect(who.getByRole('button', { name: 'Client A' })).toHaveAttribute('aria-pressed', 'true');
  const friday = page.getByRole('button', { name: /^vendredi 16 octobre 2026/ });
  await expect(friday).toHaveAccessibleName('vendredi 16 octobre 2026 : Client A');
  await friday.click();
  await expect(friday).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('kpi-days')).toContainText('22');
  await expect(periodsList(page).getByRole('listitem').filter({ hasText: '16 oct. 2026' })).toContainText('1 jour · Client A');
  // Avec « Tous », ce congé n’est pas celui que le toucher retire.
  await who.getByRole('button', { name: 'Tous' }).click();
  await expect(friday).toHaveAttribute('aria-pressed', 'false');
  await expect(friday).toHaveAccessibleName('vendredi 16 octobre 2026 : vacances');
  await who.getByRole('button', { name: 'Client A' }).click();
  await expect(friday).toHaveAttribute('aria-pressed', 'true');
  await friday.click();
  await expect(page.getByTestId('kpi-days')).toContainText('21');
});

test('navigates the 15 months and stops at both ends', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  const prev = page.getByRole('button', { name: 'Mois précédent' });
  const next = page.getByRole('button', { name: 'Mois suivant' });
  const month = (label: string) => page.getByRole('group', { name: label, exact: true });
  await expect(month('octobre 2026')).toBeVisible();
  await expect(prev).toBeDisabled();
  for (let i = 0; i < 14; i++) await next.click();
  await expect(month('décembre 2027')).toBeVisible();
  await expect(next).toBeDisabled();
  await prev.click();
  await expect(month('novembre 2027')).toBeVisible();
});

test('words the figures and the alert from the engine results', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByTestId('kpi-days')).toContainText('21 j');
  await expect(page.getByTestId('kpi-days')).toContainText('3 périodes');
  await expect(page.getByTestId('kpi-lost')).toContainText(fr('−9 150 €'));
  await expect(page.getByTestId('kpi-low')).toContainText(fr('46 010 €'));
  await expect(page.getByTestId('kpi-low')).toContainText('en octobre 2026');
  await expect(page.getByTestId('kpi-risk')).toContainText('6');
  await expect(page.getByTestId('kpi-risk')).toContainText('2 à cause des vacances');
  await expect(page.getByRole('status').filter({ hasText: 'Tes vacances font passer' })).toContainText(
    fr('Tes vacances font passer février 2027, octobre 2027 dans le rouge : les rentrées ne couvrent plus les charges. Ton solde absorbe, il ne descend jamais sous 46 010 €.'),
  );
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('lets the page fit the screen width', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByTestId('kpi-days')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keeps a no-client account usable', async ({ page, isMobile }) => {
  await freshAccount(page, { file: null });
  await page.goto('/calendar');
  await expect(page.getByTestId('kpi-days')).toContainText('0 j');
  await expect(page.getByTestId('kpi-days')).toContainText('0 période');
  await expect(page.getByText('Aucune période posée')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Poser le congé chez' }).getByRole('button')).toHaveCount(1);
  await openForm(page, isMobile);
  await expect(page.getByRole('group', { name: 'Chez qui' }).getByRole('button')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('NaN');
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'version desktop');

  test('shows the month by month table with the leave cost and the state of each month', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Tes vacances, ta tréso' })).toBeVisible();
    await expect(page.getByText('Simulation sur 15 mois · oct. 2026 → déc. 2027')).toBeVisible();
    const feb = page.getByRole('row', { name: /février 2027/ });
    await expect(feb).toContainText(fr('−2 400 €'));
    await expect(feb).toContainText(fr('−2 310 €'));
    await expect(feb).toContainText('Rouge à cause des vacances');
    await expect(page.getByRole('row', { name: /novembre 2026/ })).toContainText('Positif');
    await expect(page.getByRole('row', { name: /octobre 2026/ })).toContainText('Dans le rouge');
    await expect(page.getByRole('row', { name: /juin 2027/ })).toContainText(fr('−700 €'));
    await expect(page.getByRole('row', { name: /janvier 2027/ })).toContainText('Assurance RC Pro');
  });

  test('describes every month of the impact chart, naming the ones the leaves turn red', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    await expect(page.getByRole('img', { name: /^février 2027 : .*\(à cause des vacances\)$/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /^novembre 2026 : / })).not.toHaveAttribute('aria-label', /à cause des vacances/);
  });

  test('counts the prospect on demand, on this screen only', async ({ page }) => {
    await freshAccount(page);
    const profileWrites: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && r.url().endsWith('/api/profile')) profileWrites.push(r.url());
    });
    await page.goto('/calendar');
    const box = page.getByLabel('Compter la piste');
    await expect(box).not.toBeChecked();
    await expect(page.getByTestId('kpi-lost')).toContainText(fr('−9 150 €'));
    await expect(periodsList(page).getByText(fr('−5 400 €'), { exact: true })).toBeVisible();
    await box.check();
    await expect(page.getByTestId('kpi-lost')).toContainText(fr('−13 350 €'));
    await expect(page.getByTestId('kpi-risk')).toContainText('4');
    await expect(periodsList(page).getByText(fr('−9 600 €'), { exact: true })).toBeVisible();
    expect(profileWrites).toHaveLength(0);
    await page.reload();
    await expect(page.getByLabel('Compter la piste')).not.toBeChecked();
  });

  test('words the cost of an added period with the prospect switch of this screen', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    const add = async (from: string, to: string) => {
      await page.getByLabel('Du', { exact: true }).fill(from);
      await page.getByLabel('Au', { exact: true }).fill(to);
      await page.getByRole('button', { name: 'Ajouter et simuler' }).click();
    };
    // Sans la piste : trois jours chez le client B (3 × 600 €).
    await add('2027-09-06', '2027-09-10');
    await expect(page.getByRole('status').filter({ hasText: 'jours ajoutés' })).toHaveText(fr('5 jours ajoutés : −1 800 € encaissés'));
    // Avec la piste cochée ici (profil inchangé) : deux lundis et vendredis chez le client C s’y ajoutent (2 × 700 €).
    await page.getByLabel('Compter la piste').check();
    await add('2027-10-04', '2027-10-08');
    await expect(page.getByRole('status').filter({ hasText: 'jours ajoutés' })).toHaveText(fr('5 jours ajoutés : −3 200 € encaissés'));
  });

  test('keeps the month table inside its card, scrolling on its own', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    const card = page.getByRole('region', { name: 'Mois par mois' });
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const viewport = page.viewportSize();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'version mobile');

  test('folds the form behind a button and unfolds it', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Tes vacances' })).toBeVisible();
    await expect(page.getByLabel('Du', { exact: true })).toHaveCount(0);
    const open = page.getByRole('button', { name: 'Poser des vacances' });
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Du', { exact: true })).toBeVisible();
    await open.click();
    await expect(page.getByLabel('Du', { exact: true })).toHaveCount(0);
  });

  test('lists the months that matter, each with its state', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    await expect(page.getByRole('img', { name: /Mois à cause des vacances : février 2027/ })).toBeVisible();
    const month = (label: string) => page.getByRole('listitem').filter({ hasText: label });
    await expect(month('février 2027')).toContainText(fr('vacances : −2 400 €'));
    await expect(month('février 2027')).toContainText('Rouge à cause des vacances');
    await expect(month('octobre 2026')).toContainText('creux lié aux délais de paiement');
    await expect(month('novembre 2026')).toHaveCount(0);
  });

  test('marks a posed leave with a glyph, not by its colour alone', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    const marker = (name: RegExp) =>
      page.getByRole('button', { name }).evaluate((el) => {
        const style = getComputedStyle(el, '::after');
        return { content: style.content, height: style.height, width: style.width };
      });
    const free = await marker(/^mercredi 14 octobre 2026/);
    expect(free.content === 'none' || free.content === 'normal').toBe(true);
    await page.getByRole('button', { name: /^mercredi 14 octobre 2026/ }).click();
    await expect(page.getByRole('button', { name: /^mercredi 14 octobre 2026/ })).toHaveAttribute('aria-pressed', 'true');
    const posed = await marker(/^mercredi 14 octobre 2026/);
    expect(posed.content).not.toBe('none');
    expect(parseFloat(posed.width)).toBeGreaterThanOrEqual(10);
    expect(parseFloat(posed.height)).toBeGreaterThanOrEqual(3);
  });

  test('keeps the calendar cells touch-sized', async ({ page }) => {
    await freshAccount(page);
    await page.goto('/calendar');
    const box = await page.getByRole('button', { name: /^mercredi 14 octobre 2026/ }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
