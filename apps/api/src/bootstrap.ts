import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { AppErrorFilter } from './common/error.filter.js';
import { jsonOnlyMutations } from './common/json-only.middleware.js';
import { type AppConfig, loadConfig } from './config.js';
import { OAuthProvider } from './oauth/oauth.provider.js';
import { OAUTH_SCOPE } from './oauth/oauth.store.js';

/** Les migrations sont jouées par DbModule à l'ouverture de la base. */
export async function createApp(config: AppConfig = loadConfig()): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: config.nodeEnv === 'test' ? false : ['log', 'warn', 'error'],
    // une erreur au démarrage (migration, base injoignable…) est propagée à l'appelant au lieu de tuer le processus
    abortOnError: false,
  });
  // une sauvegarde JSON peut dépasser les 100 ko par défaut d'Express
  app.useBodyParser('json', { limit: '5mb' });
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser(config.sessionSecret));
  app.use(jsonOnlyMutations);
  // serveur d'autorisation OAuth 2.1 : middlewares Express montés avant les routes Nest et le repli SPA, hors du préfixe /api
  const issuerUrl = new URL(config.publicUrl);
  // le SDK ne publie les métadonnées de la ressource qu'au chemin de /mcp ; la racine en est un alias (repli prévu par la RFC 9728)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/.well-known/oauth-protected-resource') req.url = '/.well-known/oauth-protected-resource/mcp';
    next();
  });
  app.use(
    mcpAuthRouter({
      provider: app.get(OAuthProvider),
      issuerUrl,
      resourceServerUrl: new URL('/mcp', issuerUrl),
      scopesSupported: [OAUTH_SCOPE],
      resourceName: 'Ma Tréso',
      // le client_id est généré par OAuthStore.registerClient (aléatoire, clients publics uniquement)
      clientRegistrationOptions: { clientIdGeneration: false },
    }),
  );
  // en test le logger Nest est désactivé : le filtre journalise alors les erreurs inattendues sur la console
  app.useGlobalFilters(new AppErrorFilter(config.nodeEnv === 'test'));
  app.enableShutdownHooks();
  return app;
}
