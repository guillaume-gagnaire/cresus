import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from '../config.js';
import { OAuthProvider } from './oauth.provider.js';
import { OAUTH_SCOPE } from './oauth.store.js';

/** Taille maximale des corps acceptés par les routes OAuth (publiques) : une inscription ou un échange de jeton tient dans quelques centaines d'octets. */
const BODY_LIMIT = '16kb';

/** Limites par défaut du routeur du SDK : requêtes par IP et par fenêtre (15 min, sauf /register : 1 heure). */
const SDK_RATE_LIMITS = { authorize: 100, token: 50, register: 20, revoke: 50 } as const;

/** Erreurs des parseurs (413 corps trop gros, 400 JSON invalide…) au format d'erreur OAuth, plutôt que la page HTML d'Express. */
const bodyParserErrors: ErrorRequestHandler = (error: { status?: unknown }, _req, res, next) => {
  const status = error.status;
  if (typeof status !== 'number' || status < 400 || status >= 500) {
    next(error);
    return;
  }
  res.status(status).json({ error: 'invalid_request', error_description: status === 413 ? 'Request body too large' : 'Malformed request body' });
};

/**
 * Monte le serveur d'autorisation OAuth 2.1 (routeur du SDK MCP) comme middlewares Express, hors du préfixe /api.
 * À appeler **avant** le parseur JSON global (5 Mo, pour l'import) : ces routes sont publiques et ne doivent pas
 * en hériter, sinon une inscription anonyme pourrait déposer plusieurs Mo en base. Le SDK saute ses propres parseurs
 * (100 ko) quand le corps est déjà lu : on place donc ici des parseurs bornés à 16 ko.
 */
export function mountOAuth(app: NestExpressApplication, config: AppConfig): void {
  const issuerUrl = new URL(config.publicUrl);
  app.use('/register', express.json({ limit: BODY_LIMIT }));
  app.use(['/authorize', '/token', '/revoke'], express.urlencoded({ extended: false, limit: BODY_LIMIT }));
  app.use(['/register', '/authorize', '/token', '/revoke'], bodyParserErrors);
  // le SDK ne publie les métadonnées de la ressource qu'au chemin de /mcp ; la racine en est un alias (repli prévu par la RFC 9728)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/.well-known/oauth-protected-resource') req.url = '/.well-known/oauth-protected-resource/mcp';
    next();
  });
  // limites du SDK par défaut ; `OAUTH_RATE_LIMIT_MULTIPLIER` les relève (e2e Playwright et de production)
  const rateLimit = (base: number) => (config.oauthRateLimitMultiplier === 1 ? undefined : { max: base * config.oauthRateLimitMultiplier });
  app.use(
    mcpAuthRouter({
      provider: app.get(OAuthProvider),
      issuerUrl,
      resourceServerUrl: new URL('/mcp', issuerUrl),
      scopesSupported: [OAUTH_SCOPE],
      resourceName: 'Ma Tréso',
      authorizationOptions: { rateLimit: rateLimit(SDK_RATE_LIMITS.authorize) },
      tokenOptions: { rateLimit: rateLimit(SDK_RATE_LIMITS.token) },
      revocationOptions: { rateLimit: rateLimit(SDK_RATE_LIMITS.revoke) },
      // le client_id est généré par OAuthStore.registerClient (aléatoire, clients publics uniquement)
      clientRegistrationOptions: { clientIdGeneration: false, rateLimit: rateLimit(SDK_RATE_LIMITS.register) },
    }),
  );
}
