import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type AppConfig, CONFIG } from '../config.js';
import { type Db, type DbHandle, openDb } from './client.js';
import { runMigrations } from './migrate.js';

export type { Db } from './client.js';
export const DB = Symbol('DB');
export const DB_HANDLE = Symbol('DB_HANDLE');

@Global()
@Module({
  providers: [
    {
      provide: DB_HANDLE,
      inject: [CONFIG],
      useFactory: async (config: AppConfig): Promise<DbHandle> => {
        const handle = await openDb(config.databaseUrl);
        await runMigrations(handle);
        return handle;
      },
    },
    { provide: DB, inject: [DB_HANDLE], useFactory: (handle: DbHandle): Db => handle.db },
  ],
  exports: [DB, DB_HANDLE],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB_HANDLE) private readonly handle: DbHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
