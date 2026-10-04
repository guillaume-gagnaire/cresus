import { describe, expect, it } from 'vitest';
import { easterSunday, holidayName, holidays, isHoliday, isWorkingDay } from '../src/holidays';
import { paramsFor } from '../src/params';

describe('holidays', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2030)).toBe('2030-04-21');
  });

  it('lists the 11 French public holidays with mobile feasts', () => {
    const h2027 = holidays(2027);
    expect(h2027.size).toBe(11);
    expect(h2027.get('2027-03-29')).toBe('Lundi de Pâques');
    expect(h2027.get('2027-05-06')).toBe('Ascension');
    expect(h2027.get('2027-05-17')).toBe('Pentecôte');
    expect(h2027.get('2027-01-01')).toBe('Jour de l’an');
    expect(holidays(2026).get('2026-05-14')).toBe('Ascension');
    expect(holidays(2026).get('2026-05-25')).toBe('Pentecôte');
    expect([...h2027.keys()]).toEqual([...h2027.keys()].sort());
  });

  it('answers per date', () => {
    expect(holidayName('2026-12-25')).toBe('Noël');
    expect(holidayName('2026-11-11')).toBe('Armistice');
    expect(holidayName('2026-12-24')).toBeNull();
    expect(isHoliday('2030-04-22')).toBe(true); // lundi de Pâques 2030
  });

  it('defines working days', () => {
    expect(isWorkingDay('2026-12-24')).toBe(true);
    expect(isWorkingDay('2026-12-25')).toBe(false); // férié
    expect(isWorkingDay('2026-12-26')).toBe(false); // samedi
    expect(isWorkingDay('2026-12-27')).toBe(false); // dimanche
  });
});

describe('params', () => {
  it('returns the year values', () => {
    const p = paramsFor(2026);
    expect(p.salarieCoef).toBe(1.8);
    expect(p.tnsCoef).toBe(1.45);
    expect(p.microContributionRate).toBe(0.261);
    expect(p.microVersementLiberatoireRate).toBe(0.022);
    expect(p.microCeiling).toBe(8_360_000);
    expect(p.vatThreshold).toBe(3_750_000);
    expect(paramsFor(2027).year).toBe(2027);
  });

  it('falls back to the closest known year', () => {
    expect(paramsFor(2030).year).toBe(2027);
    expect(paramsFor(2020).year).toBe(2026);
  });
});
