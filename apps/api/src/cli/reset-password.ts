// Réinitialise le mot de passe d'un compte : node dist/cli/reset-password.js <email>
// (dans l'image Docker : cd /app/apps/api && node dist/cli/reset-password.js <email>)
import { loadConfig } from '../config.js';
import { openDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { resetPassword } from './reset-password-core.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage : node dist/cli/reset-password.js <email>');
  process.exit(1);
}

const handle = await openDb(loadConfig().databaseUrl);
try {
  await runMigrations(handle);
  const password = await resetPassword(handle.db, email);
  console.log(`Nouveau mot de passe pour ${email.trim().toLowerCase()} : ${password}`);
  console.log('Toutes les sessions de ce compte ont été fermées.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
