export { formatEuros } from '@cresus/shared';

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

/** '2027-06-20' → « dimanche 20 juin 2027 » */
export const formatDateLong = (isoDay: string): string => longDate.format(new Date(`${isoDay}T00:00:00Z`));
/** '2027-06-20' → « dim. 20 juin » */
export const formatDateShort = (isoDay: string): string => shortDate.format(new Date(`${isoDay}T00:00:00Z`));
/** Heure de Paris d'un instant ISO : « 17:52 » */
export const formatTime = (iso: string): string => time.format(new Date(iso));
/** « 14 h » depuis une tranche 'YYYY-MM-DDTHH:00' */
export const formatHour = (bucket: string): string => `${Number(bucket.slice(11, 13))} h`;

export const salesLabel = (count: number): string => (count === 0 ? 'aucune vente' : count === 1 ? '1 vente' : `${count} ventes`);

/** Date du jour à Paris, YYYY-MM-DD. */
export function todayIso(): string {
  const parts = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts;
}
