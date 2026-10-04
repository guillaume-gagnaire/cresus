import { isISODate } from '@matreso/engine';
import { z } from 'zod';

export const isoDate = z.string().refine(isISODate, 'Date invalide.');
/** Montant positif en centimes (≤ 10 millions d'euros) */
export const cents = z.number().int('Montant invalide.').min(0, 'Montant invalide.').max(1_000_000_000, 'Montant trop élevé.');
/** Montant signé en centimes (solde) */
export const signedCents = z.number().int('Montant invalide.').min(-1_000_000_000).max(1_000_000_000);
export const uuid = z.string().uuid('Identifiant invalide.');
