import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, ne } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { sessions } from '../db/schema.js';
import { SESSION_RENEW_MS, SESSION_TTL_MS } from './cookies.js';

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export interface ValidSession {
  accountId: string;
  /** `true` quand l'expiration a été prolongée : le cookie doit être ré-émis pour que le navigateur la suive. */
  renewed: boolean;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(accountId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({ id: hashToken(token), accountId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    return token;
  }

  /** Renvoie la session si elle est valide, et prolonge l'expiration de 24 h (glissante, au plus toutes les 5 minutes). */
  async validate(token: string): Promise<ValidSession | null> {
    const id = hashToken(token);
    const [row] = await this.db.select().from(sessions).where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
    if (!row) return null;
    const renewed = row.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - SESSION_RENEW_MS;
    if (renewed) {
      await this.db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) }).where(eq(sessions.id, id));
    }
    return { accountId: row.accountId, renewed };
  }

  async destroy(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  /** Révoque les sessions du compte autres que celle du jeton donné (changement de mot de passe). */
  async destroyOthers(accountId: string, keepToken: string): Promise<void> {
    await this.db.delete(sessions).where(and(eq(sessions.accountId, accountId), ne(sessions.id, hashToken(keepToken))));
  }
}
