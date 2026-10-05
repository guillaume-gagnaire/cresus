import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1).default('pglite:./.data/pglite'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET doit faire au moins 16 caractères').optional(),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('Ma Tréso'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_URL: z.string().trim().optional(),
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
  /** URL publique du site, sans « / » final : émetteur OAuth, ressource MCP (`${publicUrl}/mcp`) et page de consentement. */
  publicUrl: string;
  cookieSecure: boolean;
  seedDemo: boolean;
  seedDemoPassword: string;
  webDist: string | null;
  /** Requêtes par minute et par IP sur /auth (10 par défaut, relevé pour les tests Playwright) */
  authRateLimit: number;
}

export const CONFIG = Symbol('CONFIG');

const DEFAULT_PUBLIC_URL = 'http://localhost:3000';

/** URL absolue http(s) sans requête ni fragment, normalisée sans « / » final. */
function parsePublicUrl(raw: string): string {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (!url || !/^https?:$/.test(url.protocol) || url.search || url.hash) {
    throw new Error('PUBLIC_URL doit être une URL http(s) absolue, sans paramètres ni ancre');
  }
  return url.href.replace(/\/+$/, '');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = envSchema.parse(env);
  if (e.NODE_ENV === 'production' && !e.SESSION_SECRET) throw new Error('SESSION_SECRET est obligatoire en production');
  // une valeur vide (`PUBLIC_URL=` dans un fichier .env) équivaut à une valeur absente
  if (e.NODE_ENV === 'production' && !e.PUBLIC_URL) throw new Error('PUBLIC_URL est obligatoire en production');
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET ?? 'dev-only-secret-dev-only-secret',
    webauthn: { rpId: e.WEBAUTHN_RP_ID, rpName: e.WEBAUTHN_RP_NAME, origin: e.WEBAUTHN_ORIGIN },
    publicUrl: parsePublicUrl(e.PUBLIC_URL || DEFAULT_PUBLIC_URL),
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : e.NODE_ENV === 'production',
    seedDemo: e.SEED_DEMO === 'true',
    seedDemoPassword: e.SEED_DEMO_PASSWORD,
    webDist: e.WEB_DIST ? e.WEB_DIST : null,
    authRateLimit: e.AUTH_RATE_LIMIT,
  };
}
