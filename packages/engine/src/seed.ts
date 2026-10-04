import { eachDay, type ISODate } from './dates';
import { isWorkingDay } from './holidays';
import type { BalanceRef, Charge, Client, EngineInput, Leave, Profile } from './types';

export const DEMO_TODAY = '2026-10-04';
export const DEMO_EMAIL = 'demo@matreso.fr';

export interface DemoData {
  profile: Profile & { companyName: string | null };
  balance: BalanceRef;
  clients: Client[];
  leaves: Leave[];
  charges: Charge[];
}

const workingDays = (from: ISODate, to: ISODate): ISODate[] => eachDay(from, to).filter(isWorkingDay);

/** Données des maquettes (Main.dc.html) et de SPEC §8.6. */
export function demoData(): DemoData {
  const clients: Client[] = [
    {
      id: 'client-a', name: 'Client A', subtitle: 'Via ESN', color: 'indigo', billingMode: 'TJM', weekdays: [0, 4],
      startDate: '2026-10-01', endDate: '2027-05-31', paymentTerm: 'EOM_30', averageDelayDays: 0, isProspect: false, archivedAt: null,
      rates: [{ validFrom: '2026-10-01', amount: 65_000 }, { validFrom: '2027-01-01', amount: 70_000 }],
    },
    {
      id: 'client-b', name: 'Client B', subtitle: 'En direct', color: 'orange', billingMode: 'TJM', weekdays: [1, 2, 3],
      startDate: '2026-03-02', endDate: null, paymentTerm: 'NET_45', averageDelayDays: 10, isProspect: false, archivedAt: null,
      rates: [{ validFrom: '2026-03-02', amount: 55_000 }, { validFrom: '2026-09-01', amount: 60_000 }],
    },
    {
      id: 'client-c', name: 'Client C', subtitle: null, color: 'violet', billingMode: 'TJM', weekdays: [0, 4],
      startDate: '2027-07-01', endDate: '2027-12-31', paymentTerm: 'NET_30', averageDelayDays: 5, isProspect: true, archivedAt: null,
      rates: [{ validFrom: '2027-07-01', amount: 70_000 }],
    },
    {
      id: 'client-d', name: 'Client D', subtitle: 'Maintenance', color: 'green', billingMode: 'FORFAIT', weekdays: [],
      startDate: '2026-11-01', endDate: null, paymentTerm: 'NET_30', averageDelayDays: 0, isProspect: false, archivedAt: null,
      rates: [{ validFrom: '2026-11-01', amount: 120_000 }, { validFrom: '2027-04-01', amount: 135_000 }],
    },
  ];
  const leaves: Leave[] = [
    ...workingDays('2026-12-24', '2026-12-31').map((date): Leave => ({ date, scope: 'ALL', clientId: null })),
    { date: '2027-05-07', scope: 'CLIENT', clientId: 'client-a' },
    ...workingDays('2027-08-02', '2027-08-20').map((date): Leave => ({ date, scope: 'ALL', clientId: null })),
  ];
  const charges: Charge[] = [
    { id: 'charge-1', name: 'Provision impôts', amount: 85_000, frequency: 'MONTHLY', month: null, category: 'Impôts' },
    { id: 'charge-2', name: 'Véhicule (LLD)', amount: 42_000, frequency: 'MONTHLY', month: null, category: 'Véhicule' },
    { id: 'charge-3', name: 'Expert-comptable', amount: 18_000, frequency: 'MONTHLY', month: null, category: 'Services' },
    { id: 'charge-4', name: 'Prévoyance et mutuelle', amount: 14_000, frequency: 'MONTHLY', month: null, category: 'Social' },
    { id: 'charge-5', name: 'Logiciels', amount: 9_500, frequency: 'MONTHLY', month: null, category: 'Outils' },
    { id: 'charge-6', name: 'Banque pro', amount: 2_900, frequency: 'MONTHLY', month: null, category: 'Banque' },
    { id: 'charge-7', name: 'Assurance RC Pro', amount: 66_000, frequency: 'YEARLY', month: 0, category: 'Assurance' },
    { id: 'charge-8', name: 'CFE', amount: 60_000, frequency: 'YEARLY', month: 11, category: 'Impôts' },
  ];
  return {
    profile: {
      firstName: 'Guillaume', companyName: 'Gagnaire Développement', legalStatus: 'SASU', netPayMonthly: 400_000,
      microVersementLiberatoire: false, microIncomeTaxProvisionPct: 10, microProExpensesMonthly: 18_000, includeProspects: false,
    },
    balance: { date: DEMO_TODAY, amount: 4_832_000 },
    clients,
    leaves,
    charges,
  };
}

export function demoInput(today: ISODate = DEMO_TODAY): EngineInput {
  const d = demoData();
  return { today, profile: d.profile, clients: d.clients, leaves: d.leaves, charges: d.charges, balance: d.balance };
}
