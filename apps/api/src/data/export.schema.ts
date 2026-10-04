import { BILLING_MODES, CLIENT_COLORS, LEAVE_SCOPES, LEGAL_STATUSES, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { z } from 'zod';
import { cents, isoDate, signedCents } from '../common/schemas.js';
import { chargeInputSchema } from './charges.service.js';

export const exportFileSchema = z
  .object({
    format: z.literal('ma-treso'),
    version: z.literal(1),
    exportedAt: z.string(),
    profile: z.object({
      firstName: z.string().trim().min(1).max(60),
      companyName: z.string().max(120).nullable(),
      legalStatus: z.enum(LEGAL_STATUSES),
      netPayMonthly: cents,
      microVersementLiberatoire: z.boolean(),
      microIncomeTaxProvisionPct: z.number().int().min(0).max(30),
      microProExpensesMonthly: cents,
      includeProspects: z.boolean(),
      alertRedMonth: z.boolean(),
      alertLatePayment: z.boolean(),
    }),
    balanceSnapshots: z.array(z.object({ date: isoDate, amount: signedCents })).max(10_000),
    clients: z
      .array(
        z.object({
          ref: z.string().min(1),
          name: z.string().trim().min(1).max(80),
          subtitle: z.string().max(80).nullable(),
          color: z.enum(CLIENT_COLORS),
          billingMode: z.enum(BILLING_MODES),
          weekdays: z.array(z.number().int().min(0).max(4)).max(5),
          startDate: isoDate,
          endDate: isoDate.nullable(),
          paymentTerm: z.enum(PAYMENT_TERM_KEYS),
          averageDelayDays: z.number().int().min(0).max(30),
          isProspect: z.boolean(),
          archived: z.boolean(),
          rates: z.array(z.object({ validFrom: isoDate, amount: cents })).min(1),
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
