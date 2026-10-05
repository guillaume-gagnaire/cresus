/** Violation de contrainte unique PostgreSQL (code SQLSTATE 23505), portée par l'erreur ou par la `cause` d'une erreur drizzle. */
export function uniqueViolation(e: unknown): { constraint: string | undefined } | undefined {
  for (const candidate of [e, (e as { cause?: unknown } | null)?.cause]) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const { code, constraint } = candidate as { code?: unknown; constraint?: unknown };
    if (code === '23505') return { constraint: typeof constraint === 'string' ? constraint : undefined };
  }
  return undefined;
}
