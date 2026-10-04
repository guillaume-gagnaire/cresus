import { Inject, Injectable } from '@nestjs/common';
import { diffDays, LEAVE_SCOPES, type LeaveDto, workingDaysBetween } from '@matreso/engine';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '../common/app-error.js';
import { isoDate, uuid } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { leaves } from '../db/schema.js';
import { ClientsService } from './clients.service.js';
import { toLeaveDto } from './mappers.js';

export const leavesInputSchema = z
  .object({ from: isoDate, to: isoDate.optional(), scope: z.enum(LEAVE_SCOPES), clientId: uuid.nullable().optional() })
  .strict()
  .refine((v) => v.scope === 'ALL' || !!v.clientId, 'Choisis chez quel client poser ce congé.')
  .refine((v) => !v.to || v.to >= v.from, 'La date de fin doit être après la date de début.')
  .refine((v) => !v.to || diffDays(v.from, v.to) <= 366, 'Pose tes congés sur une année au plus.');

export const deleteLeavesSchema = z.object({ ids: z.array(uuid).min(1).max(500) }).strict();

@Injectable()
export class LeavesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clients: ClientsService,
  ) {}

  async create(userId: string, input: z.infer<typeof leavesInputSchema>): Promise<{ leaves: LeaveDto[]; created: number }> {
    const clientId = input.scope === 'CLIENT' ? input.clientId! : null;
    if (clientId) await this.clients.getOwned(userId, clientId);
    const to = input.to ?? input.from;
    const dates = workingDaysBetween(input.from, to);
    if (dates.length === 0) {
      const message = input.to && input.to !== input.from ? 'Aucun jour ouvré sur cette période.' : 'Ce jour n’est pas ouvré : impossible d’y poser un congé.';
      throw new AppError(422, 'NOT_A_WORKING_DAY', message);
    }
    const inserted = await this.db
      .insert(leaves)
      .values(dates.map((date) => ({ userId, date, scope: input.scope, clientId })))
      .onConflictDoNothing()
      .returning({ id: leaves.id });
    const rows = await this.db
      .select()
      .from(leaves)
      .where(and(
        eq(leaves.userId, userId),
        eq(leaves.scope, input.scope),
        clientId ? eq(leaves.clientId, clientId) : isNull(leaves.clientId),
        gte(leaves.date, input.from),
        lte(leaves.date, to),
      ))
      .orderBy(leaves.date);
    return { leaves: rows.map(toLeaveDto), created: inserted.length };
  }

  async remove(userId: string, ids: string[]): Promise<{ deleted: number }> {
    const deleted = await this.db.delete(leaves).where(and(eq(leaves.userId, userId), inArray(leaves.id, ids))).returning({ id: leaves.id });
    return { deleted: deleted.length };
  }
}
