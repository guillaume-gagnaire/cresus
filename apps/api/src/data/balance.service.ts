import { Inject, Injectable } from '@nestjs/common';
import { type BalanceSnapshotDto, type ISODate, localToday } from '@matreso/engine';
import { z } from 'zod';
import { AppError } from '../common/app-error.js';
import { isoDate, signedCents } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots } from '../db/schema.js';
import { toBalanceDto } from './mappers.js';

export const balanceSchema = z.object({ amount: signedCents, date: isoDate.optional() }).strict();

export const BALANCE_IN_FUTURE_MESSAGE = 'La date du solde ne peut pas être dans le futur.';

function assertNotInFuture(date: ISODate | undefined, today: ISODate): void {
  if (date !== undefined && date > today) throw new AppError(422, 'BALANCE_IN_FUTURE', BALANCE_IN_FUTURE_MESSAGE);
}

@Injectable()
export class BalanceService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Nouveau solde du compte (un instantané de plus dans l'historique). Sans date, celle du jour du serveur.
   * Un solde daté du futur fausserait le point de départ de la projection : refusé (le serveur d'API et le MCP passent ici).
   * `today` est injectable (horloge du MCP, tests).
   */
  async create(userId: string, input: z.infer<typeof balanceSchema>, today: ISODate = localToday()): Promise<BalanceSnapshotDto> {
    assertNotInFuture(input.date, today);
    const [row] = await this.db.insert(balanceSnapshots).values({ userId, amount: input.amount, date: input.date ?? today }).returning();
    return toBalanceDto(row!);
  }
}
