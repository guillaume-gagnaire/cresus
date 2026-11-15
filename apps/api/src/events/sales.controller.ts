import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { LIMITS, type SalesPageDto, type SummaryDto, type SyncResponse } from '@cresus/shared';
import { z } from 'zod';
import { CurrentAccount } from '../common/current-account.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SalesService } from './sales.service.js';
import { priceSchema } from './schemas.js';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Identifiant invalide.');

const syncSchema = z.object({
  ops: z
    .array(
      z.discriminatedUnion('op', [
        z.object({ op: z.literal('sale'), id: uuid, articleId: z.string().max(64), priceCents: priceSchema, soldAt: z.string().max(64) }),
        z.object({ op: z.literal('void'), id: uuid }),
      ]),
    )
    .min(1, 'Aucune vente à envoyer.')
    .max(LIMITS.syncBatch, `Au plus ${LIMITS.syncBatch} opérations par envoi.`),
});

const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
});

@Controller('events/:id')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post('sync')
  @HttpCode(200)
  sync(@CurrentAccount() accountId: string, @Param('id') eventId: string, @Body(new ZodPipe(syncSchema)) body: z.infer<typeof syncSchema>): Promise<SyncResponse> {
    return this.sales.sync(accountId, eventId, body.ops);
  }

  @Get('summary')
  summary(@CurrentAccount() accountId: string, @Param('id') eventId: string): Promise<SummaryDto> {
    return this.sales.summary(accountId, eventId);
  }

  @Get('sales')
  history(@CurrentAccount() accountId: string, @Param('id') eventId: string, @Query(new ZodPipe(historySchema)) query: z.infer<typeof historySchema>): Promise<SalesPageDto> {
    return this.sales.history(accountId, eventId, query.limit, query.cursor);
  }
}
