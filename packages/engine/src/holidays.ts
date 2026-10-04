import { addDays, type ISODate, weekday, yearOf } from './dates';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const FIXED: ReadonlyArray<readonly [string, string]> = [
  ['01-01', "Jour de l'an"],
  ['05-01', 'Fête du Travail'],
  ['05-08', 'Victoire 1945'],
  ['07-14', 'Fête nationale'],
  ['08-15', 'Assomption'],
  ['11-01', 'Toussaint'],
  ['11-11', 'Armistice'],
  ['12-25', 'Noël'],
];

const cache = new Map<number, ReadonlyMap<ISODate, string>>();

export function holidays(year: number): ReadonlyMap<ISODate, string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const entries: Array<[ISODate, string]> = [
    ...FIXED.map(([md, name]): [ISODate, string] => [`${year}-${md}`, name]),
    [addDays(easter, 1), 'Lundi de Pâques'],
    [addDays(easter, 39), 'Ascension'],
    [addDays(easter, 50), 'Pentecôte'],
  ];
  entries.sort(([a], [b]) => a.localeCompare(b));
  const map: ReadonlyMap<ISODate, string> = new Map(entries);
  cache.set(year, map);
  return map;
}

export const holidayName = (date: ISODate): string | null => holidays(yearOf(date)).get(date) ?? null;
export const isHoliday = (date: ISODate): boolean => holidayName(date) !== null;
/** Jour ouvré : lundi à vendredi, et pas férié. */
export const isWorkingDay = (date: ISODate): boolean => weekday(date) < 5 && !isHoliday(date);
