import { AppError } from '../common/app-error.js';

/**
 * Euros (nombre à 2 décimales au plus) → centimes entiers, arrondis au centime le plus proche (demi vers l'infini, symétrique
 * pour les négatifs). Le produit est ramené à 15 chiffres significatifs avant d'arrondir : sans cela 1,005 × 100 donnerait 100,49999…
 * Refuse les valeurs non finies ou trop grandes pour être exactes ; les bornes métier (montant maximal…) sont celles des schémas de l'API.
 */
export function toCents(euros: number): number {
  const cents = typeof euros === 'number' && Number.isFinite(euros) ? Math.sign(euros) * Math.round(Number((Math.abs(euros) * 100).toPrecision(15))) : Number.NaN;
  if (!Number.isSafeInteger(cents)) throw new AppError(400, 'VALIDATION', 'Montant invalide.');
  return cents + 0; // -0 → 0
}

/** Centimes entiers → euros. */
export const toEuros = (cents: number): number => cents / 100;
