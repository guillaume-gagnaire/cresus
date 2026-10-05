import type { NextFunction, Request, Response } from 'express';

/** Un an : durée recommandée pour que HSTS soit pris en compte (liste de préchargement comprise). */
const HSTS = 'max-age=31536000; includeSubDomains';

/**
 * En-têtes de sécurité sur toutes les réponses (API, OAuth, MCP, front servi par l'API), sans dépendance :
 * pas de détection de type MIME, pas de referrer complet vers d'autres sites, pas d'affichage dans une iframe.
 * HSTS seulement en production : il engagerait le navigateur à n'utiliser que HTTPS pour ce domaine, y compris en local.
 */
export function securityHeaders(options: { production: boolean }): (req: Request, res: Response, next: NextFunction) => void {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (options.production) res.setHeader('Strict-Transport-Security', HSTS);
    next();
  };
}
