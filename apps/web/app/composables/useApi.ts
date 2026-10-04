import type { ApiErrorBody } from '@matreso/engine';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const FALLBACK = 'Une erreur est survenue. Réessaie dans un instant.';

/** Appel JSON vers /api. Les mutations envoient toujours un corps JSON (protection CSRF côté API). */
export async function api<T>(path: string, init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const hasBody = method !== 'GET';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(init.body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Connexion impossible. Vérifie ton réseau.');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (ApiErrorBody & T) | null;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? FALLBACK);
  return data as T;
}
