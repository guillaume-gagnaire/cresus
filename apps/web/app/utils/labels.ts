export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V'] as const;
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'] as const;
export const WEEKDAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/** Initiales pour la pastille (« Gagnaire Développement » → « GD », sinon prénom → « G »). */
export function initials(companyName: string | null, firstName: string): string {
  const source = companyName?.trim() || firstName;
  return source.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

export const ESTIMATE_NOTE = 'Estimation simplifiée, à affiner avec ton expert-comptable.';
