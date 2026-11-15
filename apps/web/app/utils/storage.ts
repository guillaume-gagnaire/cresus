/**
 * localStorage tolérant : en navigation privée, stockage plein ou bloqué, lire renvoie la valeur par défaut et écrire
 * ne lève jamais (l'appli continue, elle perd seulement la mémoire entre deux ouvertures).
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible : rien à faire
  }
}

export const STORAGE = {
  account: 'cresus:account',
  installDismissed: 'cresus:install-dismissed',
  installed: 'cresus:installed',
} as const;
