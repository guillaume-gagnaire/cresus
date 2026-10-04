import { Inject, Injectable } from '@nestjs/common';
import type { StateDto } from '@matreso/engine';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service.js';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots, charges, clients, leaves, rates } from '../db/schema.js';
import { toBalanceDto, toChargeDto, toClient, toLeaveDto } from './mappers.js';

@Injectable()
export class StateService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  async getState(userId: string): Promise<StateDto> {
    const me = await this.auth.me(userId);
    const clientRows = await this.db.select().from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.position), asc(clients.createdAt));
    const rateRows = clientRows.length
      ? await this.db.select().from(rates).where(inArray(rates.clientId, clientRows.map((c) => c.id)))
      : [];
    const leaveRows = await this.db.select().from(leaves).where(eq(leaves.userId, userId)).orderBy(asc(leaves.date));
    const chargeRows = await this.db.select().from(charges).where(eq(charges.userId, userId)).orderBy(asc(charges.createdAt));
    const balanceRows = await this.db.select().from(balanceSnapshots).where(eq(balanceSnapshots.userId, userId)).orderBy(desc(balanceSnapshots.date), desc(balanceSnapshots.createdAt));
    const history = balanceRows.map(toBalanceDto);
    return {
      profile: me.user,
      balance: { latest: history[0] ?? null, history },
      clients: clientRows.map((c) => toClient(c, rateRows)),
      leaves: leaveRows.map(toLeaveDto),
      charges: chargeRows.map(toChargeDto),
      hasPasskey: me.hasPasskey,
    };
  }
}
