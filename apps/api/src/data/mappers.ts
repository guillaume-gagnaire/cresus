import type { BalanceSnapshotDto, Client, LeaveDto, StateDto, UserProfileDto } from '@matreso/engine';
import type { balanceSnapshots, charges, clients, leaves, rates, users } from '../db/schema.js';

export function toProfileDto(u: typeof users.$inferSelect): UserProfileDto {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    companyName: u.companyName,
    legalStatus: u.legalStatus,
    netPayMonthly: u.netPayMonthly,
    microVersementLiberatoire: u.microVersementLiberatoire,
    microIncomeTaxProvisionPct: u.microIncomeTaxProvisionPct,
    microProExpensesMonthly: u.microProExpensesMonthly,
    includeProspects: u.includeProspects,
    alertRedMonth: u.alertRedMonth,
    alertLatePayment: u.alertLatePayment,
  };
}

export function toClient(c: typeof clients.$inferSelect, clientRates: Array<typeof rates.$inferSelect>): Client {
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    color: c.color,
    billingMode: c.billingMode,
    weekdays: [...c.weekdays].sort((a, b) => a - b),
    startDate: c.startDate,
    endDate: c.endDate,
    paymentTerm: c.paymentTerm,
    averageDelayDays: c.averageDelayDays,
    isProspect: c.isProspect,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    rates: clientRates
      .filter((r) => r.clientId === c.id)
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
      .map((r) => ({ id: r.id, validFrom: r.validFrom, amount: r.amount })),
  };
}

export const toLeaveDto = (l: typeof leaves.$inferSelect): LeaveDto => ({ id: l.id, date: l.date, scope: l.scope, clientId: l.clientId });

export const toChargeDto = (c: typeof charges.$inferSelect): StateDto['charges'][number] => ({
  id: c.id, name: c.name, amount: c.amount, frequency: c.frequency, month: c.month, category: c.category,
});

export const toBalanceDto = (b: typeof balanceSnapshots.$inferSelect): BalanceSnapshotDto => ({ id: b.id, date: b.date, amount: b.amount });
