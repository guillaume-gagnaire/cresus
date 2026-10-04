import { describe, expect, it } from 'vitest';
import { paramsFor } from '../src/params';
import { isCompanyStatus, remunerationComparison, remunerationCost } from '../src/remuneration';

const p = paramsFor(2026);

describe('remunerationCost', () => {
  it('assimilé salarié: net × 1.80', () => {
    expect(remunerationCost(400_000, 'SASU', p)).toEqual({ regime: 'SALARIE', net: 400_000, total: 720_000, contributions: 320_000, totalLabel: 'Coût pour la société' });
    expect(remunerationCost(400_000, 'SASU_IR', p).total).toBe(720_000);
  });

  it('TNS: net × 1.45 with the right label', () => {
    expect(remunerationCost(400_000, 'EURL_IS', p)).toMatchObject({ regime: 'TNS', total: 580_000, totalLabel: 'Coût pour la société' });
    expect(remunerationCost(400_000, 'SARL', p).totalLabel).toBe('Coût pour la société');
    expect(remunerationCost(400_000, 'EI', p)).toMatchObject({ total: 580_000, totalLabel: 'Bénéfice nécessaire' });
    expect(remunerationCost(400_000, 'EURL_IR', p).totalLabel).toBe('Bénéfice nécessaire');
  });

  it('micro: net ÷ (1 − 0.261)', () => {
    expect(remunerationCost(400_000, 'MICRO', p)).toMatchObject({ regime: 'MICRO', total: 541_272, contributions: 141_272, totalLabel: 'CA à encaisser' });
  });

  it('compares the three regimes', () => {
    expect(remunerationComparison(400_000, p)).toEqual([
      { regime: 'SALARIE', label: 'Assimilé salarié', total: 720_000 },
      { regime: 'TNS', label: 'Indépendant (TNS)', total: 580_000 },
      { regime: 'MICRO', label: 'Micro-entreprise', total: 541_272 },
    ]);
  });

  it('knows company statuses', () => {
    expect(isCompanyStatus('SASU')).toBe(true);
    expect(isCompanyStatus('MICRO')).toBe(false);
  });
});
