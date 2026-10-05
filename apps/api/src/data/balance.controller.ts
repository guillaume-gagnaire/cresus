import { Body, Controller, Post } from '@nestjs/common';
import type { BalanceSnapshotDto } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { balanceSchema, BalanceService } from './balance.service.js';

@Controller('balance')
export class BalanceController {
  constructor(private readonly balance: BalanceService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(balanceSchema)) body: z.infer<typeof balanceSchema>): Promise<BalanceSnapshotDto> {
    return this.balance.create(userId, body);
  }
}
