import { existsSync } from 'node:fs';
import { type DynamicModule, Logger, Module } from '@nestjs/common';
import { type AppConfig, CONFIG } from './config.js';
import { DbModule } from './db/db.module.js';
import { FrontService } from './front/front.service.js';
import { HealthController } from './health/health.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    const serveFront = !!config.webDist && existsSync(config.webDist);
    if (config.webDist && !serveFront) new Logger('AppModule').warn(`WEB_DIST introuvable : ${config.webDist} — le front ne sera pas servi`);
    return {
      module: AppModule,
      global: true,
      imports: [DbModule],
      controllers: [HealthController],
      // le front (build Nuxt) est servi avec repli SPA, après les routes : /api n'est jamais intercepté
      providers: [{ provide: CONFIG, useValue: config }, ...(serveFront ? [FrontService] : [])],
      exports: [CONFIG],
    };
  }
}
