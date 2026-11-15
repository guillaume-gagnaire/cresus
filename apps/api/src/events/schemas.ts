import { LIMITS } from '@cresus/shared';
import { z } from 'zod';
import { notFound } from '../common/app-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant de chemin : un texte qui n'est pas un UUID ne peut désigner aucun objet (404 plutôt qu'une erreur SQL). */
export function uuidParam(value: string, what: string): string {
  if (!UUID.test(value)) throw notFound(what);
  return value.toLowerCase();
}

const isRealDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')
  .refine(isRealDate, 'Date invalide.');

const eventName = z
  .string()
  .trim()
  .min(1, 'Indiquez le nom de l’évènement.')
  .max(LIMITS.eventName, `Le nom de l’évènement fait au plus ${LIMITS.eventName} caractères.`);

export const createEventSchema = z.object({
  name: eventName,
  date: dateSchema,
  copyFromEventId: z.string().optional(),
});

export const updateEventSchema = z.object({ name: eventName.optional(), date: dateSchema.optional() });

const articleName = z
  .string()
  .trim()
  .min(1, 'Indiquez le nom de l’article.')
  .max(LIMITS.articleName, `Le nom de l’article fait au plus ${LIMITS.articleName} caractères.`);

export const priceSchema = z
  .number()
  .int('Prix invalide.')
  .min(0, 'Le prix ne peut pas être négatif.')
  .max(LIMITS.priceMaxCents, 'Le prix fait au plus 999,99 €.');

const pictoSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/, 'Picto invalide.')
  .nullable();

export const createArticleSchema = z.object({ name: articleName, priceCents: priceSchema, picto: pictoSchema.optional() });

export const updateArticleSchema = z.object({
  name: articleName.optional(),
  priceCents: priceSchema.optional(),
  picto: pictoSchema.optional(),
  onSale: z.boolean().optional(),
});

export const orderSchema = z.object({ ids: z.array(z.string()).max(500) });
