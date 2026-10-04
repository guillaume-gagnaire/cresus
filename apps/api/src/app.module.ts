import { type DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { type AppConfig, CONFIG } from './config.js';
import { DataModule } from './data/data.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [DbModule, AuthModule, DataModule],
      controllers: [HealthController],
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
