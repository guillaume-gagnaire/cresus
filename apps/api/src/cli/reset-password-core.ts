import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import type { Db } from '../db/client.js';
import { accounts, sessions } from '../db/schema.js';

/** Sans caractères ambigus (0/o, 1/l/i) : le mot de passe est dicté au téléphone ou recopié à la main. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function readablePassword(length = 12): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** Donne un nouveau mot de passe au compte et coupe toutes ses sessions ; renvoie le mot de passe en clair. */
export async function resetPassword(db: Db, rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email));
  if (!account) throw new Error(`Aucun compte pour ${email}`);
  const password = readablePassword();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ passwordHash }).where(eq(accounts.id, account.id));
    await tx.delete(sessions).where(eq(sessions.accountId, account.id));
  });
  return password;
}
