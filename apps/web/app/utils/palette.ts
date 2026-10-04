import type { ClientColor, MonthState } from '@matreso/engine';

export const PALETTE: Readonly<Record<ClientColor, { base: string; fg: string; soft: string; label: string }>> = {
  indigo: { base: '#4B4BE0', fg: '#FFFFFF', soft: '#ECEBFF', label: 'Indigo' },
  orange: { base: '#FF8A3D', fg: '#1F1A2E', soft: '#FFEBDD', label: 'Orange' },
  violet: { base: '#9B6BFF', fg: '#FFFFFF', soft: '#F1EAFE', label: 'Violet' },
  green: { base: '#2E9E6A', fg: '#FFFFFF', soft: '#E3F5EA', label: 'Vert' },
  rose: { base: '#D9467A', fg: '#FFFFFF', soft: '#FCE4EE', label: 'Rose' },
  teal: { base: '#1F8FA6', fg: '#FFFFFF', soft: '#DDF1F5', label: 'Bleu canard' },
};

/** Couleurs des états d'un mois (SPEC §4.7, badges de Calendrier.dc.html). */
export const STATE_STYLE: Readonly<Record<MonthState, { bg: string; ink: string; badgeBg: string; badgeInk: string; label: string }>> = {
  POSITIVE: { bg: '#DDF3E5', ink: '#12452A', badgeBg: '#E7F6EC', badgeInk: '#1E6B3A', label: 'Positif' },
  RED: { bg: '#FFE6CF', ink: '#6E2E05', badgeBg: '#FFD0A8', badgeInk: '#6E2E05', label: 'Dans le rouge' },
  RED_DUE_TO_LEAVES: { bg: '#FFE6CF', ink: '#6E2E05', badgeBg: '#FFD0A8', badgeInk: '#6E2E05', label: 'Rouge à cause des vacances' },
  OVERDRAFT: { bg: '#FBD2CE', ink: '#7A1A13', badgeBg: '#B3261E', badgeInk: '#FFFFFF', label: 'Découvert' },
};

/** Couleur suivante libre pour un nouveau client. */
export function nextColor(used: readonly ClientColor[]): ClientColor {
  const order: ClientColor[] = ['indigo', 'orange', 'violet', 'green', 'rose', 'teal'];
  return order.find((c) => !used.includes(c)) ?? order[used.length % order.length]!;
}
