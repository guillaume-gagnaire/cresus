import { Body, Controller, Inject, Post } from '@nestjs/common';
import { type BalanceSnapshotDto, localToday } from '@matreso/engine';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { isoDate, signedCents } from '../common/schemas.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots } from '../db/schema.js';
import { toBalanceDto } from './mappers.js';

const balanceSchema = z.object({ amount: signedCents, date: isoDate.optional() }).strict();

@Controller('balance')
export class BalanceController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  async create(@CurrentUser() userId: string, @Body(new ZodPipe(balanceSchema)) body: z.infer<typeof balanceSchema>): Promise<BalanceSnapshotDto> {
    const [row] = await this.db.insert(balanceSnapshots).values({ userId, amount: body.amount, date: body.date ?? localToday() }).returning();
    return toBalanceDto(row!);
  }
}
