import { existsSync } from 'node:fs';
import { type DynamicModule, Logger, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { type AppConfig, CONFIG } from './config.js';
import { DataModule } from './data/data.module.js';
import { DbModule } from './db/db.module.js';
import { FrontService } from './front/front.service.js';
import { HealthController } from './health/health.controller.js';
import { McpModule } from './mcp/mcp.module.js';
import { OAuthModule } from './oauth/oauth.module.js';
import { SeedModule } from './seed/seed.module.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    const serveFront = !!config.webDist && existsSync(config.webDist);
    if (config.webDist && !serveFront) new Logger('AppModule').warn(`WEB_DIST introuvable : ${config.webDist} — le front ne sera pas servi`);
    return {
      module: AppModule,
      global: true,
      imports: [DbModule, AuthModule, DataModule, OAuthModule, McpModule, SeedModule],
      controllers: [HealthController],
      // le front (build Nuxt) est servi avec repli SPA, après les routes : l'API (/api), le MCP et les routes OAuth ne sont jamais interceptés
      providers: [{ provide: CONFIG, useValue: config }, ...(serveFront ? [FrontService] : [])],
      exports: [CONFIG],
    };
  }
}
