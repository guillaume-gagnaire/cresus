import { LEAVE_SCOPES } from '@matreso/engine';
import { z } from 'zod';
import { isoDate, signedCents } from '../common/schemas.js';
import { chargeInputSchema } from './charges.service.js';
import { clientFields, rateSchema } from './clients.service.js';
import { profileFields } from './profile.service.js';

export const exportFileSchema = z
  .object({
    format: z.literal('ma-treso'),
    version: z.literal(1),
    exportedAt: z.string(),
    profile: z.object(profileFields),
    balanceSnapshots: z.array(z.object({ date: isoDate, amount: signedCents })).max(10_000),
    clients: z
      .array(
        z.object({
          ...clientFields,
          ref: z.string().min(1),
          archived: z.boolean(),
          rates: z.array(rateSchema).min(1).max(500),
        }),
      )
      .max(200),
    leaves: z.array(z.object({ date: isoDate, scope: z.enum(LEAVE_SCOPES), clientRef: z.string().nullable() })).max(20_000),
    charges: z.array(chargeInputSchema).max(500),
  })
  .superRefine((file, ctx) => {
    const refs = new Set(file.clients.map((c) => c.ref));
    if (refs.size !== file.clients.length) ctx.addIssue({ code: 'custom', message: 'Clients en double.' });
    for (const c of file.clients) if (c.endDate !== null && c.endDate < c.startDate) ctx.addIssue({ code: 'custom', message: 'Dates de mission incohérentes.' });
    for (const l of file.leaves) {
      if (l.scope === 'CLIENT' && (!l.clientRef || !refs.has(l.clientRef))) ctx.addIssue({ code: 'custom', message: 'Congé rattaché à un client inconnu.' });
    }
  });

export type ExportFileInput = z.infer<typeof exportFileSchema>;
