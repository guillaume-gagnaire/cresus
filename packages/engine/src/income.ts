import { addMonths, firstDayOfMonth, type ISODate, lastDayOfMonth, type MonthKey, monthRange } from './dates';
import { indexLeaves, monthlyAmount } from './billing';
import { paymentPath } from './payment';
import type { Cents, Client, Leave } from './types';

export const LOOKBACK_MONTHS = 8;

export interface IncomeEntry {
  clientId: string;
  workMonth: MonthKey;
  invoiceDate: ISODate;
  cashDate: ISODate;
  cashMonth: MonthKey;
  amount: Cents;
  amountWithoutLeaves: Cents;
  leaveCost: Cents;
}

export interface IncomeOptions {
  firstMonth: MonthKey;
  months: number;
  includeProspects: boolean;
  extraClients?: readonly Client[];
}

export function countedClients(clients: readonly Client[], includeProspects: boolean): Client[] {
  return clients.filter((c) => c.archivedAt === null && (includeProspects || !c.isProspect));
}

export function sumBy<T>(items: readonly T[], key: { [K in keyof T]: T[K] extends number ? K : never }[keyof T]): number {
  return items.reduce((sum, item) => sum + (item[key] as number), 0);
}

/** Encaissements dont le mois tombe dans [firstMonth, firstMonth + months[. */
export function projectIncome(clients: readonly Client[], leaves: readonly Leave[], opts: IncomeOptions): IncomeEntry[] {
  const index = indexLeaves(leaves);
  const lastMonth = addMonths(opts.firstMonth, opts.months - 1);
  const workMonths = monthRange(addMonths(opts.firstMonth, -LOOKBACK_MONTHS), opts.months + LOOKBACK_MONTHS);
  const entries: IncomeEntry[] = [];
  for (const client of [...countedClients(clients, opts.includeProspects), ...(opts.extraClients ?? [])]) {
    for (const workMonth of workMonths) {
      if (lastDayOfMonth(workMonth) < client.startDate) continue;
      if (client.endDate !== null && firstDayOfMonth(workMonth) > client.endDate) continue;
      const amountWithoutLeaves = monthlyAmount(client, workMonth, null);
      if (amountWithoutLeaves === 0) continue;
      const path = paymentPath(client, workMonth);
      if (path.cashMonth < opts.firstMonth || path.cashMonth > lastMonth) continue;
      const amount = monthlyAmount(client, workMonth, index);
      entries.push({
        clientId: client.id,
        workMonth,
        invoiceDate: path.invoiceDate,
        cashDate: path.cashDate,
        cashMonth: path.cashMonth,
        amount,
        amountWithoutLeaves,
        leaveCost: amountWithoutLeaves - amount,
      });
    }
  }
  return entries.sort((a, b) => a.cashDate.localeCompare(b.cashDate));
}
