import { Inject, Injectable } from '@nestjs/common';
import { BILLING_MODES, type Client, CLIENT_COLORS, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { AppError, notFound } from '../common/app-error.js';
import { cents, isoDate } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { clients, rates } from '../db/schema.js';
import { toClient } from './mappers.js';

export const rateSchema = z.object({ validFrom: isoDate, amount: cents.refine((v) => v > 0, 'Le tarif doit être supérieur à 0 €.') }).strict();

/** Champs partagés avec l'import JSON (export.schema.ts) : une sauvegarde ne doit pas pouvoir stocker ce que la saisie refuse. */
export const clientFields = {
  name: z.string().trim().min(1, 'Donne un nom à ce client.').max(80, 'Nom trop long.'),
  subtitle: z.string().trim().max(80).nullable(),
  color: z.enum(CLIENT_COLORS),
  billingMode: z.enum(BILLING_MODES),
  weekdays: z.array(z.number().int().min(0).max(4)).max(5).transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  paymentTerm: z.enum(PAYMENT_TERM_KEYS),
  averageDelayDays: z.number().int().min(0, 'Entre 0 et 30 jours.').max(30, 'Entre 0 et 30 jours.'),
  isProspect: z.boolean(),
};

export const clientInputSchema = z.object({ ...clientFields, rate: rateSchema }).strict();
export const clientPatchSchema = z.object(clientFields).partial().extend({ archived: z.boolean().optional() }).strict();

const assertDates = (start: string, end: string | null): void => {
  if (end !== null && end < start) throw new AppError(422, 'END_BEFORE_START', 'La date de fin doit être après la date de début.');
};

@Injectable()
export class ClientsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getOwned(userId: string, id: string): Promise<Client> {
    if (!z.string().uuid().safeParse(id).success) throw notFound('Client');
    const [row] = await this.db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
    if (!row) throw notFound('Client');
    const clientRates = await this.db.select().from(rates).where(eq(rates.clientId, id));
    return toClient(row, clientRates);
  }

  async create(userId: string, input: z.infer<typeof clientInputSchema>): Promise<Client> {
    assertDates(input.startDate, input.endDate);
    const { rate, ...fields } = input;
    const id = await this.db.transaction(async (tx) => {
      const [{ value } = { value: null }] = await tx.select({ value: max(clients.position) }).from(clients).where(eq(clients.userId, userId));
      const [row] = await tx
        .insert(clients)
        .values({ ...fields, weekdays: fields.billingMode === 'FORFAIT' ? [] : fields.weekdays, userId, position: (value ?? -1) + 1 })
        .returning({ id: clients.id });
      await tx.insert(rates).values({ clientId: row!.id, validFrom: rate.validFrom, amount: rate.amount });
      return row!.id;
    });
    return this.getOwned(userId, id);
  }

  async update(userId: string, id: string, patch: z.infer<typeof clientPatchSchema>): Promise<Client> {
    const current = await this.getOwned(userId, id);
    const { archived, ...fields } = patch;
    assertDates(fields.startDate ?? current.startDate, fields.endDate !== undefined ? fields.endDate : current.endDate);
    const billingMode = fields.billingMode ?? current.billingMode;
    const values: Partial<typeof clients.$inferInsert> = { ...fields };
    if (billingMode === 'FORFAIT') values.weekdays = [];
    if (archived !== undefined) values.archivedAt = archived ? new Date() : null;
    if (Object.keys(values).length) await this.db.update(clients).set(values).where(eq(clients.id, id));
    return this.getOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.db.delete(clients).where(eq(clients.id, id));
  }

  async upsertRate(userId: string, id: string, rate: z.infer<typeof rateSchema>): Promise<Client> {
    await this.getOwned(userId, id);
    await this.db
      .insert(rates)
      .values({ clientId: id, validFrom: rate.validFrom, amount: rate.amount })
      .onConflictDoUpdate({ target: [rates.clientId, rates.validFrom], set: { amount: rate.amount } });
    return this.getOwned(userId, id);
  }

  async removeRate(userId: string, id: string, rateId: string): Promise<Client> {
    const client = await this.getOwned(userId, id);
    if (!client.rates.some((r) => r.id === rateId)) throw notFound('Tarif');
    if (client.rates.length <= 1) throw new AppError(409, 'LAST_RATE', 'Un client garde toujours au moins un tarif.');
    await this.db.delete(rates).where(and(eq(rates.id, rateId), eq(rates.clientId, id)));
    return this.getOwned(userId, id);
  }
}
