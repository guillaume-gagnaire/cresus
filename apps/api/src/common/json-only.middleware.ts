import type { NextFunction, Request, Response } from 'express';

// DELETE exempté : aucun formulaire HTML ne peut l'envoyer, et un fetch cross-origin DELETE passe par un preflight CORS
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Protection CSRF : les mutations sur /api exigent un Content-Type JSON (impossible en simple formulaire cross-site).
 * Le routage d'Express ignore la casse (`POST /API/...` atteint les mêmes routes) : le préfixe est donc comparé en minuscules.
 */
export function jsonOnlyMutations(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] ?? '';
  if (MUTATIONS.has(req.method) && req.path.toLowerCase().startsWith('/api/') && !contentType.startsWith('application/json')) {
    res.status(415).json({ statusCode: 415, code: 'JSON_REQUIRED', message: 'Requête invalide.' });
    return;
  }
  next();
}
