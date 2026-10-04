import { Body, Controller, Inject, Patch } from '@nestjs/common';
import { LEGAL_STATUSES, type UserProfileDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { cents } from '../common/schemas.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { toProfileDto } from './mappers.js';

export const profilePatchSchema = z
  .object({
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
  })
  .partial()
  .strict();

@Controller('profile')
export class ProfileController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Patch()
  async patch(@CurrentUser() userId: string, @Body(new ZodPipe(profilePatchSchema)) body: z.infer<typeof profilePatchSchema>): Promise<UserProfileDto> {
    const [row] = Object.keys(body).length
      ? await this.db.update(users).set(body).where(eq(users.id, userId)).returning()
      : await this.db.select().from(users).where(eq(users.id, userId));
    return toProfileDto(row!);
  }
}
