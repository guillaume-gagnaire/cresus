# Ma Tréso — Plan d'implémentation, Phase 2 : API (`apps/api`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Suite de `2026-10-04-ma-treso.md`. Les sections **Global Constraints**, **Review Focus** et **Conventions de code** de ce fichier s'appliquent ici aussi. Spec : `docs/superpowers/specs/2026-10-04-ma-treso-design.md` §4.

**Prérequis :** Phase 1 terminée (`@matreso/engine` construit) et Docker Desktop lancé.

**Rappels propres à l'API :**
- NestJS 12 est **ESM** (`"type": "module"`). Le code est compilé par `tsc` (TS ~5.9, `experimentalDecorators` + `emitDecoratorMetadata`), avec `module: NodeNext` : **les imports relatifs prennent l'extension `.js`** (`import { AppError } from '../common/app-error.js'`).
- Ne pas ajouter `@nestjs/throttler` (ses peer dependencies ne couvrent pas forcément Nest 12) : un garde de limitation de débit maison est fourni en Task 15.
- Si une API de Nest 12 diffère de ce qui est écrit ici (signature, option), suivre les types installés et le noter dans le message de commit. Ne pas rétrograder Nest sans le signaler.
- Tests e2e : Vitest + `unplugin-swc` (esbuild n'émet pas les métadonnées de décorateurs) + supertest, sur la base `matreso_test` du conteneur `db`.

## Carte des fichiers (Phase 2)

```
docker-compose.yml                 # service db (le service app arrive en Task 34)
docker/initdb/01-test-dbs.sql      # crée matreso_test et matreso_e2e
.env.example
apps/api/
  package.json · tsconfig.json · tsconfig.build.json · vitest.config.ts · drizzle.config.ts · .env.e2e
  drizzle/                         # migrations générées par drizzle-kit
  src/
    main.ts                        # point d'entrée : createApp() puis listen
    bootstrap.ts                   # createApp(config) : middlewares, filtre, migrations
    app.module.ts                  # AppModule.register(config)
    config.ts                      # loadConfig(env) + jeton CONFIG
    common/ app-error.ts error.filter.ts zod.pipe.ts schemas.ts json-only.middleware.ts
            public.decorator.ts current-user.decorator.ts rate-limit.guard.ts
    db/ schema.ts db.module.ts migrate.ts
    health/ health.controller.ts
    auth/ auth.module.ts password.ts session.service.ts session.guard.ts cookies.ts
          auth.service.ts auth.controller.ts passkey.service.ts passkey.controller.ts
    data/ data.module.ts mappers.ts state.service.ts state.controller.ts profile.controller.ts
          balance.controller.ts clients.service.ts clients.controller.ts leaves.service.ts
          leaves.controller.ts charges.service.ts charges.controller.ts
          transfer.service.ts transfer.controller.ts export.schema.ts
    seed/ seed.service.ts seed.module.ts cli.ts
  test/ helpers.ts health.e2e.test.ts auth.e2e.test.ts passkey.e2e.test.ts state.e2e.test.ts
        clients.e2e.test.ts leaves-charges.e2e.test.ts transfer.e2e.test.ts
```

---

### Task 14: Socle API (config, Drizzle, migrations, health, harnais e2e)

**Files:**
- Create : tous les fichiers `apps/api/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,drizzle.config.ts,.env.e2e}`, `apps/api/src/{main.ts,bootstrap.ts,app.module.ts,config.ts}`, `apps/api/src/common/{app-error.ts,error.filter.ts,zod.pipe.ts,schemas.ts,json-only.middleware.ts}`, `apps/api/src/db/{schema.ts,db.module.ts,migrate.ts}`, `apps/api/src/health/health.controller.ts`, `apps/api/test/{helpers.ts,health.e2e.test.ts}`, `docker-compose.yml`, `docker/initdb/01-test-dbs.sql`, `.env.example`
- Modify : `.gitignore` (ajouter `!apps/api/.env.e2e`)

**Interfaces:**
- Consumes : `LEGAL_STATUSES`, `PAYMENT_TERM_KEYS`, `BILLING_MODES`, `CLIENT_COLORS`, `LEAVE_SCOPES`, `CHARGE_FREQUENCIES`, `isISODate` de `@matreso/engine`.
- Produces : `loadConfig(env): AppConfig`, `CONFIG` (jeton d'injection), `AppConfig`, `DB` (jeton), `type Db`, tables Drizzle `users`, `sessions`, `passkeys`, `balanceSnapshots`, `clients`, `rates`, `leaves`, `charges`, `createApp(config): Promise<NestExpressApplication>`, `AppError(status, code, message)`, `notFound(what)`, `ZodPipe(schema)`, helpers zod `isoDate`, `cents`, `signedCents`, et pour les tests `setupTestApp()`, `resetDb(app)`, `json(agentOrRequest)`.

- [ ] **Step 1: Infra locale**

`docker-compose.yml` :
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: matreso
      POSTGRES_PASSWORD: matreso
      POSTGRES_DB: matreso
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U matreso"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  db-data: {}
```

`docker/initdb/01-test-dbs.sql` :
```sql
CREATE DATABASE matreso_test;
CREATE DATABASE matreso_e2e;
```

`.env.example` :
```dotenv
# Base PostgreSQL
DATABASE_URL=postgres://matreso:matreso@localhost:5432/matreso
# Secret de signature des cookies (≥ 16 caractères, à changer en production)
SESSION_SECRET=change-me-change-me-change-me
# Port HTTP de l'API (3001 en dev, 3000 dans l'image Docker)
PORT=3001
NODE_ENV=development
# Passkeys : domaine et origine exacts du site
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Ma Tréso
WEBAUTHN_ORIGIN=http://localhost:3000
# Cookies Secure (true derrière HTTPS)
COOKIE_SECURE=false
# Compte de démo demo@matreso.fr
SEED_DEMO=true
SEED_DEMO_PASSWORD=demo1234
# Dossier du build statique Nuxt servi par l'API (vide en dev)
WEB_DIST=
```

`apps/api/.env.e2e` (valeurs de test, sans secret réel) :
```dotenv
DATABASE_URL=postgres://matreso:matreso@localhost:5432/matreso_e2e
SESSION_SECRET=e2e-secret-e2e-secret-e2e
PORT=3001
NODE_ENV=test
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
SEED_DEMO=true
SEED_DEMO_PASSWORD=demo1234
AUTH_RATE_LIMIT=10000
```

Ajouter `!apps/api/.env.e2e` à la fin de `.gitignore`.

Run : `docker compose up -d db` puis `docker compose ps`
Expected : `db` est `healthy`.

- [ ] **Step 2: Package API**

`apps/api/package.json` :
```json
{
  "name": "@matreso/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json && concurrently -k -n tsc,node \"tsc -w -p tsconfig.build.json --preserveWatchOutput\" \"node --watch --env-file-if-exists=../../.env dist/main.js\"",
    "dev:e2e": "tsc -p tsconfig.build.json && node --env-file=.env.e2e dist/main.js",
    "start": "node dist/main.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "db:generate": "drizzle-kit generate",
    "seed": "node --env-file-if-exists=../../.env dist/seed/cli.js"
  }
}
```

`apps/api/tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    "outDir": "dist",
    "types": ["node"],
    "isolatedModules": false
  },
  "include": ["src", "test", "vitest.config.ts", "drizzle.config.ts"]
}
```

`apps/api/tsconfig.build.json` :
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "sourceMap": true },
  "include": ["src"]
}
```

`apps/api/vitest.config.ts` :
```ts
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: { '@matreso/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.e2e.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
```

`apps/api/drizzle.config.ts` :
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://matreso:matreso@localhost:5432/matreso' },
});
```

Run :
```bash
export PATH="/c/Users/guill/AppData/Roaming/nvm/v24.14.0:$PATH"
npm i -w @matreso/api @nestjs/common@^12 @nestjs/core@^12 @nestjs/platform-express@^12 reflect-metadata rxjs drizzle-orm pg zod cookie-parser @matreso/engine@*
npm i -D -w @matreso/api typescript@~5.9 drizzle-kit @types/pg @types/cookie-parser @types/express @types/node vitest unplugin-swc @swc/core supertest @types/supertest concurrently
```
Expected : installation sans erreur ERESOLVE. En cas de conflit de peer dependencies, le signaler plutôt que de passer `--force`.

- [ ] **Step 3: Config, erreurs, validation**

`src/config.ts` :
```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL manquant'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET doit faire au moins 16 caractères'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('Ma Tréso'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  SEED_DEMO: z.enum(['true', 'false']).default('false'),
  SEED_DEMO_PASSWORD: z.string().min(8).default('demo1234'),
  WEB_DIST: z.string().optional(),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  webauthn: { rpId: string; rpName: string; origin: string };
  cookieSecure: boolean;
  seedDemo: boolean;
  seedDemoPassword: string;
  webDist: string | null;
  /** Requêtes par minute et par IP sur /auth (10 par défaut, relevé pour les tests Playwright) */
  authRateLimit: number;
}

export const CONFIG = Symbol('CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = envSchema.parse(env);
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET,
    webauthn: { rpId: e.WEBAUTHN_RP_ID, rpName: e.WEBAUTHN_RP_NAME, origin: e.WEBAUTHN_ORIGIN },
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : e.NODE_ENV === 'production',
    seedDemo: e.SEED_DEMO === 'true',
    seedDemoPassword: e.SEED_DEMO_PASSWORD,
    webDist: e.WEB_DIST ? e.WEB_DIST : null,
    authRateLimit: e.AUTH_RATE_LIMIT,
  };
}
```

`src/common/app-error.ts` :
```ts
import type { ApiErrorBody } from '@matreso/engine';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  body(): ApiErrorBody {
    return { statusCode: this.status, code: this.code, message: this.message };
  }
}

export const notFound = (what = 'Élément'): AppError => new AppError(404, 'NOT_FOUND', `${what} introuvable.`);
```

`src/common/error.filter.ts` :
```ts
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error.js';

@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppError) {
      res.status(exception.status).json(exception.body());
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = status === 404 ? 'Introuvable.' : status === 429 ? 'Trop de tentatives. Réessaie dans une minute.' : 'Requête invalide.';
      const code = status === 404 ? 'NOT_FOUND' : status === 429 ? 'TOO_MANY_REQUESTS' : 'HTTP_ERROR';
      res.status(status).json({ statusCode: status, code, message });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ statusCode: 500, code: 'INTERNAL', message: 'Une erreur est survenue. Réessaie dans un instant.' });
  }
}
```

`src/common/zod.pipe.ts` :
```ts
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from './app-error.js';

/** Valide le corps avec un schéma zod. Les messages zod personnalisés (en français) sont renvoyés tels quels. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issue = result.error.issues[0];
    const custom = issue?.message && !/^(Invalid|Expected|Required|Too )/i.test(issue.message);
    throw new AppError(400, 'VALIDATION', custom ? issue.message : 'Données invalides.');
  }
}
```

`src/common/schemas.ts` :
```ts
import { isISODate } from '@matreso/engine';
import { z } from 'zod';

export const isoDate = z.string().refine(isISODate, 'Date invalide.');
/** Montant positif en centimes (≤ 10 millions d'euros) */
export const cents = z.number().int('Montant invalide.').min(0, 'Montant invalide.').max(1_000_000_000, 'Montant trop élevé.');
/** Montant signé en centimes (solde) */
export const signedCents = z.number().int('Montant invalide.').min(-1_000_000_000).max(1_000_000_000);
export const uuid = z.string().uuid('Identifiant invalide.');
```

`src/common/json-only.middleware.ts` :
```ts
import type { NextFunction, Request, Response } from 'express';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Protection CSRF : les mutations sur /api exigent un Content-Type JSON (impossible en simple formulaire cross-site). */
export function jsonOnlyMutations(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] ?? '';
  if (MUTATIONS.has(req.method) && req.path.startsWith('/api/') && !contentType.startsWith('application/json')) {
    res.status(415).json({ statusCode: 415, code: 'JSON_REQUIRED', message: 'Requête invalide.' });
    return;
  }
  next();
}
```

- [ ] **Step 4: Schéma Drizzle et module base**

`src/db/schema.ts` :
```ts
import { BILLING_MODES, CHARGE_FREQUENCIES, CLIENT_COLORS, LEAVE_SCOPES, LEGAL_STATUSES, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { sql } from 'drizzle-orm';
import { bigint, boolean, customType, date, index, integer, pgEnum, pgTable, smallint, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const legalStatusEnum = pgEnum('legal_status', LEGAL_STATUSES);
export const paymentTermEnum = pgEnum('payment_term', PAYMENT_TERM_KEYS);
export const billingModeEnum = pgEnum('billing_mode', BILLING_MODES);
export const clientColorEnum = pgEnum('client_color', CLIENT_COLORS);
export const leaveScopeEnum = pgEnum('leave_scope', LEAVE_SCOPES);
export const chargeFrequencyEnum = pgEnum('charge_frequency', CHARGE_FREQUENCIES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const userRef = () => uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  companyName: text('company_name'),
  legalStatus: legalStatusEnum('legal_status').notNull().default('SASU'),
  netPayMonthly: integer('net_pay_monthly').notNull().default(0),
  microVersementLiberatoire: boolean('micro_versement_liberatoire').notNull().default(false),
  microIncomeTaxProvisionPct: integer('micro_income_tax_provision_pct').notNull().default(10),
  microProExpensesMonthly: integer('micro_pro_expenses_monthly').notNull().default(18_000),
  includeProspects: boolean('include_prospects').notNull().default(false),
  alertRedMonth: boolean('alert_red_month').notNull().default(true),
  alertLatePayment: boolean('alert_late_payment').notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // SHA-256 hex du jeton
  userId: userRef(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const passkeys = pgTable('passkeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: bytea('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).notNull().default(0),
  transports: text('transports').array().notNull().default(sql`'{}'::text[]`),
  deviceName: text('device_name'),
  createdAt: createdAt(),
});

export const balanceSnapshots = pgTable('balance_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  date: date('date', { mode: 'string' }).notNull(),
  amount: integer('amount').notNull(),
  createdAt: createdAt(),
}, (t) => [index('balance_user_date_idx').on(t.userId, t.date)]);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  name: text('name').notNull(),
  subtitle: text('subtitle'),
  color: clientColorEnum('color').notNull(),
  billingMode: billingModeEnum('billing_mode').notNull(),
  weekdays: smallint('weekdays').array().notNull().default(sql`'{}'::smallint[]`),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  paymentTerm: paymentTermEnum('payment_term').notNull(),
  averageDelayDays: integer('average_delay_days').notNull().default(0),
  isProspect: boolean('is_prospect').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  position: integer('position').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index('clients_user_idx').on(t.userId)]);

export const rates = pgTable('rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  validFrom: date('valid_from', { mode: 'string' }).notNull(),
  amount: integer('amount').notNull(),
}, (t) => [unique('rates_client_valid_from_uq').on(t.clientId, t.validFrom)]);

export const leaves = pgTable('leaves', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  date: date('date', { mode: 'string' }).notNull(),
  scope: leaveScopeEnum('scope').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
}, (t) => [unique('leaves_user_date_client_uq').on(t.userId, t.date, t.clientId).nullsNotDistinct()]);

export const charges = pgTable('charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  name: text('name').notNull(),
  amount: integer('amount').notNull(),
  frequency: chargeFrequencyEnum('frequency').notNull(),
  month: integer('month'),
  category: text('category'),
  createdAt: createdAt(),
}, (t) => [index('charges_user_idx').on(t.userId)]);
```

`src/db/db.module.ts` :
```ts
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { type AppConfig, CONFIG } from '../config.js';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [CONFIG], useFactory: (config: AppConfig) => new pg.Pool({ connectionString: config.databaseUrl, max: 10 }) },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: pg.Pool): Db => drizzle({ client: pool, schema }) },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
```

`src/db/migrate.ts` :
```ts
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './db.module.js';

/** apps/api/drizzle, que l'on parte de src/db (tests) ou de dist/db (build). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
```

Générer la première migration :
```bash
npm run build -w @matreso/engine
npm run db:generate -w @matreso/api
```
Expected : `apps/api/drizzle/0000_*.sql` créé, avec les 8 tables, les 6 enums et la contrainte `NULLS NOT DISTINCT` sur `leaves`.

- [ ] **Step 5: Module, bootstrap, health**

`src/health/health.controller.ts` :
```ts
import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async health(): Promise<{ status: 'ok'; db: 'ok' }> {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'ok' };
  }
}
```

`src/app.module.ts` :
```ts
import { type DynamicModule, Module } from '@nestjs/common';
import { type AppConfig, CONFIG } from './config.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [DbModule],
      controllers: [HealthController],
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
```

`src/bootstrap.ts` :
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppErrorFilter } from './common/error.filter.js';
import { jsonOnlyMutations } from './common/json-only.middleware.js';
import { type AppConfig, loadConfig } from './config.js';
import { DB, type Db } from './db/db.module.js';
import { runMigrations } from './db/migrate.js';

export async function createApp(config: AppConfig = loadConfig()): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: config.nodeEnv === 'test' ? false : ['log', 'warn', 'error'],
  });
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser(config.sessionSecret));
  app.use(jsonOnlyMutations);
  app.useGlobalFilters(new AppErrorFilter());
  app.enableShutdownHooks();
  await runMigrations(app.get<Db>(DB));
  return app;
}
```

`src/main.ts` :
```ts
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApp(config);
await app.listen(config.port);
console.log(`Ma Tréso API sur http://localhost:${config.port}/api`);
```

- [ ] **Step 6: Harnais e2e et premier test**

`test/helpers.ts` :
```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';
import { DB, type Db } from '../src/db/db.module.js';

export async function setupTestApp(overrides: Record<string, string> = {}): Promise<NestExpressApplication> {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'postgres://matreso:matreso@localhost:5432/matreso_test',
    SESSION_SECRET: 'test-secret-test-secret',
    SEED_DEMO: 'false',
    ...overrides,
  });
  const app = await createApp(config);
  await app.init();
  return app;
}

export async function resetDb(app: NestExpressApplication): Promise<void> {
  await app.get<Db>(DB).execute(sql`TRUNCATE users, sessions, passkeys, balance_snapshots, clients, rates, leaves, charges CASCADE`);
}

/** Agent supertest qui conserve les cookies. */
export const agentFor = (app: NestExpressApplication) => request.agent(app.getHttpServer());
```

`test/health.e2e.test.ts` :
```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers.js';

describe('health', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  afterAll(async () => { await app.close(); });

  it('reports ok with the database reachable', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('rejects non-JSON mutations (CSRF guard)', async () => {
    const res = await request(app.getHttpServer()).post('/api/health').type('form').send('a=1').expect(415);
    expect(res.body.code).toBe('JSON_REQUIRED');
  });

  it('answers unknown API routes with a JSON 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 7: Lancer les tests et le build**

Run : `npm run test -w @matreso/api && npm run build -w @matreso/api && npm run typecheck -w @matreso/api`
Expected : 3 tests PASS, `dist/main.js` généré, typecheck OK.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml docker .env.example .gitignore apps/api package.json package-lock.json
git commit -m "feat(api): socle NestJS, schéma Drizzle, migrations et healthcheck"
```

### Task 15: Auth mot de passe, sessions et guard

**Files:**
- Create : `apps/api/src/auth/{auth.module.ts,password.ts,session.service.ts,session.guard.ts,cookies.ts,auth.service.ts,auth.controller.ts}`, `apps/api/src/common/{public.decorator.ts,current-user.decorator.ts,rate-limit.guard.ts}`, `apps/api/src/data/mappers.ts`, `apps/api/test/auth.e2e.test.ts`
- Modify : `apps/api/src/app.module.ts` (importer `AuthModule`)

**Interfaces:**
- Consumes : `DB`, `users`, `sessions`, `CONFIG`, `AppError`, `ZodPipe` (Task 14), `UserProfileDto`, `MeDto` (engine).
- Produces : décorateur `@Public()`, décorateur de paramètre `@CurrentUser()` qui renvoie l'`userId: string`, `SessionService.create(userId)`, `SessionService.destroy(token)`, `SessionService.destroyAllForUser(userId)`, `setSessionCookie(res, token, config)`, `clearSessionCookie(res, config)`, `SESSION_COOKIE = 'mt_session'`, `hashPassword`, `verifyPassword`, `toProfileDto(row)`, `AuthService.me(userId): MeDto`, `RateLimitGuard`. Le `SessionGuard` global protège toutes les routes non `@Public()`.

- [ ] **Step 1: Écrire le test e2e**

`test/auth.e2e.test.ts` :
```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const creds = { email: 'Guillaume@Example.com', password: 'motdepasse1', firstName: 'Guillaume' };

describe('auth', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  it('registers, sets an httpOnly session cookie and returns the profile', async () => {
    const agent = agentFor(app);
    const res = await agent.post('/api/auth/register').send(creds).expect(201);
    expect(res.headers['set-cookie']?.[0]).toMatch(/mt_session=.+; .*HttpOnly/i);
    expect(res.body.user).toMatchObject({ email: 'guillaume@example.com', firstName: 'Guillaume', legalStatus: 'SASU', netPayMonthly: 0 });
    expect(res.body.hasPasskey).toBe(false);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('guillaume@example.com');
  });

  it('refuses a duplicate e-mail and weak inputs with French messages', async () => {
    await agentFor(app).post('/api/auth/register').send(creds).expect(201);
    const dup = await agentFor(app).post('/api/auth/register').send(creds).expect(409);
    expect(dup.body).toMatchObject({ code: 'EMAIL_TAKEN', message: 'Un compte existe déjà avec cet e-mail.' });
    const weak = await agentFor(app).post('/api/auth/register').send({ ...creds, email: 'x@y.fr', password: 'court' }).expect(400);
    expect(weak.body.message).toBe('Ton mot de passe doit faire au moins 8 caractères.');
  });

  it('logs in, logs out, and rejects bad credentials', async () => {
    await agentFor(app).post('/api/auth/register').send(creds).expect(201);
    const bad = await agentFor(app).post('/api/auth/login').send({ email: creds.email, password: 'mauvais-mdp' }).expect(401);
    expect(bad.body.message).toBe('E-mail ou mot de passe incorrect.');
    const agent = agentFor(app);
    await agent.post('/api/auth/login').send({ email: 'guillaume@example.com', password: creds.password }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').send({}).expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('protects routes without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Connecte-toi pour continuer.' });
  });

  it('changes the password with the current one', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send(creds).expect(201);
    await agent.patch('/api/auth/password').send({ currentPassword: 'faux-faux', newPassword: 'nouveau-mdp' }).expect(401);
    await agent.patch('/api/auth/password').send({ currentPassword: creds.password, newPassword: 'nouveau-mdp' }).expect(204);
    await agentFor(app).post('/api/auth/login').send({ email: creds.email, password: 'nouveau-mdp' }).expect(200);
  });

  it('rate-limits login attempts', async () => {
    const agent = agentFor(app);
    for (let i = 0; i < 10; i++) await agent.post('/api/auth/login').send({ email: 'a@b.fr', password: 'xxxxxxxx' });
    const res = await agent.post('/api/auth/login').send({ email: 'a@b.fr', password: 'xxxxxxxx' }).expect(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test -w @matreso/api -- auth`
Expected : FAIL (404 sur `/api/auth/register`).

- [ ] **Step 3: Implémenter les briques communes**

```bash
npm i -w @matreso/api @node-rs/argon2
```

`src/common/public.decorator.ts` :
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
```

`src/common/current-user.decorator.ts` :
```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthedRequest extends Request {
  userId?: string;
  sessionToken?: string;
}

/** Identifiant de l'utilisateur connecté (posé par SessionGuard). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.userId!;
});
```

`src/common/rate-limit.guard.ts` :
```ts
import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { type AppConfig, CONFIG } from '../config.js';

const WINDOW_MS = 60_000;

/** `authRateLimit` requêtes par minute et par IP sur les routes décorées. En mémoire : suffisant pour une instance unique. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= this.config.authRateLimit) throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
```

`src/auth/password.ts` :
```ts
import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (password: string): Promise<string> => hash(password);

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
```

`src/auth/cookies.ts` :
```ts
import type { Response } from 'express';
import type { AppConfig } from '../config.js';

export const SESSION_COOKIE = 'mt_session';
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });
}
```

`src/auth/session.service.ts` :
```ts
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
```

`src/auth/session.guard.ts` :
```ts
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/app-error.js';
import type { AuthedRequest } from '../common/current-user.decorator.js';
import { IS_PUBLIC } from '../common/public.decorator.js';
import { SESSION_COOKIE } from './cookies.js';
import { SessionService } from './session.service.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const userId = typeof token === 'string' ? await this.sessions.validate(token) : null;
    if (!userId) throw new AppError(401, 'UNAUTHENTICATED', 'Connecte-toi pour continuer.');
    req.userId = userId;
    req.sessionToken = token as string;
    return true;
  }
}
```

Le `HealthController` doit rester public : ajouter `@Public()` sur sa classe.

`src/data/mappers.ts` (premier mapper, complété dans les tâches suivantes) :
```ts
import type { UserProfileDto } from '@matreso/engine';
import type { users } from '../db/schema.js';

export function toProfileDto(u: typeof users.$inferSelect): UserProfileDto {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    companyName: u.companyName,
    legalStatus: u.legalStatus,
    netPayMonthly: u.netPayMonthly,
    microVersementLiberatoire: u.microVersementLiberatoire,
    microIncomeTaxProvisionPct: u.microIncomeTaxProvisionPct,
    microProExpensesMonthly: u.microProExpensesMonthly,
    includeProspects: u.includeProspects,
    alertRedMonth: u.alertRedMonth,
    alertLatePayment: u.alertLatePayment,
  };
}
```

- [ ] **Step 4: Implémenter le service, le contrôleur et le module**

`src/auth/auth.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import type { MeDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { DB, type Db } from '../db/db.module.js';
import { passkeys, users } from '../db/schema.js';
import { toProfileDto } from '../data/mappers.js';
import { hashPassword, verifyPassword } from './password.js';

const INVALID = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou mot de passe incorrect.');

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async register(input: { email: string; password: string; firstName: string }): Promise<string> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail.');
    const [user] = await this.db
      .insert(users)
      .values({ email: input.email, passwordHash: await hashPassword(input.password), firstName: input.firstName })
      .returning({ id: users.id });
    return user!.id;
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
```

`src/auth/auth.controller.ts` :
```ts
import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { MeDto } from '@matreso/engine';
import type { Response } from 'express';
import { z } from 'zod';
import { type AuthedRequest, CurrentUser } from '../common/current-user.decorator.js';
import { Public } from '../common/public.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type AppConfig, CONFIG } from '../config.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, setSessionCookie } from './cookies.js';
import { SessionService } from './session.service.js';

const email = z.string().trim().toLowerCase().email('E-mail invalide.');
const password = z.string().min(8, 'Ton mot de passe doit faire au moins 8 caractères.').max(200, 'Mot de passe trop long.');
const registerSchema = z.object({ email, password, firstName: z.string().trim().min(1, 'Indique ton prénom.').max(60, 'Prénom trop long.') });
const loginSchema = z.object({ email, password: z.string().min(1, 'Indique ton mot de passe.') });
const passwordSchema = z.object({ currentPassword: z.string().min(1, 'Indique ton mot de passe actuel.'), newPassword: password });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('register')
  async register(@Body(new ZodPipe(registerSchema)) body: z.infer<typeof registerSchema>, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const userId = await this.auth.register(body);
    setSessionCookie(res, await this.sessions.create(userId), this.config);
    return this.auth.me(userId);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const userId = await this.auth.login(body.email, body.password);
    setSessionCookie(res, await this.sessions.create(userId), this.config);
    return this.auth.me(userId);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.sessionToken) await this.sessions.destroy(req.sessionToken);
    clearSessionCookie(res, this.config);
  }

  @Get('me')
  me(@CurrentUser() userId: string): Promise<MeDto> {
    return this.auth.me(userId);
  }

  @Patch('password')
  @HttpCode(204)
  async changePassword(@CurrentUser() userId: string, @Body(new ZodPipe(passwordSchema)) body: z.infer<typeof passwordSchema>): Promise<void> {
    await this.auth.changePassword(userId, body.currentPassword, body.newPassword);
  }
}
```

`src/auth/auth.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, RateLimitGuard, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
```

Dans `app.module.ts`, ajouter `AuthModule` à `imports`.

- [ ] **Step 5: Vérifier, puis commit**

Run : `npm run test -w @matreso/api`
Expected : tous les tests PASS (health + auth).
```bash
git add apps/api
git commit -m "feat(api): inscription, connexion, sessions en cookie httpOnly et limitation de débit"
```

### Task 16: Passkeys (WebAuthn)

**Files:**
- Create : `apps/api/src/auth/{passkey.service.ts,passkey.controller.ts}`, `apps/api/test/passkey.e2e.test.ts`
- Modify : `apps/api/src/auth/auth.module.ts` (déclarer le contrôleur et le service)

**Interfaces:**
- Consumes : `passkeys`, `users`, `SessionService.create`, `setSessionCookie`, `AuthService.me`, `CONFIG.webauthn`.
- Produces : routes `POST /api/auth/passkeys/register/options`, `POST /api/auth/passkeys/register/verify` (body = `RegistrationResponseJSON`, renvoie `MeDto`), `POST /api/auth/passkeys/login/options` (public), `POST /api/auth/passkeys/login/verify` (public, body = `AuthenticationResponseJSON`, pose la session et renvoie `MeDto`), `DELETE /api/auth/passkeys` (204). Cookie signé `mt_webauthn` (5 min) contenant `{ challenge, userId? }`.

- [ ] **Step 1: Écrire le test e2e**

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('passkeys', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const register = async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email: 'pk@example.com', password: 'motdepasse1', firstName: 'Pk' }).expect(201);
    return agent;
  };

  it('issues registration options for the logged-in user, with a challenge cookie', async () => {
    const agent = await register();
    const res = await agent.post('/api/auth/passkeys/register/options').send({}).expect(201);
    expect(res.body.challenge).toEqual(expect.any(String));
    expect(res.body.rp).toMatchObject({ id: 'localhost', name: 'Ma Tréso' });
    expect(res.body.authenticatorSelection.residentKey).toBe('required');
    expect(res.headers['set-cookie']?.[0]).toMatch(/mt_webauthn=/);
  });

  it('rejects an invalid registration response', async () => {
    const agent = await register();
    await agent.post('/api/auth/passkeys/register/options').send({}).expect(201);
    const res = await agent.post('/api/auth/passkeys/register/verify').send({ id: 'x', rawId: 'x', type: 'public-key', response: {} }).expect(400);
    expect(res.body.code).toBe('PASSKEY_INVALID');
  });

  it('issues public login options and rejects an unknown credential', async () => {
    const agent = agentFor(app);
    const opts = await agent.post('/api/auth/passkeys/login/options').send({}).expect(201);
    expect(opts.body.challenge).toEqual(expect.any(String));
    const res = await agent.post('/api/auth/passkeys/login/verify').send({ id: 'unknown', rawId: 'unknown', type: 'public-key', response: {} }).expect(401);
    expect(res.body.code).toBe('PASSKEY_UNKNOWN');
  });

  it('refuses verification without a pending challenge', async () => {
    const res = await agentFor(app).post('/api/auth/passkeys/login/verify').send({ id: 'x', rawId: 'x', type: 'public-key', response: {} }).expect(400);
    expect(res.body.code).toBe('PASSKEY_EXPIRED');
  });

  it('disables Face ID by deleting the passkeys', async () => {
    const agent = await register();
    await agent.delete('/api/auth/passkeys').send({}).expect(204);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.hasPasskey).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test -w @matreso/api -- passkey`
Expected : FAIL (404).

- [ ] **Step 3: Implémenter**

```bash
npm i -w @matreso/api @simplewebauthn/server
```

`src/auth/passkey.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  type AuthenticationResponseJSON, generateAuthenticationOptions, generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON, verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { type AppConfig, CONFIG } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { passkeys, users } from '../db/schema.js';

type Transport = NonNullable<RegistrationResponseJSON['response']['transports']>[number];
const INVALID = () => new AppError(400, 'PASSKEY_INVALID', 'Impossible d’activer Face ID sur cet appareil.');

@Injectable()
export class PasskeyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async registrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Connecte-toi pour continuer.');
    const existing = await this.db.select().from(passkeys).where(eq(passkeys.userId, userId));
    return generateRegistrationOptions({
      rpName: this.config.webauthn.rpName,
      rpID: this.config.webauthn.rpId,
      userName: user.email,
      userDisplayName: user.firstName,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports as Transport[] })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
  }

  async verifyRegistration(userId: string, response: RegistrationResponseJSON, expectedChallenge: string): Promise<void> {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.webauthn.origin,
        expectedRPID: this.config.webauthn.rpId,
        requireUserVerification: false,
      });
    } catch {
      throw INVALID();
    }
    if (!verification.verified || !verification.registrationInfo) throw INVALID();
    const { credential } = verification.registrationInfo;
    await this.db.insert(passkeys).values({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
    });
  }

  authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({ rpID: this.config.webauthn.rpId, userVerification: 'preferred', allowCredentials: [] });
  }

  /** Renvoie l'userId propriétaire de la passkey. */
  async verifyAuthentication(response: AuthenticationResponseJSON, expectedChallenge: string): Promise<string> {
    const [row] = await this.db.select().from(passkeys).where(eq(passkeys.credentialId, response.id));
    if (!row) throw new AppError(401, 'PASSKEY_UNKNOWN', 'Cette passkey n’est pas reconnue.');
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.webauthn.origin,
        expectedRPID: this.config.webauthn.rpId,
        credential: { id: row.credentialId, publicKey: new Uint8Array(row.publicKey), counter: row.counter, transports: row.transports as Transport[] },
        requireUserVerification: false,
      });
    } catch {
      throw new AppError(401, 'PASSKEY_INVALID', 'Connexion par Face ID refusée.');
    }
    if (!verification.verified) throw new AppError(401, 'PASSKEY_INVALID', 'Connexion par Face ID refusée.');
    await this.db.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, row.id));
    return row.userId;
  }

  async deleteAll(userId: string): Promise<void> {
    await this.db.delete(passkeys).where(eq(passkeys.userId, userId));
  }
}
```

`src/auth/passkey.controller.ts` :
```ts
import { Body, Controller, Delete, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { MeDto } from '@matreso/engine';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Request, Response } from 'express';
import { AppError } from '../common/app-error.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Public } from '../common/public.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { type AppConfig, CONFIG } from '../config.js';
import { AuthService } from './auth.service.js';
import { setSessionCookie } from './cookies.js';
import { PasskeyService } from './passkey.service.js';
import { SessionService } from './session.service.js';

const CHALLENGE_COOKIE = 'mt_webauthn';

@Controller('auth/passkeys')
export class PasskeyController {
  constructor(
    private readonly passkeys: PasskeyService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private setChallenge(res: Response, challenge: string, userId?: string): void {
    res.cookie(CHALLENGE_COOKIE, JSON.stringify({ challenge, userId }), {
      httpOnly: true, sameSite: 'strict', secure: this.config.cookieSecure, signed: true, maxAge: 5 * 60_000, path: '/api/auth/passkeys',
    });
  }

  private takeChallenge(req: Request, res: Response): { challenge: string; userId?: string } {
    const raw: unknown = req.signedCookies?.[CHALLENGE_COOKIE];
    res.clearCookie(CHALLENGE_COOKIE, { path: '/api/auth/passkeys' });
    if (typeof raw !== 'string') throw new AppError(400, 'PASSKEY_EXPIRED', 'La demande a expiré. Réessaie.');
    return JSON.parse(raw) as { challenge: string; userId?: string };
  }

  @Post('register/options')
  async registerOptions(@CurrentUser() userId: string, @Res({ passthrough: true }) res: Response) {
    const options = await this.passkeys.registrationOptions(userId);
    this.setChallenge(res, options.challenge, userId);
    return options;
  }

  @Post('register/verify')
  async registerVerify(@CurrentUser() userId: string, @Body() body: RegistrationResponseJSON, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const pending = this.takeChallenge(req, res);
    if (pending.userId !== userId) throw new AppError(400, 'PASSKEY_EXPIRED', 'La demande a expiré. Réessaie.');
    await this.passkeys.verifyRegistration(userId, body, pending.challenge);
    return this.auth.me(userId);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login/options')
  async loginOptions(@Res({ passthrough: true }) res: Response) {
    const options = await this.passkeys.authenticationOptions();
    this.setChallenge(res, options.challenge);
    return options;
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login/verify')
  @HttpCode(200)
  async loginVerify(@Body() body: AuthenticationResponseJSON, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const pending = this.takeChallenge(req, res);
    const userId = await this.passkeys.verifyAuthentication(body, pending.challenge);
    setSessionCookie(res, await this.sessions.create(userId), this.config);
    return this.auth.me(userId);
  }

  @Delete()
  @HttpCode(204)
  async disable(@CurrentUser() userId: string): Promise<void> {
    await this.passkeys.deleteAll(userId);
  }
}
```

Déclarer `PasskeyController` dans `controllers` et `PasskeyService` dans `providers` de `AuthModule`.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test -w @matreso/api`
Expected : PASS.
```bash
git add apps/api package-lock.json
git commit -m "feat(api): passkeys WebAuthn (activation, connexion, désactivation)"
```

### Task 17: État complet, profil et solde

**Files:**
- Create : `apps/api/src/data/{data.module.ts,state.service.ts,state.controller.ts,profile.controller.ts,balance.controller.ts}`, `apps/api/test/state.e2e.test.ts`
- Modify : `apps/api/src/data/mappers.ts` (ajouter `toClient`, `toLeaveDto`, `toChargeDto`, `toBalanceDto`), `apps/api/src/app.module.ts` (importer `DataModule`)

**Interfaces:**
- Consumes : tables, `AuthService.me`, `ZodPipe`, `isoDate`, `cents`, `signedCents`, `localToday` (engine).
- Produces : `StateService.getState(userId): Promise<StateDto>`, `toClient(row, rates)`, `toLeaveDto(row)`, `toChargeDto(row)`, `toBalanceDto(row)`, routes `GET /api/state`, `PATCH /api/profile` (renvoie `UserProfileDto`), `POST /api/balance` (renvoie `BalanceSnapshotDto`).

- [ ] **Step 1: Écrire le test e2e**

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('state, profile, balance', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async (email = 'a@example.com') => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email, password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('returns an empty state for a new account', async () => {
    const res = await (await login()).get('/api/state').expect(200);
    expect(res.body).toMatchObject({ balance: { latest: null, history: [] }, clients: [], leaves: [], charges: [], hasPasskey: false });
    expect(res.body.profile.email).toBe('a@example.com');
  });

  it('patches the profile and validates ranges', async () => {
    const agent = await login();
    const res = await agent.patch('/api/profile').send({ legalStatus: 'EURL_IS', netPayMonthly: 400_000, includeProspects: true }).expect(200);
    expect(res.body).toMatchObject({ legalStatus: 'EURL_IS', netPayMonthly: 400_000, includeProspects: true });
    await agent.patch('/api/profile').send({ microIncomeTaxProvisionPct: 31 }).expect(400);
    await agent.patch('/api/profile').send({ legalStatus: 'SCI' }).expect(400);
  });

  it('records balance snapshots, latest first', async () => {
    const agent = await login();
    await agent.post('/api/balance').send({ amount: 4_832_000, date: '2026-09-22' }).expect(201);
    const second = await agent.post('/api/balance').send({ amount: -12_000, date: '2026-10-04' }).expect(201);
    expect(second.body).toMatchObject({ date: '2026-10-04', amount: -12_000 });
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.balance.latest).toMatchObject({ amount: -12_000 });
    expect(state.body.balance.history).toHaveLength(2);
  });

  it('isolates users', async () => {
    const a = await login('a@example.com');
    await a.post('/api/balance').send({ amount: 100 }).expect(201);
    const b = await login('b@example.com');
    const state = await b.get('/api/state').expect(200);
    expect(state.body.balance.latest).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test -w @matreso/api -- state`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

Compléter `src/data/mappers.ts` :
```ts
import type { BalanceSnapshotDto, Client, LeaveDto, StateDto } from '@matreso/engine';
import type { balanceSnapshots, charges, clients, leaves, rates } from '../db/schema.js';

export function toClient(c: typeof clients.$inferSelect, clientRates: Array<typeof rates.$inferSelect>): Client {
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    color: c.color,
    billingMode: c.billingMode,
    weekdays: [...c.weekdays].sort((a, b) => a - b),
    startDate: c.startDate,
    endDate: c.endDate,
    paymentTerm: c.paymentTerm,
    averageDelayDays: c.averageDelayDays,
    isProspect: c.isProspect,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    rates: clientRates
      .filter((r) => r.clientId === c.id)
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
      .map((r) => ({ id: r.id, validFrom: r.validFrom, amount: r.amount })),
  };
}

export const toLeaveDto = (l: typeof leaves.$inferSelect): LeaveDto => ({ id: l.id, date: l.date, scope: l.scope, clientId: l.clientId });

export const toChargeDto = (c: typeof charges.$inferSelect): StateDto['charges'][number] => ({
  id: c.id, name: c.name, amount: c.amount, frequency: c.frequency, month: c.month, category: c.category,
});

export const toBalanceDto = (b: typeof balanceSnapshots.$inferSelect): BalanceSnapshotDto => ({ id: b.id, date: b.date, amount: b.amount });
```

`src/data/state.service.ts` :
```ts
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
```

`src/data/state.controller.ts` :
```ts
import { Controller, Get } from '@nestjs/common';
import type { StateDto } from '@matreso/engine';
import { CurrentUser } from '../common/current-user.decorator.js';
import { StateService } from './state.service.js';

@Controller('state')
export class StateController {
  constructor(private readonly state: StateService) {}

  @Get()
  get(@CurrentUser() userId: string): Promise<StateDto> {
    return this.state.getState(userId);
  }
}
```

`src/data/profile.controller.ts` :
```ts
import { Body, Controller, Inject, Patch } from '@nestjs/common';
import { LEGAL_STATUSES, type UserProfileDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { cents } from '../common/schemas.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { toProfileDto } from './mappers.js';

export const profilePatchSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Indique ton prénom.').max(60),
    companyName: z.string().trim().max(120).nullable(),
    legalStatus: z.enum(LEGAL_STATUSES),
    netPayMonthly: cents.max(10_000_000, 'Rémunération trop élevée.'),
    microVersementLiberatoire: z.boolean(),
    microIncomeTaxProvisionPct: z.number().int().min(0, 'Entre 0 et 30 %.').max(30, 'Entre 0 et 30 %.'),
    microProExpensesMonthly: cents,
    includeProspects: z.boolean(),
    alertRedMonth: z.boolean(),
    alertLatePayment: z.boolean(),
  })
  .partial()
  .strict();

@Controller('profile')
export class ProfileController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Patch()
  async patch(@CurrentUser() userId: string, @Body(new ZodPipe(profilePatchSchema)) body: z.infer<typeof profilePatchSchema>): Promise<UserProfileDto> {
    const [row] = Object.keys(body).length
      ? await this.db.update(users).set(body).where(eq(users.id, userId)).returning()
      : await this.db.select().from(users).where(eq(users.id, userId));
    return toProfileDto(row!);
  }
}
```

`src/data/balance.controller.ts` :
```ts
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { type BalanceSnapshotDto, localToday } from '@matreso/engine';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { isoDate, signedCents } from '../common/schemas.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots } from '../db/schema.js';
import { toBalanceDto } from './mappers.js';

const balanceSchema = z.object({ amount: signedCents, date: isoDate.optional() }).strict();

@Controller('balance')
export class BalanceController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  async create(@CurrentUser() userId: string, @Body(new ZodPipe(balanceSchema)) body: z.infer<typeof balanceSchema>): Promise<BalanceSnapshotDto> {
    const [row] = await this.db.insert(balanceSnapshots).values({ userId, amount: body.amount, date: body.date ?? localToday() }).returning();
    return toBalanceDto(row!);
  }
}
```

`src/data/data.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BalanceController } from './balance.controller.js';
import { ProfileController } from './profile.controller.js';
import { StateController } from './state.controller.js';
import { StateService } from './state.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StateController, ProfileController, BalanceController],
  providers: [StateService],
  exports: [StateService],
})
export class DataModule {}
```

Ajouter `DataModule` aux `imports` de `AppModule`.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test -w @matreso/api`
Expected : PASS.
```bash
git add apps/api
git commit -m "feat(api): état complet, profil et instantanés de solde"
```

### Task 18: Clients et tarifs

**Files:**
- Create : `apps/api/src/data/{clients.service.ts,clients.controller.ts}`, `apps/api/test/clients.e2e.test.ts`
- Modify : `apps/api/src/data/data.module.ts` (déclarer)

**Interfaces:**
- Consumes : `clients`, `rates`, `toClient`, `ClientInput`, `ClientPatch`, `RateInput` (engine), énumérations de l'engine.
- Produces : `ClientsService.{create, update, remove, upsertRate, removeRate, getOwned}`, schémas `clientInputSchema`, `clientPatchSchema`, `rateSchema` (réutilisés par l'import en Task 20), routes `POST /api/clients` (201 → `Client`), `PATCH /api/clients/:id` (→ `Client`), `DELETE /api/clients/:id` (204), `POST /api/clients/:id/rates` (201 → `Client`), `DELETE /api/clients/:id/rates/:rateId` (→ `Client`).

- [ ] **Step 1: Écrire le test e2e**

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const clientA = {
  name: 'Client A', subtitle: 'Via ESN', color: 'indigo', billingMode: 'TJM', weekdays: [4, 0],
  startDate: '2026-10-01', endDate: '2027-05-31', paymentTerm: 'EOM_30', averageDelayDays: 0, isProspect: false,
  rate: { validFrom: '2026-10-01', amount: 65_000 },
};

describe('clients and rates', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async (email = 'a@example.com') => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email, password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('creates a client with its first rate, weekdays sorted', async () => {
    const res = await (await login()).post('/api/clients').send(clientA).expect(201);
    expect(res.body).toMatchObject({ name: 'Client A', weekdays: [0, 4], rates: [{ validFrom: '2026-10-01', amount: 65_000 }] });
  });

  it('refuses an end date before the start date (422)', async () => {
    const res = await (await login()).post('/api/clients').send({ ...clientA, endDate: '2026-09-01' }).expect(422);
    expect(res.body).toMatchObject({ code: 'END_BEFORE_START', message: 'La date de fin doit être après la date de début.' });
  });

  it('forces empty weekdays for a forfait and validates weekdays', async () => {
    const agent = await login();
    const res = await agent.post('/api/clients').send({ ...clientA, billingMode: 'FORFAIT', weekdays: [1, 2] }).expect(201);
    expect(res.body.weekdays).toEqual([]);
    await agent.post('/api/clients').send({ ...clientA, weekdays: [5] }).expect(400);
  });

  it('patches fields and re-checks dates against stored values', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    const res = await agent.patch(`/api/clients/${c.id}`).send({ averageDelayDays: 10, paymentTerm: 'NET_45' }).expect(200);
    expect(res.body).toMatchObject({ averageDelayDays: 10, paymentTerm: 'NET_45' });
    await agent.patch(`/api/clients/${c.id}`).send({ startDate: '2027-06-01' }).expect(422);
    await agent.patch(`/api/clients/${c.id}`).send({ averageDelayDays: 31 }).expect(400);
    const archived = await agent.patch(`/api/clients/${c.id}`).send({ archived: true }).expect(200);
    expect(archived.body.archivedAt).toEqual(expect.any(String));
  });

  it('upserts rates on the same date and forbids deleting the last one', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2027-01-01', amount: 70_000 }).expect(201);
    const replaced = await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2027-01-01', amount: 72_000 }).expect(201);
    expect(replaced.body.rates).toEqual([
      expect.objectContaining({ validFrom: '2026-10-01', amount: 65_000 }),
      expect.objectContaining({ validFrom: '2027-01-01', amount: 72_000 }),
    ]);
    const afterDelete = await agent.delete(`/api/clients/${c.id}/rates/${replaced.body.rates[1].id}`).send({}).expect(200);
    expect(afterDelete.body.rates).toHaveLength(1);
    const last = await agent.delete(`/api/clients/${c.id}/rates/${afterDelete.body.rates[0].id}`).send({}).expect(409);
    expect(last.body).toMatchObject({ code: 'LAST_RATE', message: 'Un client garde toujours au moins un tarif.' });
  });

  it('deletes a client, and hides other users’ clients (404)', async () => {
    const a = await login('a@example.com');
    const { body: c } = await a.post('/api/clients').send(clientA).expect(201);
    const b = await login('b@example.com');
    await b.patch(`/api/clients/${c.id}`).send({ name: 'Volé' }).expect(404);
    await b.delete(`/api/clients/${c.id}`).send({}).expect(404);
    await a.delete(`/api/clients/${c.id}`).send({}).expect(204);
    const state = await a.get('/api/state').expect(200);
    expect(state.body.clients).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test -w @matreso/api -- clients`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`src/data/clients.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { BILLING_MODES, type Client, CLIENT_COLORS, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { AppError, notFound } from '../common/app-error.js';
import { cents, isoDate } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { clients, rates } from '../db/schema.js';
import { toClient } from './mappers.js';

export const rateSchema = z.object({ validFrom: isoDate, amount: cents.refine((v) => v > 0, 'Le tarif doit être supérieur à 0 €.') }).strict();

const clientFields = {
  name: z.string().trim().min(1, 'Donne un nom à ce client.').max(80, 'Nom trop long.'),
  subtitle: z.string().trim().max(80).nullable(),
  color: z.enum(CLIENT_COLORS),
  billingMode: z.enum(BILLING_MODES),
  weekdays: z.array(z.number().int().min(0).max(4)).max(5).transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  paymentTerm: z.enum(PAYMENT_TERM_KEYS),
  averageDelayDays: z.number().int().min(0, 'Entre 0 et 30 jours.').max(30, 'Entre 0 et 30 jours.'),
  isProspect: z.boolean(),
};

export const clientInputSchema = z.object({ ...clientFields, rate: rateSchema }).strict();
export const clientPatchSchema = z.object(clientFields).partial().extend({ archived: z.boolean().optional() }).strict();

const assertDates = (start: string, end: string | null): void => {
  if (end !== null && end < start) throw new AppError(422, 'END_BEFORE_START', 'La date de fin doit être après la date de début.');
};

@Injectable()
export class ClientsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getOwned(userId: string, id: string): Promise<Client> {
    if (!z.string().uuid().safeParse(id).success) throw notFound('Client');
    const [row] = await this.db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
    if (!row) throw notFound('Client');
    const clientRates = await this.db.select().from(rates).where(eq(rates.clientId, id));
    return toClient(row, clientRates);
  }

  async create(userId: string, input: z.infer<typeof clientInputSchema>): Promise<Client> {
    assertDates(input.startDate, input.endDate);
    const { rate, ...fields } = input;
    const id = await this.db.transaction(async (tx) => {
      const [{ value } = { value: null }] = await tx.select({ value: max(clients.position) }).from(clients).where(eq(clients.userId, userId));
      const [row] = await tx
        .insert(clients)
        .values({ ...fields, weekdays: fields.billingMode === 'FORFAIT' ? [] : fields.weekdays, userId, position: (value ?? -1) + 1 })
        .returning({ id: clients.id });
      await tx.insert(rates).values({ clientId: row!.id, validFrom: rate.validFrom, amount: rate.amount });
      return row!.id;
    });
    return this.getOwned(userId, id);
  }

  async update(userId: string, id: string, patch: z.infer<typeof clientPatchSchema>): Promise<Client> {
    const current = await this.getOwned(userId, id);
    const { archived, ...fields } = patch;
    assertDates(fields.startDate ?? current.startDate, fields.endDate !== undefined ? fields.endDate : current.endDate);
    const billingMode = fields.billingMode ?? current.billingMode;
    const values: Partial<typeof clients.$inferInsert> = { ...fields };
    if (billingMode === 'FORFAIT') values.weekdays = [];
    if (archived !== undefined) values.archivedAt = archived ? new Date() : null;
    if (Object.keys(values).length) await this.db.update(clients).set(values).where(eq(clients.id, id));
    return this.getOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.db.delete(clients).where(eq(clients.id, id));
  }

  async upsertRate(userId: string, id: string, rate: z.infer<typeof rateSchema>): Promise<Client> {
    await this.getOwned(userId, id);
    await this.db
      .insert(rates)
      .values({ clientId: id, validFrom: rate.validFrom, amount: rate.amount })
      .onConflictDoUpdate({ target: [rates.clientId, rates.validFrom], set: { amount: rate.amount } });
    return this.getOwned(userId, id);
  }

  async removeRate(userId: string, id: string, rateId: string): Promise<Client> {
    const client = await this.getOwned(userId, id);
    if (!client.rates.some((r) => r.id === rateId)) throw notFound('Tarif');
    if (client.rates.length <= 1) throw new AppError(409, 'LAST_RATE', 'Un client garde toujours au moins un tarif.');
    await this.db.delete(rates).where(and(eq(rates.id, rateId), eq(rates.clientId, id)));
    return this.getOwned(userId, id);
  }
}
```

`src/data/clients.controller.ts` :
```ts
import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { Client } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { clientInputSchema, clientPatchSchema, ClientsService, rateSchema } from './clients.service.js';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(clientInputSchema)) body: z.infer<typeof clientInputSchema>): Promise<Client> {
    return this.clients.create(userId, body);
  }

  @Patch(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body(new ZodPipe(clientPatchSchema)) body: z.infer<typeof clientPatchSchema>): Promise<Client> {
    return this.clients.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
    return this.clients.remove(userId, id);
  }

  @Post(':id/rates')
  addRate(@CurrentUser() userId: string, @Param('id') id: string, @Body(new ZodPipe(rateSchema)) body: z.infer<typeof rateSchema>): Promise<Client> {
    return this.clients.upsertRate(userId, id, body);
  }

  @Delete(':id/rates/:rateId')
  removeRate(@CurrentUser() userId: string, @Param('id') id: string, @Param('rateId') rateId: string): Promise<Client> {
    return this.clients.removeRate(userId, id, rateId);
  }
}
```

Déclarer `ClientsController` et `ClientsService` dans `DataModule`, et exporter `ClientsService`.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test -w @matreso/api`
Expected : PASS.
```bash
git add apps/api
git commit -m "feat(api): clients et tarifs historisés (upsert, dernier tarif protégé)"
```

### Task 19: Congés et charges

**Files:**
- Create : `apps/api/src/data/{leaves.service.ts,leaves.controller.ts,charges.service.ts,charges.controller.ts}`, `apps/api/test/leaves-charges.e2e.test.ts`
- Modify : `apps/api/src/data/data.module.ts`

**Interfaces:**
- Consumes : `workingDaysBetween`, `isWorkingDay` (engine), `ClientsService.getOwned`, `toLeaveDto`, `toChargeDto`.
- Produces : routes `POST /api/leaves` (201 → `{ leaves: LeaveDto[]; created: number }`), `POST /api/leaves/delete` (200 → `{ deleted: number }`), `POST /api/charges` (201 → charge), `PATCH /api/charges/:id`, `DELETE /api/charges/:id` (204), schéma `chargeInputSchema` (réutilisé en Task 20).

- [ ] **Step 1: Écrire le test e2e**

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('leaves and charges', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email: 'a@example.com', password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('creates one leave per working day of a range, skipping weekends and holidays', async () => {
    const res = await (await login()).post('/api/leaves').send({ from: '2026-12-24', to: '2026-12-31', scope: 'ALL' }).expect(201);
    expect(res.body.created).toBe(5);
    expect(res.body.leaves.map((l: { date: string }) => l.date)).toEqual(['2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
  });

  it('refuses a single leave on a holiday or a weekend (acceptance criterion)', async () => {
    const agent = await login();
    const holiday = await agent.post('/api/leaves').send({ from: '2026-12-25', scope: 'ALL' }).expect(422);
    expect(holiday.body).toMatchObject({ code: 'NOT_A_WORKING_DAY', message: 'Ce jour n’est pas ouvré : impossible d’y poser un congé.' });
    await agent.post('/api/leaves').send({ from: '2026-12-26', scope: 'ALL' }).expect(422);
    const range = await agent.post('/api/leaves').send({ from: '2026-12-26', to: '2026-12-27', scope: 'ALL' }).expect(422);
    expect(range.body.message).toBe('Aucun jour ouvré sur cette période.');
  });

  it('ignores duplicates and validates scope, client and range', async () => {
    const agent = await login();
    await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'ALL' }).expect(201);
    const again = await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'ALL' }).expect(201);
    expect(again.body.created).toBe(0);
    expect(again.body.leaves).toHaveLength(1);
    await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'CLIENT' }).expect(400);
    await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'CLIENT', clientId: '6d0f7f5c-0000-4000-8000-000000000000' }).expect(404);
    await agent.post('/api/leaves').send({ from: '2026-12-31', to: '2026-12-24', scope: 'ALL' }).expect(400);
    await agent.post('/api/leaves').send({ from: '2026-01-01', to: '2027-06-01', scope: 'ALL' }).expect(400);
  });

  it('deletes leaves by id', async () => {
    const agent = await login();
    const { body } = await agent.post('/api/leaves').send({ from: '2026-12-28', to: '2026-12-29', scope: 'ALL' }).expect(201);
    const res = await agent.post('/api/leaves/delete').send({ ids: body.leaves.map((l: { id: string }) => l.id) }).expect(200);
    expect(res.body.deleted).toBe(2);
  });

  it('manages charges with month required for yearly ones', async () => {
    const agent = await login();
    const missing = await agent.post('/api/charges').send({ name: 'CFE', amount: 60_000, frequency: 'YEARLY', month: null, category: 'Impôts' }).expect(400);
    expect(missing.body.message).toBe('Choisis le mois du prélèvement.');
    const { body: c } = await agent.post('/api/charges').send({ name: 'CFE', amount: 60_000, frequency: 'YEARLY', month: 11, category: 'Impôts' }).expect(201);
    const patched = await agent.patch(`/api/charges/${c.id}`).send({ amount: 65_000 }).expect(200);
    expect(patched.body.amount).toBe(65_000);
    const monthly = await agent.patch(`/api/charges/${c.id}`).send({ frequency: 'MONTHLY' }).expect(200);
    expect(monthly.body.month).toBeNull();
    await agent.delete(`/api/charges/${c.id}`).send({}).expect(204);
    await agent.delete(`/api/charges/${c.id}`).send({}).expect(404);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test -w @matreso/api -- leaves`
Expected : FAIL.

- [ ] **Step 3: Implémenter les congés**

`src/data/leaves.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { diffDays, LEAVE_SCOPES, type LeaveDto, workingDaysBetween } from '@matreso/engine';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '../common/app-error.js';
import { isoDate, uuid } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { leaves } from '../db/schema.js';
import { ClientsService } from './clients.service.js';
import { toLeaveDto } from './mappers.js';

export const leavesInputSchema = z
  .object({ from: isoDate, to: isoDate.optional(), scope: z.enum(LEAVE_SCOPES), clientId: uuid.nullable().optional() })
  .strict()
  .refine((v) => v.scope === 'ALL' || !!v.clientId, 'Choisis chez quel client poser ce congé.')
  .refine((v) => !v.to || v.to >= v.from, 'La date de fin doit être après la date de début.')
  .refine((v) => !v.to || diffDays(v.from, v.to) <= 366, 'Pose tes congés sur une année au plus.');

export const deleteLeavesSchema = z.object({ ids: z.array(uuid).min(1).max(500) }).strict();

@Injectable()
export class LeavesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clients: ClientsService,
  ) {}

  async create(userId: string, input: z.infer<typeof leavesInputSchema>): Promise<{ leaves: LeaveDto[]; created: number }> {
    const clientId = input.scope === 'CLIENT' ? input.clientId! : null;
    if (clientId) await this.clients.getOwned(userId, clientId);
    const to = input.to ?? input.from;
    const dates = workingDaysBetween(input.from, to);
    if (dates.length === 0) {
      const message = input.to && input.to !== input.from ? 'Aucun jour ouvré sur cette période.' : 'Ce jour n’est pas ouvré : impossible d’y poser un congé.';
      throw new AppError(422, 'NOT_A_WORKING_DAY', message);
    }
    const inserted = await this.db
      .insert(leaves)
      .values(dates.map((date) => ({ userId, date, scope: input.scope, clientId })))
      .onConflictDoNothing()
      .returning({ id: leaves.id });
    const rows = await this.db
      .select()
      .from(leaves)
      .where(and(
        eq(leaves.userId, userId),
        eq(leaves.scope, input.scope),
        clientId ? eq(leaves.clientId, clientId) : isNull(leaves.clientId),
        gte(leaves.date, input.from),
        lte(leaves.date, to),
      ))
      .orderBy(leaves.date);
    return { leaves: rows.map(toLeaveDto), created: inserted.length };
  }

  async remove(userId: string, ids: string[]): Promise<{ deleted: number }> {
    const deleted = await this.db.delete(leaves).where(and(eq(leaves.userId, userId), inArray(leaves.id, ids))).returning({ id: leaves.id });
    return { deleted: deleted.length };
  }
}
```

`src/data/leaves.controller.ts` :
```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { LeaveDto } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { deleteLeavesSchema, leavesInputSchema, LeavesService } from './leaves.service.js';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(leavesInputSchema)) body: z.infer<typeof leavesInputSchema>): Promise<{ leaves: LeaveDto[]; created: number }> {
    return this.leaves.create(userId, body);
  }

  @Post('delete')
  @HttpCode(200)
  remove(@CurrentUser() userId: string, @Body(new ZodPipe(deleteLeavesSchema)) body: z.infer<typeof deleteLeavesSchema>): Promise<{ deleted: number }> {
    return this.leaves.remove(userId, body.ids);
  }
}
```

- [ ] **Step 4: Implémenter les charges**

`src/data/charges.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { CHARGE_FREQUENCIES, type StateDto } from '@matreso/engine';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AppError, notFound } from '../common/app-error.js';
import { cents } from '../common/schemas.js';
import { DB, type Db } from '../db/db.module.js';
import { charges } from '../db/schema.js';
import { toChargeDto } from './mappers.js';

type ChargeDto = StateDto['charges'][number];

const chargeFields = {
  name: z.string().trim().min(1, 'Donne un nom à cette charge.').max(80, 'Nom trop long.'),
  amount: cents,
  frequency: z.enum(CHARGE_FREQUENCIES),
  month: z.number().int().min(0).max(11).nullable(),
  category: z.string().trim().max(40).nullable(),
};

const checkMonth = (frequency: string, month: number | null): void => {
  if (frequency === 'YEARLY' && month === null) throw new AppError(400, 'VALIDATION', 'Choisis le mois du prélèvement.');
};

export const chargeInputSchema = z
  .object(chargeFields)
  .strict()
  .refine((v) => v.frequency !== 'YEARLY' || v.month !== null, 'Choisis le mois du prélèvement.');
export const chargePatchSchema = z.object(chargeFields).partial().strict();

@Injectable()
export class ChargesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string, input: z.infer<typeof chargeInputSchema>): Promise<ChargeDto> {
    const [row] = await this.db.insert(charges).values({ ...input, month: input.frequency === 'MONTHLY' ? null : input.month, userId }).returning();
    return toChargeDto(row!);
  }

  async update(userId: string, id: string, patch: z.infer<typeof chargePatchSchema>): Promise<ChargeDto> {
    const current = await this.owned(userId, id);
    const frequency = patch.frequency ?? current.frequency;
    const month = frequency === 'MONTHLY' ? null : patch.month !== undefined ? patch.month : current.month;
    checkMonth(frequency, month);
    const [row] = await this.db.update(charges).set({ ...patch, month }).where(eq(charges.id, id)).returning();
    return toChargeDto(row!);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.db.delete(charges).where(eq(charges.id, id));
  }

  private async owned(userId: string, id: string): Promise<typeof charges.$inferSelect> {
    if (!z.string().uuid().safeParse(id).success) throw notFound('Charge');
    const [row] = await this.db.select().from(charges).where(and(eq(charges.id, id), eq(charges.userId, userId)));
    if (!row) throw notFound('Charge');
    return row;
  }
}
```

`src/data/charges.controller.ts` :
```ts
import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { StateDto } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { chargeInputSchema, chargePatchSchema, ChargesService } from './charges.service.js';

type ChargeDto = StateDto['charges'][number];

@Controller('charges')
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(chargeInputSchema)) body: z.infer<typeof chargeInputSchema>): Promise<ChargeDto> {
    return this.charges.create(userId, body);
  }

  @Patch(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body(new ZodPipe(chargePatchSchema)) body: z.infer<typeof chargePatchSchema>): Promise<ChargeDto> {
    return this.charges.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
    return this.charges.remove(userId, id);
  }
}
```

Déclarer `LeavesController`, `LeavesService`, `ChargesController`, `ChargesService` dans `DataModule`.

- [ ] **Step 5: Vérifier, puis commit**

Run : `npm run test -w @matreso/api`
Expected : PASS.
```bash
git add apps/api
git commit -m "feat(api): congés jour par jour (jours ouvrés seulement) et charges"
```

### Task 20: Export/import, suppression du compte, seed de démo, service statique

**Files:**
- Create : `apps/api/src/data/{export.schema.ts,transfer.service.ts,transfer.controller.ts}`, `apps/api/src/seed/{seed.service.ts,seed.module.ts,cli.ts}`, `apps/api/test/transfer.e2e.test.ts`
- Modify : `packages/engine/src/seed.ts` (ajouter `demoExportFile()`), `packages/engine/test/results.test.ts` (test de `demoExportFile`), `apps/api/src/data/data.module.ts`, `apps/api/src/app.module.ts` (SeedModule, ServeStaticModule conditionnel)

**Interfaces:**
- Consumes : `ExportFileV1`, `demoData`, `DEMO_EMAIL` (engine), `StateService.getState`, `AuthService.checkPassword`, schémas des Tasks 17 à 19.
- Produces : `demoExportFile(): ExportFileV1` (engine), routes `GET /api/export` (→ `ExportFileV1`), `POST /api/import` (→ `StateDto`), `DELETE /api/account` (body `{ password }`, 204, cookie effacé), `TransferService.importFile(userId, file)`, `SeedService.ensureDemoUser()`, script `npm run seed -w @matreso/api`. Si `WEB_DIST` pointe vers un dossier existant, le front est servi avec repli SPA.

- [ ] **Step 1: Ajouter `demoExportFile` à l'engine (test d'abord)**

Ajouter à `packages/engine/test/results.test.ts`, dans `describe('demo seed')` (et l'importer depuis `../src/seed`) :
```ts
  it('builds an importable export file from the demo data', () => {
    const file = demoExportFile();
    expect(file).toMatchObject({ format: 'ma-treso', version: 1 });
    expect(file.clients.map((c) => c.ref)).toEqual(['client-a', 'client-b', 'client-c', 'client-d']);
    expect(file.leaves.find((l) => l.date === '2027-05-07')).toEqual({ date: '2027-05-07', scope: 'CLIENT', clientRef: 'client-a' });
    expect(file.balanceSnapshots).toEqual([{ date: '2026-10-04', amount: 4_832_000 }]);
    expect(file.profile).toMatchObject({ firstName: 'Guillaume', legalStatus: 'SASU', alertRedMonth: true });
  });
```
Run : `npm run test:watch -w @matreso/engine -- results` → FAIL.

Ajouter à `packages/engine/src/seed.ts` (en important `type { ExportFileV1 } from './contracts'`) :
```ts
export function demoExportFile(): ExportFileV1 {
  const d = demoData();
  return {
    format: 'ma-treso',
    version: 1,
    exportedAt: `${DEMO_TODAY}T00:00:00.000Z`,
    profile: { ...d.profile, alertRedMonth: true, alertLatePayment: true },
    balanceSnapshots: [{ date: d.balance.date, amount: d.balance.amount }],
    clients: d.clients.map(({ id, rates, archivedAt, ...c }) => ({
      ...c,
      ref: id,
      archived: archivedAt !== null,
      rates: rates.map((r) => ({ validFrom: r.validFrom, amount: r.amount })),
    })),
    leaves: d.leaves.map((l) => ({ date: l.date, scope: l.scope, clientRef: l.clientId })),
    charges: d.charges.map(({ id: _id, ...c }) => c),
  };
}
```
Run : `npm run test -w @matreso/engine && npm run build -w @matreso/engine` → PASS, couverture toujours ≥ 90 %.

- [ ] **Step 2: Écrire le test e2e**

`test/transfer.e2e.test.ts` :
```ts
import { demoExportFile } from '@matreso/engine';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SeedService } from '../src/seed/seed.service.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('export, import, account, seed', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email: 'a@example.com', password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('imports the demo file and exports it back identically (except exportedAt)', async () => {
    const agent = await login();
    const imported = await agent.post('/api/import').send(demoExportFile()).expect(201);
    expect(imported.body.clients).toHaveLength(4);
    expect(imported.body.leaves).toHaveLength(21);
    expect(imported.body.leaves.find((l: { date: string }) => l.date === '2027-05-07').clientId).toBe(imported.body.clients[0].id);
    const exported = await agent.get('/api/export').expect(200);
    const { exportedAt: _a, ...got } = exported.body;
    const { exportedAt: _b, ...want } = demoExportFile();
    expect(got.clients.map((c: { name: string }) => c.name)).toEqual(want.clients.map((c) => c.name));
    expect(got.leaves).toHaveLength(want.leaves.length);
    // insérées en lot : même created_at, ordre non garanti
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect([...got.charges].sort(byName)).toEqual([...want.charges].sort(byName));
    expect(got.profile).toEqual(want.profile);
  });

  it('replaces existing data on import', async () => {
    const agent = await login();
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    const second = await agent.post('/api/import').send(demoExportFile()).expect(201);
    expect(second.body.clients).toHaveLength(4);
    expect(second.body.charges).toHaveLength(8);
  });

  it('rejects a malformed file with a readable message and changes nothing', async () => {
    const agent = await login();
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    const bad = await agent.post('/api/import').send({ format: 'autre', version: 1 }).expect(400);
    expect(bad.body.message).toBe('Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
    const broken = { ...demoExportFile(), leaves: [{ date: '2027-05-07', scope: 'CLIENT', clientRef: 'inconnu' }] };
    await agent.post('/api/import').send(broken).expect(400);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
  });

  it('deletes the account with its password', async () => {
    const agent = await login();
    await agent.delete('/api/account').send({ password: 'mauvais' }).expect(401);
    await agent.delete('/api/account').send({ password: 'motdepasse1' }).expect(204);
    await agent.get('/api/auth/me').expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'motdepasse1' }).expect(401);
  });

  it('seeds the demo account once', async () => {
    const seed = app.get(SeedService);
    await seed.ensureDemoUser();
    await seed.ensureDemoUser();
    const agent = agentFor(app);
    await agent.post('/api/auth/login').send({ email: 'demo@matreso.fr', password: 'demo1234' }).expect(200);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
  });
});
```

Run : `npm run test -w @matreso/api -- transfer` → FAIL.

- [ ] **Step 3: Implémenter le schéma d'export et le service**

`src/data/export.schema.ts` :
```ts
import { BILLING_MODES, CLIENT_COLORS, LEAVE_SCOPES, LEGAL_STATUSES, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { z } from 'zod';
import { cents, isoDate, signedCents } from '../common/schemas.js';
import { chargeInputSchema } from './charges.service.js';

export const exportFileSchema = z
  .object({
    format: z.literal('ma-treso'),
    version: z.literal(1),
    exportedAt: z.string(),
    profile: z.object({
      firstName: z.string().trim().min(1).max(60),
      companyName: z.string().max(120).nullable(),
      legalStatus: z.enum(LEGAL_STATUSES),
      netPayMonthly: cents,
      microVersementLiberatoire: z.boolean(),
      microIncomeTaxProvisionPct: z.number().int().min(0).max(30),
      microProExpensesMonthly: cents,
      includeProspects: z.boolean(),
      alertRedMonth: z.boolean(),
      alertLatePayment: z.boolean(),
    }),
    balanceSnapshots: z.array(z.object({ date: isoDate, amount: signedCents })).max(10_000),
    clients: z
      .array(
        z.object({
          ref: z.string().min(1),
          name: z.string().trim().min(1).max(80),
          subtitle: z.string().max(80).nullable(),
          color: z.enum(CLIENT_COLORS),
          billingMode: z.enum(BILLING_MODES),
          weekdays: z.array(z.number().int().min(0).max(4)).max(5),
          startDate: isoDate,
          endDate: isoDate.nullable(),
          paymentTerm: z.enum(PAYMENT_TERM_KEYS),
          averageDelayDays: z.number().int().min(0).max(30),
          isProspect: z.boolean(),
          archived: z.boolean(),
          rates: z.array(z.object({ validFrom: isoDate, amount: cents })).min(1),
        }),
      )
      .max(200),
    leaves: z.array(z.object({ date: isoDate, scope: z.enum(LEAVE_SCOPES), clientRef: z.string().nullable() })).max(20_000),
    charges: z.array(chargeInputSchema).max(500),
  })
  .superRefine((file, ctx) => {
    const refs = new Set(file.clients.map((c) => c.ref));
    if (refs.size !== file.clients.length) ctx.addIssue({ code: 'custom', message: 'Clients en double.' });
    for (const c of file.clients) if (c.endDate !== null && c.endDate < c.startDate) ctx.addIssue({ code: 'custom', message: 'Dates de mission incohérentes.' });
    for (const l of file.leaves) {
      if (l.scope === 'CLIENT' && (!l.clientRef || !refs.has(l.clientRef))) ctx.addIssue({ code: 'custom', message: 'Congé rattaché à un client inconnu.' });
    }
  });

export type ExportFileInput = z.infer<typeof exportFileSchema>;
```

`src/data/transfer.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import type { ExportFileV1, StateDto } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { balanceSnapshots, charges, clients, leaves, rates, users } from '../db/schema.js';
import type { ExportFileInput } from './export.schema.js';
import { StateService } from './state.service.js';

@Injectable()
export class TransferService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly state: StateService,
  ) {}

  async exportFile(userId: string): Promise<ExportFileV1> {
    const s = await this.state.getState(userId);
    const { id: _id, email: _email, ...profile } = s.profile;
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
      if (file.leaves.length) {
        await tx
          .insert(leaves)
          .values(file.leaves.map((l) => ({ userId, date: l.date, scope: l.scope, clientId: l.scope === 'CLIENT' ? idByRef.get(l.clientRef!)! : null })))
          .onConflictDoNothing();
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
```

`src/data/transfer.controller.ts` :
```ts
import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import type { ExportFileV1, StateDto } from '@matreso/engine';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { clearSessionCookie } from '../auth/cookies.js';
import { AppError } from '../common/app-error.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type AppConfig, CONFIG } from '../config.js';
import { exportFileSchema } from './export.schema.js';
import { TransferService } from './transfer.service.js';

const deleteSchema = z.object({ password: z.string().min(1, 'Indique ton mot de passe.') }).strict();

@Controller()
export class TransferController {
  constructor(
    private readonly transfer: TransferService,
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('export')
  export(@CurrentUser() userId: string): Promise<ExportFileV1> {
    return this.transfer.exportFile(userId);
  }

  @Post('import')
  import(@CurrentUser() userId: string, @Body() body: unknown): Promise<StateDto> {
    const parsed = exportFileSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, 'INVALID_FILE', 'Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
    return this.transfer.importFile(userId, parsed.data);
  }

  @Delete('account')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() userId: string, @Body(new ZodPipe(deleteSchema)) body: z.infer<typeof deleteSchema>, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.checkPassword(userId, body.password);
    await this.transfer.deleteAccount(userId);
    clearSessionCookie(res, this.config);
  }
}
```

Le corps JSON d'une sauvegarde peut dépasser 100 ko (taille maximale par défaut d'Express) : dans `bootstrap.ts`, appeler `app.useBodyParser('json', { limit: '5mb' })` juste après `NestFactory.create`.

Déclarer `TransferController` et `TransferService` dans `DataModule`.

- [ ] **Step 4: Implémenter le seed**

`src/seed/seed.service.ts` :
```ts
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DEMO_EMAIL, demoExportFile } from '@matreso/engine';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import { type AppConfig, CONFIG } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { exportFileSchema } from '../data/export.schema.js';
import { TransferService } from '../data/transfer.service.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly transfer: TransferService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.seedDemo) await this.ensureDemoUser();
  }

  async ensureDemoUser(): Promise<void> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
    if (existing) return;
    const file = demoExportFile();
    const [user] = await this.db
      .insert(users)
      .values({ email: DEMO_EMAIL, passwordHash: await hashPassword(this.config.seedDemoPassword), firstName: file.profile.firstName })
      .returning({ id: users.id });
    await this.transfer.importFile(user!.id, exportFileSchema.parse(file));
    this.logger.log(`Compte de démo créé : ${DEMO_EMAIL}`);
  }
}
```

`src/seed/seed.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module.js';
import { SeedService } from './seed.service.js';

@Module({ imports: [DataModule], providers: [SeedService], exports: [SeedService] })
export class SeedModule {}
```

`src/seed/cli.ts` :
```ts
import { createApp } from '../bootstrap.js';
import { loadConfig } from '../config.js';
import { SeedService } from './seed.service.js';

const app = await createApp(loadConfig());
await app.init();
await app.get(SeedService).ensureDemoUser();
await app.close();
console.log('Seed terminé.');
```

Ajouter `SeedModule` aux imports d'`AppModule`, et exporter `TransferService` depuis `DataModule`.

- [ ] **Step 5: Service statique du front**

```bash
npm i -w @matreso/api @nestjs/serve-static@^12
```
Dans `AppModule.register(config)`, ajouter conditionnellement l'import (`existsSync` vient de `node:fs`) :
```ts
...(config.webDist && existsSync(config.webDist)
  ? [ServeStaticModule.forRoot({
      rootPath: config.webDist,
      exclude: ['/api/{*path}'],
      serveStaticOptions: {
        setHeaders: (res, path) => {
          if (/[\\/]_nuxt[\\/]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'no-cache');
        },
      },
    })]
  : []),
```
Si la syntaxe d'exclusion `'/api/{*path}'` est refusée par la version installée (Express 5 / path-to-regexp 8), utiliser la forme indiquée dans le README de `@nestjs/serve-static` et le noter dans le commit. Le test de cette partie se fait en Task 34 (image Docker).

- [ ] **Step 6: Vérifier, puis commit**

Run : `npm run test -w @matreso/api && npm run build -w @matreso/api`
Expected : tous les tests PASS, build OK.
```bash
git add packages/engine apps/api package-lock.json
git commit -m "feat(api): export/import JSON, suppression du compte, compte de démo et service du front"
```
