import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { sessions } from '../db/schema.js';
import { SESSION_TTL_MS } from './cookies.js';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    return token;
  }

  /** Renvoie l'userId si la session est valide, et prolonge l'expiration (glissante, au plus une fois par jour). */
  async validate(token: string): Promise<string | null> {
    const id = hashToken(token);
    const [row] = await this.db.select().from(sessions).where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
    if (!row) return null;
    if (row.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - DAY_MS) {
      await this.db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) }).where(eq(sessions.id, id));
    }
    return row.userId;
  }

  async destroy(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  async destroyAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
