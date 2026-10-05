const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Redirections acceptées à l'enregistrement d'un client : `http://localhost[:port]/…`, `http://127.0.0.1[:port]/…`
 * (clients natifs, RFC 8252) ou `https://…`. Jamais de schéma personnalisé, d'identifiants dans l'URL ni de fragment.
 */
export function isAllowedRedirectUri(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return url.hostname !== '';
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}
