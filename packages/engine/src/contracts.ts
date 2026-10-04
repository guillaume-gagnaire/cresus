import type { ISODate } from './dates';
import type { BillingMode, Cents, ChargeFrequency, Client, ClientColor, LeaveScope, PaymentTerm, Profile } from './types';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

export interface UserProfileDto extends Profile {
  id: string;
  email: string;
  companyName: string | null;
  alertRedMonth: boolean;
  alertLatePayment: boolean;
}

export interface MeDto {
  user: UserProfileDto;
  hasPasskey: boolean;
}

export interface BalanceSnapshotDto {
  id: string;
  date: ISODate;
  amount: Cents;
}

export interface LeaveDto {
  id: string;
  date: ISODate;
  scope: LeaveScope;
  clientId: string | null;
}

export interface StateDto {
  profile: UserProfileDto;
  balance: { latest: BalanceSnapshotDto | null; history: BalanceSnapshotDto[] };
  clients: Client[];
  leaves: LeaveDto[];
  charges: Array<{ id: string; name: string; amount: Cents; frequency: ChargeFrequency; month: number | null; category: string | null }>;
  hasPasskey: boolean;
}

export type ProfilePatch = Partial<Omit<UserProfileDto, 'id' | 'email'>>;

export interface RateInput {
  validFrom: ISODate;
  amount: Cents;
}

export interface ClientInput {
  name: string;
  subtitle: string | null;
  color: ClientColor;
  billingMode: BillingMode;
  weekdays: number[];
  startDate: ISODate;
  endDate: ISODate | null;
  paymentTerm: PaymentTerm;
  averageDelayDays: number;
  isProspect: boolean;
  rate: RateInput;
}

export type ClientPatch = Partial<Omit<ClientInput, 'rate'>> & { archived?: boolean };

export interface LeavesInput {
  from: ISODate;
  to?: ISODate;
  scope: LeaveScope;
  clientId?: string | null;
}

export interface ChargeInput {
  name: string;
  amount: Cents;
  frequency: ChargeFrequency;
  month: number | null;
  category: string | null;
}

export type ChargePatch = Partial<ChargeInput>;

export interface ExportFileV1 {
  format: 'ma-treso';
  version: 1;
  exportedAt: string;
  profile: Omit<UserProfileDto, 'id' | 'email'>;
  balanceSnapshots: Array<{ date: ISODate; amount: Cents }>;
  clients: Array<Omit<ClientInput, 'rate'> & { ref: string; archived: boolean; rates: RateInput[] }>;
  leaves: Array<{ date: ISODate; scope: LeaveScope; clientRef: string | null }>;
  charges: ChargeInput[];
}
