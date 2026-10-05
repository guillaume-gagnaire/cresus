import { Inject, Injectable } from '@nestjs/common';
import { type BalanceSnapshotDto, localToday } from '@matreso/engine';
import { z } from 'zod';
import { isoDate, signedCents } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots } from '../db/schema.js';
import { toBalanceDto } from './mappers.js';

export const balanceSchema = z.object({ amount: signedCents, date: isoDate.optional() }).strict();

@Injectable()
export class BalanceService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Nouveau solde du compte (un instantané de plus dans l'historique). Sans date, celle du jour du serveur. */
  async create(userId: string, input: z.infer<typeof balanceSchema>): Promise<BalanceSnapshotDto> {
    const [row] = await this.db.insert(balanceSnapshots).values({ userId, amount: input.amount, date: input.date ?? localToday() }).returning();
    return toBalanceDto(row!);
  }
}
