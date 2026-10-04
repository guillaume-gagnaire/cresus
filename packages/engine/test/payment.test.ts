import { describe, expect, it } from 'vitest';
import { PAYMENT_TERMS, paymentPath } from '../src/payment';
import type { PaymentTerm } from '../src/types';

const path = (paymentTerm: PaymentTerm, workMonth: string, averageDelayDays = 0) => paymentPath({ paymentTerm, averageDelayDays }, workMonth);

describe('paymentPath', () => {
  it('invoices on the last day of the worked month', () => {
    expect(path('RECEPTION', '2026-10').invoiceDate).toBe('2026-10-31');
    expect(path('RECEPTION', '2026-10').cashDate).toBe('2026-10-31');
  });

  it('applies every payment term', () => {
    expect(path('NET_30', '2026-10').dueDate).toBe('2026-11-30');
    expect(path('NET_45', '2026-10').dueDate).toBe('2026-12-15');
    expect(path('EOM_30', '2026-10').dueDate).toBe('2026-11-30');
    expect(path('NET_60', '2026-10').dueDate).toBe('2026-12-30');
  });

  it('groups January and February invoices in March with "30 jours fin de mois"', () => {
    expect(path('EOM_30', '2027-01').dueDate).toBe('2027-03-31');
    expect(path('EOM_30', '2027-02').dueDate).toBe('2027-03-31');
    expect(path('EOM_30', '2027-01').cashMonth).toBe('2027-03');
  });

  it('adds the average delay and reports the wait', () => {
    const p = path('NET_45', '2026-08', 10);
    expect(p.cashDate).toBe('2026-10-25');
    expect(p.cashMonth).toBe('2026-10');
    expect(p.waitDays).toBe(55);
    expect(path('EOM_30', '2026-10').waitDays).toBe(30);
  });

  it('labels terms like the mockups', () => {
    expect(PAYMENT_TERMS.EOM_30.label).toBe('30 j fin de mois');
    expect(PAYMENT_TERMS.RECEPTION.label).toBe('À réception');
  });
});
