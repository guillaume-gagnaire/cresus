import { type DynamicModule, Module } from '@nestjs/common';
import { type AppConfig, CONFIG } from './config.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [DbModule],
      controllers: [HealthController],
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
