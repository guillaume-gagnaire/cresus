import { Inject, Injectable } from '@nestjs/common';
import { CHARGE_FREQUENCIES, type StateDto } from '@matreso/engine';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AppError, notFound } from '../common/app-error.js';
import { cents } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { charges } from '../db/schema.js';
import { toChargeDto } from './mappers.js';

type ChargeDto = StateDto['charges'][number];

const chargeFields = {
  name: z.string().trim().min(1, 'Donne un nom à cette charge.').max(80, 'Nom trop long.'),
  amount: cents,
  frequency: z.enum(CHARGE_FREQUENCIES),
  month: z.number().int().min(0).max(11).nullable(),
  category: z.string().trim().max(40).nullable(),
};

const checkMonth = (frequency: string, month: number | null): void => {
  if (frequency === 'YEARLY' && month === null) throw new AppError(400, 'VALIDATION', 'Choisis le mois du prélèvement.');
};

export const chargeInputSchema = z
  .object(chargeFields)
  .strict()
  .refine((v) => v.frequency !== 'YEARLY' || v.month !== null, 'Choisis le mois du prélèvement.');
export const chargePatchSchema = z.object(chargeFields).partial().strict();

@Injectable()
export class ChargesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string, input: z.infer<typeof chargeInputSchema>): Promise<ChargeDto> {
    const [row] = await this.db.insert(charges).values({ ...input, month: input.frequency === 'MONTHLY' ? null : input.month, userId }).returning();
    return toChargeDto(row!);
  }

  async update(userId: string, id: string, patch: z.infer<typeof chargePatchSchema>): Promise<ChargeDto> {
    const current = await this.owned(userId, id);
    const frequency = patch.frequency ?? current.frequency;
    const month = frequency === 'MONTHLY' ? null : patch.month !== undefined ? patch.month : current.month;
    checkMonth(frequency, month);
    const [row] = await this.db.update(charges).set({ ...patch, month }).where(eq(charges.id, id)).returning();
    return toChargeDto(row!);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.db.delete(charges).where(eq(charges.id, id));
  }

  private async owned(userId: string, id: string): Promise<typeof charges.$inferSelect> {
    if (!z.string().uuid().safeParse(id).success) throw notFound('Charge');
    const [row] = await this.db.select().from(charges).where(and(eq(charges.id, id), eq(charges.userId, userId)));
    if (!row) throw notFound('Charge');
    return row;
  }
}
