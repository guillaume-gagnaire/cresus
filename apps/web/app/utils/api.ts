import type { ApiErrorBody } from '@cresus/shared';

export class ApiError extends Error {
  constructor(
    /** 0 : pas de réseau (ou serveur injoignable). */
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

const FALLBACK = 'Une erreur est survenue. Réessayez dans un instant.';
export const OFFLINE_MESSAGE = 'Pas de réseau. Réessayez quand la connexion revient.';
/** Émis sur `window` quand une requête répond 401 : la session a expiré ou a été coupée. */
export const UNAUTHENTICATED_EVENT = 'cresus:unauthenticated';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  /** Un 401 ne déconnecte pas l'appareil (envoi des ventes : la caisse reste ouverte et affiche « Reconnexion »). */
  quiet401?: boolean;
}

/** Appel JSON vers /api. Les mutations envoient un corps JSON (protection CSRF côté API). */
async function request<T>(method: Method, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const hasBody = body !== undefined || (method !== 'GET' && method !== 'DELETE');
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', OFFLINE_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  const json = (res.headers.get('content-type') ?? '').includes('application/json');
  const data = json ? ((await res.json().catch(() => null)) as (ApiErrorBody & T) | null) : null;
  // Une réponse qui ne vient pas de l'API (pas de JSON, ou pas d'erreur de l'API) : le proxy répond à sa place pendant
  // un redémarrage (Traefik : « 404 page not found », 502–504) ou une page de maintenance. Traitée comme hors ligne,
  // jamais comme « introuvable » : la caisse garde ses ventes en attente et réessaie.
  if ((res.ok && !json) || (!res.ok && typeof data?.code !== 'string')) throw new ApiError(0, 'OFFLINE', OFFLINE_MESSAGE);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/') && !options.quiet401) window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    throw new ApiError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? FALLBACK);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body ?? {}, options),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export const errorMessage = (error: unknown): string => (error instanceof ApiError ? error.message : FALLBACK);
