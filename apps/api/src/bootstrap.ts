import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppErrorFilter } from './common/error.filter.js';
import { jsonOnlyMutations } from './common/json-only.middleware.js';
import { type AppConfig, loadConfig } from './config.js';

/** Les migrations sont jouées par DbModule à l'ouverture de la base. */
export async function createApp(config: AppConfig = loadConfig()): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: config.nodeEnv === 'test' ? false : ['log', 'warn', 'error'],
  });
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser(config.sessionSecret));
  app.use(jsonOnlyMutations);
  app.useGlobalFilters(new AppErrorFilter());
  app.enableShutdownHooks();
  return app;
}
