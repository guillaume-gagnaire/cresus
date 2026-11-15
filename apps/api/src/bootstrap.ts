import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppErrorFilter } from './common/error.filter.js';
import { jsonOnlyMutations } from './common/json-only.middleware.js';
import { securityHeaders } from './common/security-headers.middleware.js';
import { type AppConfig, loadConfig } from './config.js';

/** Les migrations sont jouées par DbModule à l'ouverture de la base. */
export async function createApp(config: AppConfig = loadConfig()): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: config.nodeEnv === 'test' ? false : ['log', 'warn', 'error'],
    // une erreur au démarrage (migration, base injoignable…) est propagée à l'appelant au lieu de tuer le processus
    abortOnError: false,
  });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // en premier : les en-têtes de sécurité couvrent aussi le front et les réponses d'erreur
  app.use(securityHeaders({ production: config.nodeEnv === 'production' }));
  app.setGlobalPrefix('api');
  // un lot de 500 ventes tient largement dans 1 Mo
  app.useBodyParser('json', { limit: '1mb' });
  app.use(cookieParser(config.sessionSecret));
  app.use(jsonOnlyMutations);
  // en test le logger Nest est désactivé : le filtre journalise alors les erreurs inattendues sur la console
  app.useGlobalFilters(new AppErrorFilter(config.nodeEnv === 'test'));
  app.enableShutdownHooks();
  return app;
}
