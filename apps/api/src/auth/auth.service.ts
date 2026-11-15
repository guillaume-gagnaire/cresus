import { Inject, Injectable } from '@nestjs/common';
import type { AccountDto } from '@cresus/shared';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { type AppConfig, CONFIG } from '../config.js';
import { uniqueViolation } from '../common/pg-errors.js';
import { DB, type Db } from '../db/db.module.js';
import { type AccountRow, accounts } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { UNAUTHENTICATED } from './session.guard.js';

const EMAIL_TAKEN = () => new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
const INVALID = () => new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
const WRONG_PASSWORD = () => new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe incorrect.');

export const toAccountDto = (row: AccountRow, adminEmails: readonly string[]): AccountDto => ({
  id: row.id,
  email: row.email,
  name: row.name,
  isAdmin: adminEmails.includes(row.email),
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private dto(row: AccountRow): AccountDto {
    return toAccountDto(row, this.config.adminEmails);
  }

  async signup(input: { name: string; email: string; password: string }): Promise<AccountDto> {
    const passwordHash = await hashPassword(input.password);
    try {
      const [row] = await this.db.insert(accounts).values({ name: input.name, email: input.email, passwordHash }).returning();
      return this.dto(row!);
    } catch (e) {
      if (uniqueViolation(e)) throw EMAIL_TAKEN();
      throw e;
    }
  }

  async login(email: string, password: string): Promise<AccountDto> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.email, email));
    if (!row || !(await verifyPassword(row.passwordHash, password))) throw INVALID();
    return this.dto(row);
  }

  async me(accountId: string): Promise<AccountDto> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!row) throw UNAUTHENTICATED();
    return this.dto(row);
  }

  async rename(accountId: string, name: string): Promise<AccountDto> {
    const [row] = await this.db.update(accounts).set({ name }).where(eq(accounts.id, accountId)).returning();
    if (!row) throw UNAUTHENTICATED();
    return this.dto(row);
  }

  async changePassword(accountId: string, current: string, next: string): Promise<void> {
    await this.checkPassword(accountId, current);
    await this.db.update(accounts).set({ passwordHash: await hashPassword(next) }).where(eq(accounts.id, accountId));
  }

  /** Supprime le compte et, en cascade, ses sessions, évènements, articles et ventes. */
  async deleteAccount(accountId: string, password: string): Promise<void> {
    await this.checkPassword(accountId, password);
    await this.db.delete(accounts).where(eq(accounts.id, accountId));
  }

  private async checkPassword(accountId: string, password: string): Promise<void> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!row || !(await verifyPassword(row.passwordHash, password))) throw WRONG_PASSWORD();
  }
}
