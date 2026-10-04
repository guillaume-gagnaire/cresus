import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, daysInMonth, diffDays, eachDay, eachDayOfMonth, firstDayOfMonth, fromEpochDay,
  isISODate, lastDayOfMonth, localToday, maxDate, minDate, monthIndex, monthKey, monthRange, toEpochDay,
  weekday, yearOf,
} from '../src/dates';

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isISODate('2026-10-04')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('04/10/2026')).toBe(false);
  });

  it('round-trips epoch days', () => {
    expect(fromEpochDay(toEpochDay('2026-10-04'))).toBe('2026-10-04');
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(() => toEpochDay('nope')).toThrow();
  });

  it('adds and diffs days across months and years', () => {
    expect(addDays('2026-10-31', 30)).toBe('2026-11-30');
    expect(addDays('2027-01-31', 30)).toBe('2027-03-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-31', '2026-11-30')).toBe(30);
  });

  it('computes weekday with monday = 0', () => {
    expect(weekday('2026-10-05')).toBe(0); // lundi
    expect(weekday('2026-10-04')).toBe(6); // dimanche
    expect(weekday('2026-10-09')).toBe(4); // vendredi
    expect(weekday('1969-12-29')).toBe(0); // avant l'epoch
  });

  it('handles months', () => {
    expect(monthKey('2026-10-04')).toBe('2026-10');
    expect(yearOf('2026-10')).toBe(2026);
    expect(monthIndex('2026-10-04')).toBe(9);
    expect(addMonths('2026-10', 3)).toBe('2027-01');
    expect(addMonths('2026-10', -10)).toBe('2025-12');
    expect(firstDayOfMonth('2027-02')).toBe('2027-02-01');
    expect(lastDayOfMonth('2027-02')).toBe('2027-02-28');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
    expect(daysInMonth('2026-11')).toBe(30);
    expect(monthRange('2026-11', 3)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('iterates days', () => {
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(eachDay('2026-12-30', '2026-12-29')).toEqual([]);
    expect(eachDayOfMonth('2027-02')).toHaveLength(28);
  });

  it('compares dates', () => {
    expect(minDate('2026-10-01', '2026-09-30')).toBe('2026-09-30');
    expect(maxDate('2026-10-01', '2026-09-30')).toBe('2026-10-01');
    expect(minDate('2026-09-30', '2026-10-01')).toBe('2026-09-30');
    expect(maxDate('2026-09-30', '2026-10-01')).toBe('2026-10-01');
    expect(minDate('2026-10-01', '2026-10-01')).toBe('2026-10-01');
  });

  it('builds today from local components, never from UTC', () => {
    // 23h30 le 4 octobre en heure locale : toISOString() donnerait le 4 ou le 5 selon le fuseau
    const lateEvening = new Date(2026, 9, 4, 23, 30);
    expect(localToday(lateEvening)).toBe('2026-10-04');
    const earlyMorning = new Date(2026, 0, 1, 0, 5);
    expect(localToday(earlyMorning)).toBe('2026-01-01');
  });
});
