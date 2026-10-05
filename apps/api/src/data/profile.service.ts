import { Inject, Injectable } from '@nestjs/common';
import { LEGAL_STATUSES, type UserProfileDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { cents } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { toProfileDto } from './mappers.js';

/** Champs partagés avec l'import JSON (export.schema.ts). */
export const profileFields = {
  firstName: z.string().trim().min(1, 'Indique ton prénom.').max(60),
  companyName: z.string().trim().max(120).nullable(),
  legalStatus: z.enum(LEGAL_STATUSES),
  netPayMonthly: cents.max(10_000_000, 'Rémunération trop élevée.'),
  microVersementLiberatoire: z.boolean(),
  microIncomeTaxProvisionPct: z.number().int().min(0, 'Entre 0 et 30 %.').max(30, 'Entre 0 et 30 %.'),
  microProExpensesMonthly: cents,
  includeProspects: z.boolean(),
  alertRedMonth: z.boolean(),
  alertLatePayment: z.boolean(),
};

/** Le rôle n'en fait pas partie : `.strict()` le refuse, il n'est jamais modifiable par l'API ni par MCP. */
export const profilePatchSchema = z.object(profileFields).partial().strict();

@Injectable()
export class ProfileService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async patch(userId: string, patch: z.infer<typeof profilePatchSchema>): Promise<UserProfileDto> {
    const [row] = Object.keys(patch).length
      ? await this.db.update(users).set(patch).where(eq(users.id, userId)).returning()
      : await this.db.select().from(users).where(eq(users.id, userId));
    return toProfileDto(row!);
  }
}
