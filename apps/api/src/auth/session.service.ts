import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, ne } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { sessions } from '../db/schema.js';
import { SESSION_TTL_MS } from './cookies.js';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const DAY_MS = 24 * 3600 * 1000;

export interface ValidSession {
  userId: string;
  /** `true` quand l'expiration a été prolongée : le cookie doit être ré-émis pour que le navigateur la suive. */
  renewed: boolean;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    return token;
  }

  /** Renvoie la session si elle est valide, et prolonge l'expiration (glissante, au plus une fois par jour). */
  async validate(token: string): Promise<ValidSession | null> {
    const id = hashToken(token);
    const [row] = await this.db.select().from(sessions).where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
    if (!row) return null;
    const renewed = row.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - DAY_MS;
    if (renewed) {
      await this.db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) }).where(eq(sessions.id, id));
    }
    return { userId: row.userId, renewed };
  }

  async destroy(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  async destroyAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /** Révoque les sessions de l'utilisateur autres que celle du jeton donné (changement de mot de passe). */
  async destroyOthersForUser(userId: string, keepToken: string): Promise<void> {
    await this.db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, hashToken(keepToken))));
  }
}
