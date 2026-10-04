import type { RegulatoryParams } from './index';

/** Valeurs approximatives à vérifier avant la mise en production (SPEC §9.1). */
export const params2026: RegulatoryParams = {
  year: 2026,
  salarieCoef: 1.8,
  tnsCoef: 1.45,
  microContributionRate: 0.261,
  microVersementLiberatoireRate: 0.022,
  microCeiling: 8_360_000,
  vatThreshold: 3_750_000,
};
