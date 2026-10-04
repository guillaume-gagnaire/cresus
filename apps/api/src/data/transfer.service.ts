import { Inject, Injectable } from '@nestjs/common';
import { type ExportFileV1, isWorkingDay, type StateDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots, charges, clients, leaves, rates, users } from '../db/schema.js';
import type { ExportFileInput } from './export.schema.js';
import { StateService } from './state.service.js';

const LEAVES_BATCH = 5_000;

@Injectable()
export class TransferService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly state: StateService,
  ) {}

  async exportFile(userId: string): Promise<ExportFileV1> {
    const s = await this.state.getState(userId);
    const { id: _id, email: _email, role: _role, ...profile } = s.profile;
    return {
      format: 'ma-treso',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      balanceSnapshots: [...s.balance.history].reverse().map((b) => ({ date: b.date, amount: b.amount })),
      clients: s.clients.map(({ id, rates: clientRates, archivedAt, ...c }) => ({
        ...c, ref: id, archived: archivedAt !== null, rates: clientRates.map((r) => ({ validFrom: r.validFrom, amount: r.amount })),
      })),
      leaves: s.leaves.map((l) => ({ date: l.date, scope: l.scope, clientRef: l.clientId })),
      charges: s.charges.map(({ id: _cid, ...c }) => c),
    };
  }

  /** Remplace toutes les données de l'utilisateur, dans une transaction. */
  async importFile(userId: string, file: ExportFileInput): Promise<StateDto> {
    await this.db.transaction(async (tx) => {
      // verrou sur la ligne de l'utilisateur : deux imports simultanés (double clic, deux onglets) s'exécutent l'un après l'autre au lieu de dupliquer les données
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      await tx.delete(leaves).where(eq(leaves.userId, userId));
      await tx.delete(clients).where(eq(clients.userId, userId));
      await tx.delete(charges).where(eq(charges.userId, userId));
      await tx.delete(balanceSnapshots).where(eq(balanceSnapshots.userId, userId));
      await tx.update(users).set(file.profile).where(eq(users.id, userId));
      const idByRef = new Map<string, string>();
      for (const [position, c] of file.clients.entries()) {
        const { ref, rates: clientRates, archived, ...fields } = c;
        const [row] = await tx
          .insert(clients)
          .values({ ...fields, weekdays: fields.billingMode === 'FORFAIT' ? [] : fields.weekdays, userId, position, archivedAt: archived ? new Date() : null })
          .returning({ id: clients.id });
        idByRef.set(ref, row!.id);
        const uniqueRates = [...new Map(clientRates.map((r) => [r.validFrom, r])).values()];
        await tx.insert(rates).values(uniqueRates.map((r) => ({ clientId: row!.id, validFrom: r.validFrom, amount: r.amount })));
      }
      // Les congés posés un jour non ouvré (week-end, férié) sont ignorés sans rejeter le fichier : la saisie les refuse
      // (422 NOT_A_WORKING_DAY), l'application n'en produit donc jamais ; une sauvegarde éditée à la main reste importable.
      const leaveRows = file.leaves.filter((l) => isWorkingDay(l.date)).map((l) => ({ userId, date: l.date, scope: l.scope, clientId: l.scope === 'CLIENT' ? idByRef.get(l.clientRef!)! : null }));
      // par lots : PostgreSQL limite une requête à 65 535 paramètres (le schéma accepte jusqu'à 20 000 congés)
      for (let i = 0; i < leaveRows.length; i += LEAVES_BATCH) {
        await tx.insert(leaves).values(leaveRows.slice(i, i + LEAVES_BATCH)).onConflictDoNothing();
      }
      if (file.charges.length) await tx.insert(charges).values(file.charges.map((c) => ({ ...c, userId })));
      if (file.balanceSnapshots.length) await tx.insert(balanceSnapshots).values(file.balanceSnapshots.map((b) => ({ ...b, userId })));
    });
    return this.state.getState(userId);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
