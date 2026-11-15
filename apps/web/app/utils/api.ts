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

/** Appel JSON vers /api. Les mutations envoient un corps JSON (protection CSRF côté API). */
async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
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
  const data = (await res.json().catch(() => null)) as (ApiErrorBody & T) | null;
  if (!res.ok) {
    // un proxy qui répond 502/503/504 pendant un redéploiement ou une coupure : traité comme hors ligne
    if (res.status >= 502 && res.status <= 504) throw new ApiError(0, 'OFFLINE', OFFLINE_MESSAGE);
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    throw new ApiError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? FALLBACK);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export const errorMessage = (error: unknown): string => (error instanceof ApiError ? error.message : FALLBACK);
