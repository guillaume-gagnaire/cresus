import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppErrorFilter } from './common/error.filter.js';
import { securityHeaders } from './common/security-headers.middleware.js';
import { jsonOnlyMutations } from './common/json-only.middleware.js';
import { type AppConfig, loadConfig } from './config.js';
import { mountMcp } from './mcp/mcp.server.js';
import { mountOAuth } from './oauth/oauth.mount.js';

/** Les migrations sont jouées par DbModule à l'ouverture de la base. */
export async function createApp(config: AppConfig = loadConfig()): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: config.nodeEnv === 'test' ? false : ['log', 'warn', 'error'],
    // une erreur au démarrage (migration, base injoignable…) est propagée à l'appelant au lieu de tuer le processus
    abortOnError: false,
  });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // en premier : les en-têtes de sécurité couvrent aussi les routes OAuth, le MCP, le front et les réponses d'erreur
  app.use(securityHeaders({ production: config.nodeEnv === 'production' }));
  app.setGlobalPrefix('api');
  // serveur d'autorisation OAuth 2.1 : middlewares Express montés avant les routes Nest et le repli SPA, hors du préfixe /api,
  // et avant le parseur JSON global (ils ont leurs propres parseurs, bornés)
  mountOAuth(app, config);
  // serveur MCP (/mcp) : protégé par les jetons Bearer d'OAuth, avec son propre parseur JSON (1 Mo), lui aussi avant le parseur global
  mountMcp(app, config);
  // une sauvegarde JSON peut dépasser les 100 ko par défaut d'Express
  app.useBodyParser('json', { limit: '5mb' });
  app.use(cookieParser(config.sessionSecret));
  app.use(jsonOnlyMutations);
  // en test le logger Nest est désactivé : le filtre journalise alors les erreurs inattendues sur la console
  app.useGlobalFilters(new AppErrorFilter(config.nodeEnv === 'test'));
  app.enableShutdownHooks();
  return app;
}
