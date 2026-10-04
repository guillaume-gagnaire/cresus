import { Inject, Injectable } from '@nestjs/common';
import type { MeDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { DB, type Db } from '../db/db.module.js';
import { passkeys, users } from '../db/schema.js';
import { toProfileDto } from '../data/mappers.js';
import { hashPassword, verifyPassword } from './password.js';

/** Violation de contrainte unique PostgreSQL (code SQLSTATE 23505), directement ou portée par la `cause` d'une erreur drizzle. */
function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown): unknown => (typeof x === 'object' && x !== null ? (x as { code?: unknown }).code : undefined);
  return code(e) === '23505' || code((e as { cause?: unknown } | null)?.cause) === '23505';
}

const EMAIL_TAKEN = () => new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail.');
const INVALID = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou mot de passe incorrect.');

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async register(input: { email: string; password: string; firstName: string }): Promise<string> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing) throw EMAIL_TAKEN();
    const passwordHash = await hashPassword(input.password);
    try {
      const [user] = await this.db.insert(users).values({ email: input.email, passwordHash, firstName: input.firstName }).returning({ id: users.id });
      return user!.id;
    } catch (e) {
      // deux inscriptions simultanées avec le même e-mail : la contrainte unique départage
      if (isUniqueViolation(e)) throw EMAIL_TAKEN();
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
    await this.db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
  }

  async checkPassword(userId: string, password: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(user.passwordHash, password))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe incorrect.');
  }
}
