import { existsSync } from 'node:fs';
import { type DynamicModule, Logger, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module.js';
import { type AppConfig, CONFIG } from './config.js';
import { DataModule } from './data/data.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { SeedModule } from './seed/seed.module.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    const serveFront = !!config.webDist && existsSync(config.webDist);
    if (config.webDist && !serveFront) new Logger('AppModule').warn(`WEB_DIST introuvable : ${config.webDist} — le front ne sera pas servi`);
    return {
      module: AppModule,
      global: true,
      imports: [
        DbModule,
        AuthModule,
        DataModule,
        SeedModule,
        // le front (build Nuxt) est servi avec repli SPA ; l'API (/api) n'est jamais interceptée
        ...(serveFront && config.webDist
          ? [
              ServeStaticModule.forRoot({
                rootPath: config.webDist,
                exclude: ['/api/{*path}'],
                serveStaticOptions: {
                  setHeaders: (res, path) => {
                    if (/[\\/]_nuxt[\\/]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                    else res.setHeader('Cache-Control', 'no-cache');
                  },
                },
              }),
            ]
          : []),
      ],
      controllers: [HealthController],
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
