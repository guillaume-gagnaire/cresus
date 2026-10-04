import { params2026 } from './2026';
import { params2027 } from './2027';

export interface RegulatoryParams {
  year: number;
  /** Coût total d'un net en assimilé salarié (× net) */
  salarieCoef: number;
  /** Coût total d'un net en TNS (× net) */
  tnsCoef: number;
  microContributionRate: number;
  microVersementLiberatoireRate: number;
  /** Plafond de CA micro (centimes) */
  microCeiling: number;
  /** Seuil de franchise de TVA (centimes) */
  vatThreshold: number;
}

const ALL: readonly RegulatoryParams[] = [params2026, params2027];

/** Paramètres de l'année, sinon ceux de l'année connue la plus proche. */
export function paramsFor(year: number): RegulatoryParams {
  let found = ALL[0]!;
  for (const p of ALL) if (p.year <= year) found = p;
  return found;
}
