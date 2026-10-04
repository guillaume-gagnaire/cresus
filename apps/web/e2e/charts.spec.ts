import { expect, test, type Locator } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/dev/ui');
});

/** Premier ancêtre qui défile horizontalement : le conteneur large du graphique. */
const scrollerOf = (chart: Locator) =>
  chart.evaluateHandle((el) => {
    let node = el.parentElement;
    while (node && getComputedStyle(node).overflowX !== 'auto') node = node.parentElement;
    return node;
  });

test('result bars are labelled buttons with selection', async ({ page }) => {
  const bars = page.getByRole('group', { name: 'Démo barres' });
  await bars.getByRole('button', { name: fr('novembre 2026 : +5 340 €') }).click();
  await expect(bars.getByRole('button', { name: fr('novembre 2026 : +5 340 €') })).toHaveAttribute('aria-pressed', 'true');
});

test('gauge and timeline expose a readable summary', async ({ page }) => {
  await expect(page.getByRole('img', { name: /plafond/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ouvrir Client A/ })).toBeVisible();
});

// Compléments au brief : les écrans suivants s’appuient sur ces comportements.

test('result bars: one pressed bar at a time, shared with the compact bars, keyboard selectable', async ({ page }) => {
  const large = page.getByRole('group', { name: 'Démo barres' });
  const compact = page.getByRole('group', { name: 'Démo compacte des barres' });
  await expect(large.getByRole('button', { pressed: true })).toHaveCount(1);
  await expect(large.getByRole('button')).toHaveCount(15);
  await compact.getByRole('button', { name: fr('février 2027 : −2 310 €') }).click();
  await expect(compact.getByRole('button', { name: fr('février 2027 : −2 310 €') })).toHaveAttribute('aria-pressed', 'true');
  await expect(large.getByRole('button', { name: fr('février 2027 : −2 310 €') })).toHaveAttribute('aria-pressed', 'true');
  await expect(large.getByRole('button', { pressed: true })).toHaveCount(1);
  const other = large.getByRole('button', { name: fr('mars 2027 : +11 890 €') });
  await other.focus();
  await page.keyboard.press('Enter');
  await expect(other).toHaveAttribute('aria-pressed', 'true');
  await expect(compact.getByRole('button', { name: fr('mars 2027 : +11 890 €') })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chart-selected')).toHaveText('mars 2027');
});

test('result bars: heights are proportional to the largest absolute value (76 px per side)', async ({ page }) => {
  const large = page.getByRole('group', { name: 'Démo barres' });
  const heights = (name: string) =>
    large.getByRole('button', { name: fr(name) }).evaluate((el) => [...el.querySelectorAll('span')].map((s) => Math.round(s.getBoundingClientRect().height * 10) / 10));
  // mars 2027 (+11 890 €) est le plus grand : 76 px au-dessus de l’axe.
  expect(await heights('mars 2027 : +11 890 €')).toContain(76);
  // octobre 2027 (−5 160 €) : 5160 / 11890 × 76 = 33 px sous l’axe.
  expect(await heights('octobre 2027 : −5 160 €')).toContain(33);
  // La couleur du libellé suit le signe (vert pour un mois positif, rouge sinon).
  const color = (name: string) => large.getByRole('button', { name: fr(name) }).locator('.num').evaluate((el) => getComputedStyle(el).color);
  expect(await color('mars 2027 : +11 890 €')).toBe('rgb(30, 107, 58)');
  expect(await color('octobre 2027 : −5 160 €')).toBe('rgb(194, 39, 45)');
});

test('result bars are at least 44 px wide and tall, compact bars at least 44 px tall', async ({ page }) => {
  for (const button of await page.getByRole('group', { name: 'Démo barres' }).getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  for (const button of await page.getByRole('group', { name: 'Démo compacte des barres' }).getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test('compact bars highlight the months given by key, and the read-only variant is an image', async ({ page }) => {
  const compact = page.getByRole('group', { name: 'Démo compacte des barres' });
  const bg = (name: string) => compact.getByRole('button', { name: fr(name) }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('février 2027 : −2 310 €')).toBe('rgb(255, 230, 207)');
  expect(await bg('mars 2027 : +11 890 €')).toBe('rgba(0, 0, 0, 0)');
  const readonly = page.getByRole('img', { name: 'Démo compacte des barres en lecture seule' });
  await expect(readonly).toBeVisible();
  await expect(readonly.getByRole('button')).toHaveCount(0);
});

test('timeline: bars select a mission, prospects are dashed and dimmed on demand, open ends are square', async ({ page }) => {
  const timeline = page.getByRole('group', { name: 'Démo frise' });
  const barA = timeline.getByRole('button', { name: /Ouvrir Client A/ });
  const barC = timeline.getByRole('button', { name: /Ouvrir Client C/ });
  await expect(barA).toHaveAccessibleName('Ouvrir Client A : Du 1er octobre 2026 au 31 mai 2027');
  await expect(barC).toHaveAccessibleName('Ouvrir Client C : Du 1er juillet 2027 au 31 décembre 2027');
  await expect(barA).toHaveAttribute('aria-pressed', 'true');
  await barC.click();
  await expect(barC).toHaveAttribute('aria-pressed', 'true');
  await expect(barA).toHaveAttribute('aria-pressed', 'false');
  // Le nom de la mission ouvre la même mission.
  await timeline.getByRole('button', { name: /^Client B/ }).click();
  await expect(barC).toHaveAttribute('aria-pressed', 'false');
  await expect(timeline.getByRole('button', { name: /Ouvrir Client B/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chart-selected-mission')).toHaveText('client-b');
  // « Compter les pistes » : la piste s’estompe et le message du creux change.
  const message = page.getByText(/Creux repéré/);
  await expect(barC).toHaveCSS('opacity', '0.45');
  await expect(message).toContainText('Creux repéré');
  await page.getByRole('switch', { name: 'Démo compter les pistes' }).click();
  await expect(barC).toHaveCSS('opacity', '1');
  // Client B n’a pas de fin : bord droit droit (rayon 0), bord gauche arrondi.
  const radius = await timeline.getByRole('button', { name: /Ouvrir Client B/ }).locator('span').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.borderTopLeftRadius, s.borderTopRightRadius];
  });
  expect(radius).toEqual(['12px', '0px']);
});

test('timeline: the bars are at least 44 px high and the gap strip names every month', async ({ page }) => {
  const timeline = page.getByRole('group', { name: 'Démo frise' });
  for (const button of await timeline.getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const strip = page.getByRole('img', { name: /Creux de CA/ });
  await expect(strip).toHaveAccessibleName(/juin : 9\s750/);
  await expect(page.getByTestId('chart-timeline').getByText('Creux de CA', { exact: true })).toBeVisible();
});

test('gauge: filled and hatched parts follow the percentages, VAT marker is positioned', async ({ page }) => {
  const gauge = page.getByRole('img', { name: /plafond/i });
  await expect(gauge).toHaveAccessibleName(/2026/);
  const metrics = await gauge.evaluate((el) => {
    const rail = [...el.querySelectorAll('span')].find((s) => s.children.length === 2)!;
    const [actual, planned] = [...rail.children] as HTMLElement[];
    const w = rail.getBoundingClientRect().width;
    return { actual: actual!.getBoundingClientRect().width / w, planned: planned!.getBoundingClientRect().width / w, hatch: getComputedStyle(planned!).backgroundImage };
  });
  // Démo : 35 200 € encaissés, 35 700 € prévus, sur une échelle de 83 600 € × 1,1.
  expect(metrics.actual).toBeCloseTo(35200 / (83600 * 1.1), 2);
  expect(metrics.planned).toBeCloseTo(35700 / (83600 * 1.1), 2);
  expect(metrics.hatch).toContain('repeating-linear-gradient');
  await expect(page.getByTestId('chart-gauge').getByText('Seuil TVA')).toBeVisible();
  await expect(page.getByTestId('chart-gauge').getByText('Déjà encaissé')).toBeVisible();
  await expect(page.getByTestId('chart-gauge').getByText('Prévu', { exact: true })).toBeVisible();
});

test('stacked cash bars: 12 labelled columns, tallest segment scaled to 170 px, segments at least 4 px', async ({ page }) => {
  const stacked = page.getByRole('group', { name: 'Démo encaissements' });
  const columns = stacked.getByRole('img');
  await expect(columns).toHaveCount(12);
  await expect(columns.first()).toHaveAccessibleName(fr('octobre 2026 : 6 600 € encaissés'));
  const sizes = await columns.evaluateAll((els) =>
    els.map((el) => [...el.querySelectorAll<HTMLElement>('[style*="height"]')].map((s) => Math.round(s.getBoundingClientRect().height * 10) / 10)),
  );
  const all = sizes.flat();
  expect(Math.max(...all)).toBeLessThanOrEqual(180);
  // Le mois le plus chargé (mars 2027, 20 800 €) fait 170 px au total, hors espaces entre segments.
  const stackedHeights = sizes.map((s) => s.filter((h) => h <= 170));
  expect(stackedHeights.every((s) => s.every((h) => h >= 4))).toBe(true);
  const largestTotal = Math.max(...stackedHeights.map((s) => s.reduce((a, b) => a + b, 0)));
  expect(largestTotal).toBeGreaterThanOrEqual(168);
  expect(largestTotal).toBeLessThanOrEqual(172);
  await expect(stacked.getByText('20,8k')).toBeVisible();
});

test('leave impact bars: two bars per month, highlighted months, labelled columns', async ({ page }) => {
  const leave = page.getByRole('group', { name: 'Démo congés' });
  const feb = leave.getByRole('img', { name: fr('février 2027 : +90 € sans vacances, −2 310 € avec vacances') });
  await expect(feb).toBeVisible();
  expect(await feb.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 230, 207)');
  const march = leave.getByRole('img', { name: /mars 2027/ });
  expect(await march.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await expect(leave.getByRole('img')).toHaveCount(15);
  await expect(page.getByTestId('chart-leave').getByText('Sans vacances', { exact: true })).toBeVisible();
});

test('split bar: segments are proportional to the total and the legend gives every amount', async ({ page }) => {
  const split = page.getByRole('img', { name: /Démo répartition du mois/ });
  await expect(split).toHaveAccessibleName(/Cotisations/);
  await expect(split).toHaveAccessibleName(/Pour toi/);
  const widths = await split.evaluate((el) => {
    const bar = [...el.querySelectorAll('span')].find((s) => s.children.length === 4)!;
    const w = bar.getBoundingClientRect().width;
    return [...bar.children].map((c) => c.getBoundingClientRect().width / w);
  });
  expect(widths).toHaveLength(4);
  const [cot, tax, fees, you] = widths as [number, number, number, number];
  expect(cot + tax + fees + you).toBeCloseTo(1, 2);
  expect(cot).toBeCloseTo(0.261, 2);
  await expect(page.getByTestId('chart-split').getByText('Pour toi', { exact: true }).first()).toBeVisible();
});

test('smoothed bars: low months are orange, the average is a dashed line, bars select a month', async ({ page }) => {
  const smoothed = page.getByRole('group', { name: 'Démo lissage' });
  await expect(smoothed.getByRole('button')).toHaveCount(15);
  await smoothed.getByRole('button', { name: fr('février 2027 : 4 040 € pour toi') }).click();
  await expect(smoothed.getByRole('button', { name: fr('février 2027 : 4 040 € pour toi') })).toHaveAttribute('aria-pressed', 'true');
  await expect(smoothed.getByRole('button', { pressed: true })).toHaveCount(1);
  const fill = (name: string) =>
    smoothed.getByRole('button', { name: fr(name) }).evaluate((el) => getComputedStyle(el.querySelector('span span')!).backgroundColor);
  expect(await fill('février 2027 : 4 040 € pour toi')).toBe('rgb(255, 138, 61)');
  expect(await fill('mars 2027 : 13 110 € pour toi')).toBe('rgb(46, 158, 106)');
  const average = smoothed.getByRole('img', { name: /Moyenne lissée/ });
  await expect(average).toBeVisible();
  expect(await average.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('dashed');
});

test('smoothed bars: the average line sits at the height of the average bar', async ({ page }) => {
  const smoothed = page.getByRole('group', { name: 'Démo lissage' });
  const line = await smoothed.getByRole('img', { name: /Moyenne lissée/ }).boundingBox();
  // Moyenne 7 550 € ; le plus grand mois (mars 2027) fait 13 110 € : la ligne est à 7549 / 13111 de la hauteur max.
  const march = await smoothed.getByRole('button', { name: fr('mars 2027 : 13 110 € pour toi') }).evaluate((el) => {
    const bar = el.querySelector('span span') as HTMLElement;
    const r = bar.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });
  expect(march.height).toBeCloseTo(160, 0);
  const expected = march.bottom - (160 * 7549.25) / 13111.2;
  expect(line!.y).toBeGreaterThan(expected - 3);
  expect(line!.y).toBeLessThan(expected + 3);
});

test('charts are wide inside their own card and never widen the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Démo barres', 'Démo frise', 'Démo encaissements', 'Démo congés']) {
    const chart = page.getByRole('group', { name, exact: true });
    const scroller = await scrollerOf(chart);
    const { overflowing, insideCard } = await scroller.evaluate((el) => ({
      overflowing: (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth,
      insideCard: el!.parentElement!.closest('.card') !== null,
    }));
    expect(overflowing, name).toBe(true);
    expect(insideCard, name).toBe(true);
  }
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.inner);
});

test('compact variants fit 350 px without any scroll', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 800 });
  const compact = [
    page.getByRole('group', { name: 'Démo compacte des barres' }),
    page.getByRole('img', { name: 'Démo compacte des barres en lecture seule' }),
    page.getByRole('group', { name: 'Démo compacte du lissage' }),
    page.getByRole('group', { name: 'Démo compacte des encaissements' }),
    page.getByRole('img', { name: /Démo compacte de la répartition/ }),
    page.getByTestId('chart-gauge-compact'),
  ];
  for (const chart of compact) {
    const fits = await chart.evaluate((el) => {
      const card = el.closest('.card')!;
      const cardBox = card.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { insideCard: box.left >= cardBox.left - 0.5 && box.right <= cardBox.right + 0.5, noScroll: el.scrollWidth <= el.clientWidth + 1 };
    });
    expect(fits.insideCard).toBe(true);
    expect(fits.noScroll).toBe(true);
  }
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.inner);
});

test('compact smoothed bars and stacked bars keep their labels and values', async ({ page }) => {
  const smoothed = page.getByRole('group', { name: 'Démo compacte du lissage' });
  await expect(smoothed.getByRole('button')).toHaveCount(15);
  await expect(smoothed.getByRole('img', { name: /Moyenne lissée/ })).toBeVisible();
  const stacked = page.getByRole('group', { name: 'Démo compacte des encaissements' });
  await expect(stacked.getByRole('img')).toHaveCount(12);
  await expect(stacked.getByRole('img').first()).toHaveAccessibleName(fr('octobre 2026 : 6 600 € encaissés'));
});

// Correctifs R27 : les états ne reposent jamais sur la couleur seule.

test('smoothed bars: a low month is hatched and named « mois bas », in both variants', async ({ page }) => {
  for (const name of ['Démo lissage', 'Démo compacte du lissage']) {
    const smoothed = page.getByRole('group', { name, exact: true });
    const low = smoothed.getByRole('button', { name: /mois bas/ });
    // Octobre 2026, février 2027 et octobre 2027 sont sous 60 % de la moyenne ; aucun autre mois.
    await expect(low).toHaveCount(3);
    await expect(low.first()).toHaveAccessibleName(fr('octobre 2026 : 4 040 € pour toi (mois bas)'));
    const image = (button: Locator) => button.evaluate((el) => getComputedStyle(el.querySelector('span span')!).backgroundImage);
    for (const button of await low.all()) expect(await image(button)).toContain('repeating-linear-gradient');
    const regular = smoothed.getByRole('button', { name: fr('mars 2027 : 13 110 € pour toi'), exact: true });
    await expect(regular).toBeVisible();
    expect(await image(regular)).toBe('none');
  }
});

test('highlighted months have a dashed outline and say why, on compact bars (also read-only) and on leave bars', async ({ page }) => {
  const dashed = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el, '::after').borderTopStyle);
  const compact = page.getByRole('group', { name: 'Démo compacte des barres' });
  const feb = compact.getByRole('button', { name: fr('février 2027 : −2 310 € (à cause des vacances)'), exact: true });
  await expect(feb).toBeVisible();
  expect(await dashed(feb)).toBe('dashed');
  const march = compact.getByRole('button', { name: fr('mars 2027 : +11 890 €'), exact: true });
  await expect(march).toBeVisible();
  expect(await dashed(march)).toBe('none');
  await expect(compact.getByRole('button', { name: /à cause des vacances/ })).toHaveCount(2);

  // Image seule : les mois surlignés sont nommés dans la description.
  const readonly = page.getByRole('img', { name: 'Démo compacte des barres en lecture seule' });
  await expect(readonly).toHaveAccessibleName(/à cause des vacances : février 2027 : −2\s310\s€, octobre 2027 : −5\s160\s€/);

  const leave = page.getByRole('group', { name: 'Démo congés' });
  const leaveFeb = leave.getByRole('img', { name: fr('février 2027 : +90 € sans vacances, −2 310 € avec vacances (à cause des vacances)'), exact: true });
  await expect(leaveFeb).toBeVisible();
  expect(await dashed(leaveFeb)).toBe('dashed');
  await expect(leave.getByRole('img', { name: /à cause des vacances/ })).toHaveCount(2);
  expect(await dashed(leave.getByRole('img', { name: /mars 2027/ }))).toBe('none');
});

test('non-zero values keep at least 2 px, zero has no bar', async ({ page }) => {
  const bars = async (group: Locator) => {
    await expect(group.getByRole('button')).toHaveCount(4);
    return group.getByRole('button').evaluateAll((els) => els.map((el) => [...el.querySelectorAll('.bar')].map((b) => Math.round(b.getBoundingClientRect().height * 10) / 10)));
  };
  // Mois A : 10 000 € (pleine échelle), B : +40 € et C : −40 € (0,3 px à l’échelle), D : 0 €.
  expect(await bars(page.getByRole('group', { name: 'Démo valeurs minuscules' }))).toEqual([[76, 0], [2, 0], [0, 2], [0, 0]]);
  expect(await bars(page.getByRole('group', { name: 'Démo compacte des valeurs minuscules' }))).toEqual([[46, 0], [2, 0], [0, 2], [0, 0]]);
});
