import { Inject, Injectable } from '@nestjs/common';
import type { MeDto, UserRole } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { uniqueViolation } from '../common/pg-errors.js';
import { DB, type Db } from '../db/db.module.js';
import { passkeys, users } from '../db/schema.js';
import { toProfileDto } from '../data/mappers.js';
import { revokeAllOAuthAccess } from '../oauth/oauth.store.js';
import { hashPassword, verifyPassword } from './password.js';

/** Nom de l'index unique partiel qui garantit un seul ADMIN (cf. db/schema.ts). */
const SINGLE_ADMIN_CONSTRAINT = 'users_single_admin_uq';

const EMAIL_TAKEN = () => new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail.');
const INVALID = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou mot de passe incorrect.');

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Le premier compte inscrit devient ADMIN (il n'en existe qu'un), les suivants sont USER. */
  async register(input: { email: string; password: string; firstName: string }): Promise<string> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing) throw EMAIL_TAKEN();
    const passwordHash = await hashPassword(input.password);
    const values = { email: input.email, passwordHash, firstName: input.firstName };
    const [admin] = await this.db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN')).limit(1);
    if (admin) return this.insertUser(values, 'USER');
    try {
      return await this.insertUser(values, 'ADMIN');
    } catch (e) {
      // deux premières inscriptions simultanées : l'index unique partiel départage, la perdante est rejouée en USER
      if (uniqueViolation(e)?.constraint === SINGLE_ADMIN_CONSTRAINT) return this.insertUser(values, 'USER');
      throw e;
    }
  }

  private async insertUser(values: { email: string; passwordHash: string; firstName: string }, role: UserRole): Promise<string> {
    try {
      const [user] = await this.db.insert(users).values({ ...values, role }).returning({ id: users.id });
      return user!.id;
    } catch (e) {
      // deux inscriptions simultanées avec le même e-mail : la contrainte unique départage (l'index « un seul ADMIN » est remonté tel quel)
      const violation = uniqueViolation(e);
      if (violation && violation.constraint !== SINGLE_ADMIN_CONSTRAINT) throw EMAIL_TAKEN();
      throw e;
    }
  }

  async login(email: string, password: string): Promise<string> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    if (!user || !(await verifyPassword(user.passwordHash, password))) throw INVALID();
    return user.id;
  }

  async me(userId: string): Promise<MeDto> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Connecte-toi pour continuer.');
    const keys = await this.db.select({ id: passkeys.id }).from(passkeys).where(eq(passkeys.userId, userId)).limit(1);
    return { user: toProfileDto(user), hasPasskey: keys.length > 0 };
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(user.passwordHash, current))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe actuel incorrect.');
    const passwordHash = await hashPassword(next);
    // un mot de passe changé après une compromission doit aussi couper l'accès des applications connectées (Claude Code…) : même transaction
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
      await revokeAllOAuthAccess(tx, userId);
    });
  }

  async checkPassword(userId: string, password: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(user.passwordHash, password))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe incorrect.');
  }
}
