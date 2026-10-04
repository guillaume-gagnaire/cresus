import type { UserProfileDto } from '@matreso/engine';
import type { users } from '../db/schema.js';

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
