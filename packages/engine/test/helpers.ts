import type { Client, EngineInput, Profile } from '../src/types';

export function makeClient(overrides: Partial<Client> & { rate?: number } = {}): Client {
  const { rate = 60_000, ...rest } = overrides;
  return {
    id: 'c1',
    name: 'Client',
    subtitle: null,
    color: 'indigo',
    billingMode: 'TJM',
    weekdays: [0, 1, 2, 3, 4],
    startDate: '2026-01-01',
    endDate: null,
    paymentTerm: 'RECEPTION',
    averageDelayDays: 0,
    isProspect: false,
    archivedAt: null,
    rates: [{ validFrom: '2026-01-01', amount: rate }],
    ...rest,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    firstName: 'Test',
    legalStatus: 'SASU',
    netPayMonthly: 0,
    microVersementLiberatoire: false,
    microIncomeTaxProvisionPct: 10,
    microProExpensesMonthly: 18_000,
    includeProspects: false,
    ...overrides,
  };
}

export function makeInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    today: '2026-10-04',
    profile: makeProfile(),
    clients: [],
    leaves: [],
    charges: [],
    balance: null,
    ...overrides,
  };
}
