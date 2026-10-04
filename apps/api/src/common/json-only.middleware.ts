import type { NextFunction, Request, Response } from 'express';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Protection CSRF : les mutations sur /api exigent un Content-Type JSON (impossible en simple formulaire cross-site). */
export function jsonOnlyMutations(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] ?? '';
  if (MUTATIONS.has(req.method) && req.path.startsWith('/api/') && !contentType.startsWith('application/json')) {
    res.status(415).json({ statusCode: 415, code: 'JSON_REQUIRED', message: 'Requête invalide.' });
    return;
  }
  next();
}
