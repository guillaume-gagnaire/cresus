import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import type { AuthedRequest } from '../common/current-account.decorator.js';
import { type AppConfig, CONFIG } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { accounts } from '../db/schema.js';

/** Réservé aux comptes dont l'email figure dans ADMIN_EMAILS (la session a déjà été vérifiée par SessionGuard). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [account] = req.accountId ? await this.db.select({ email: accounts.email }).from(accounts).where(eq(accounts.id, req.accountId)) : [];
    if (!account || !this.config.adminEmails.includes(account.email)) {
      throw new AppError(403, 'FORBIDDEN', 'Réservé à l’administrateur de Cresus.');
    }
    return true;
  }
}
