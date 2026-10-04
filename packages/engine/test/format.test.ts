import { describe, expect, it } from 'vitest';
import { euros, eurosExact, invoiceLabel, kEuros, longDate, monthLabel, monthLetter, monthName, monthShort, plural, relativeDays, shortDate } from '../src/format';

const N = '\u202F'; // séparateur de milliers fr-FR
const S = '\u00A0'; // espace insécable avant €

describe('format', () => {
  it('rounds euros to the ten with French typography', () => {
    expect(euros(-231_400)).toBe(`−2${N}310${S}€`);
    expect(euros(4_600_600)).toBe(`46${N}010${S}€`);
    expect(euros(533_600, { sign: true })).toBe(`+5${N}340${S}€`);
    expect(euros(-400)).toBe(`0${S}€`);
    expect(euros(0, { sign: true })).toBe(`0${S}€`);
  });

  it('formats exact amounts for rates', () => {
    expect(eurosExact(65_000)).toBe(`650${S}€`);
    expect(eurosExact(120_000)).toBe(`1${N}200${S}€`);
    expect(eurosExact(-5_000)).toBe(`−50${S}€`);
  });

  it('formats chart labels', () => {
    expect(kEuros(533_600)).toBe('+5,3k');
    expect(kEuros(-231_400)).toBe('−2,3k');
    expect(kEuros(1_486_000, { sign: false })).toBe('14,9k');
  });

  it('formats months and dates', () => {
    expect(monthLabel('2027-02')).toBe('février 2027');
    expect(monthName('2026-10')).toBe('octobre');
    expect(monthShort('2027-02')).toBe('févr.');
    expect(monthLetter('2027-02')).toBe('F');
    expect(shortDate('2026-11-30')).toBe('30 nov.');
    expect(shortDate('2027-01-01')).toBe('1er janv.');
    expect(longDate('2026-10-04')).toBe('4 octobre 2026');
  });

  it('formats relative days', () => {
    expect(relativeDays('2026-10-04', '2026-10-04')).toBe('aujourd’hui');
    expect(relativeDays('2026-10-03', '2026-10-04')).toBe('hier');
    expect(relativeDays('2026-09-22', '2026-10-04')).toBe('il y a 12 jours');
  });

  it('labels an expected payment', () => {
    const entry = { workMonth: '2026-10', cashDate: '2026-11-30' };
    expect(invoiceLabel(entry, 'TJM')).toBe('Facture d’octobre · vers le 30 nov.');
    expect(invoiceLabel({ workMonth: '2026-09', cashDate: '2026-11-24' }, 'TJM')).toBe('Facture de septembre · vers le 24 nov.');
    expect(invoiceLabel(entry, 'FORFAIT')).toBe('Forfait d’octobre · vers le 30 nov.');
  });

  it('pluralises', () => {
    expect(plural(1, 'jour')).toBe('1 jour');
    expect(plural(5, 'jour')).toBe('5 jours');
    expect(plural(2, 'mois', 'mois')).toBe('2 mois');
  });
});
