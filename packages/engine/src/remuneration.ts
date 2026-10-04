import type { RegulatoryParams } from './params';
import type { Cents, LegalStatus, SocialRegime } from './types';

export const REGIME_OF: Readonly<Record<LegalStatus, SocialRegime>> = {
  SASU: 'SALARIE', SAS: 'SALARIE', SASU_IR: 'SALARIE',
  SARL: 'TNS', EURL_IS: 'TNS', EURL_IR: 'TNS', EI: 'TNS',
  MICRO: 'MICRO',
};

export const LEGAL_STATUS_LABELS: Readonly<Record<LegalStatus, string>> = {
  SASU: 'SASU', SAS: 'SAS', SASU_IR: 'SASU à l’IR', SARL: 'SARL',
  EURL_IS: 'EURL à l’IS', EURL_IR: 'EURL à l’IR', EI: 'EI', MICRO: 'Micro',
};

export const REGIME_LABELS: Readonly<Record<SocialRegime, string>> = {
  SALARIE: 'Assimilé salarié',
  TNS: 'Indépendant (TNS)',
  MICRO: 'Micro-entreprise',
};

export const isCompanyStatus = (status: LegalStatus): boolean => status !== 'MICRO';

export function regimeTotal(net: Cents, regime: SocialRegime, params: RegulatoryParams): Cents {
  switch (regime) {
    case 'SALARIE':
      return Math.round(net * params.salarieCoef);
    case 'TNS':
      return Math.round(net * params.tnsCoef);
    case 'MICRO':
      return Math.round(net / (1 - params.microContributionRate));
  }
}

export function totalLabel(status: LegalStatus): string {
  if (status === 'MICRO') return 'CA à encaisser';
  if (status === 'EURL_IR' || status === 'EI') return 'Bénéfice nécessaire';
  return 'Coût pour la société';
}

export interface RemunerationCost {
  regime: SocialRegime;
  net: Cents;
  total: Cents;
  contributions: Cents;
  totalLabel: string;
}

/** SPEC §4.8. L'impôt sur le revenu n'est jamais compté. */
export function remunerationCost(net: Cents, status: LegalStatus, params: RegulatoryParams): RemunerationCost {
  const regime = REGIME_OF[status];
  const total = regimeTotal(net, regime, params);
  return { regime, net, total, contributions: total - net, totalLabel: totalLabel(status) };
}

export function remunerationComparison(net: Cents, params: RegulatoryParams): Array<{ regime: SocialRegime; label: string; total: Cents }> {
  return (['SALARIE', 'TNS', 'MICRO'] as const).map((regime) => ({ regime, label: REGIME_LABELS[regime], total: regimeTotal(net, regime, params) }));
}
