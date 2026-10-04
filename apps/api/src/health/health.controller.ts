import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async health(): Promise<{ status: 'ok'; db: 'ok' }> {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'ok' };
  }
}
