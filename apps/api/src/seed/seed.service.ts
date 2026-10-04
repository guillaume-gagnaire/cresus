import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DEMO_EMAIL, demoExportFile } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import { type AppConfig, CONFIG } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { exportFileSchema } from '../data/export.schema.js';
import { TransferService } from '../data/transfer.service.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly transfer: TransferService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.seedDemo) await this.ensureDemoUser();
  }

  async ensureDemoUser(): Promise<void> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
    if (existing) return;
    const file = demoExportFile();
    const [user] = await this.db
      .insert(users)
      .values({ email: DEMO_EMAIL, passwordHash: await hashPassword(this.config.seedDemoPassword), role: 'USER', firstName: file.profile.firstName })
      .returning({ id: users.id });
    await this.transfer.importFile(user!.id, exportFileSchema.parse(file));
    this.logger.log(`Compte de démo créé : ${DEMO_EMAIL}`);
  }
}
