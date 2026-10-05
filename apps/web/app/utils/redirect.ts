const MAX_LENGTH = 2048;

// Un chemin interne n’a ni `//` ni `/\` au début (les navigateurs les lisent comme une adresse relative au schéma, donc
// externe), ni antislash ni caractère de contrôle (tabulation et retours à la ligne sont supprimés par le parseur d’URL,
// donc `/<TAB>/hote` deviendrait `//hote`). La page de connexion elle-même n’est jamais une destination.
const UNSAFE = /[\\\u0000-\u001f\u007f]/;
const LOGIN = /^\/login(?:[/?#]|$)/i;

function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !UNSAFE.test(path) && !LOGIN.test(path);
}

/**
 * Destination après connexion tirée de `?redirect=` : un chemin relatif de l’app (`/oauth/consent?request=…`), sinon `null`.
 * La valeur est contrôlée telle quelle et une fois décodée (`/%2F%2Fhote`, `/%5Chote`), car elle vient d’une URL qu’un tiers peut forger.
 */
export function safeRedirect(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null; // encodage invalide : pas une URL fabriquée par l’app
  }
  return isInternalPath(raw) && isInternalPath(decoded) ? raw : null;
}
