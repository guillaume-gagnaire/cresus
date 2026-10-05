import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().trim().optional(),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET doit faire au moins 16 caractères').optional(),
  WEBAUTHN_RP_ID: z.string().trim().optional(),
  WEBAUTHN_RP_NAME: z.string().default('Ma Tréso'),
  WEBAUTHN_ORIGIN: z.string().trim().optional(),
  PUBLIC_URL: z.string().trim().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  SEED_DEMO: z.enum(['true', 'false']).default('false'),
  SEED_DEMO_PASSWORD: z.string().min(8).default('demo1234'),
  WEB_DIST: z.string().optional(),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  OAUTH_RATE_LIMIT_MULTIPLIER: z.coerce.number().int().min(1).max(100_000).default(1),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  webauthn: { rpId: string; rpName: string; origin: string };
  /** Origine publique du site, sans « / » final ni chemin : émetteur OAuth, ressource MCP (`${publicUrl}/mcp`) et page de consentement. */
  publicUrl: string;
  cookieSecure: boolean;
  seedDemo: boolean;
  seedDemoPassword: string;
  webDist: string | null;
  /** Requêtes par minute et par IP sur /auth (10 par défaut, relevé pour les tests Playwright) */
  authRateLimit: number;
  /** Facteur appliqué aux limites par défaut du routeur OAuth du SDK (1 en production ; relevé pour les e2e Playwright et de production). */
  oauthRateLimitMultiplier: number;
}

export const CONFIG = Symbol('CONFIG');

const DEFAULT_PUBLIC_URL = 'http://localhost:3000';
const DEFAULT_DATABASE_URL = 'pglite:./.data/pglite';
const DEFAULT_WEBAUTHN_RP_ID = 'localhost';

/** Origine http(s) absolue (sans chemin, requête ni fragment), normalisée sans « / » final. */
function parsePublicUrl(raw: string): string {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (!url || !/^https?:$/.test(url.protocol) || url.search || url.hash) {
    throw new Error('PUBLIC_URL doit être une URL http(s) absolue, sans paramètres ni ancre');
  }
  // les routes OAuth (/authorize, /token…) et /mcp sont à la racine du domaine : un chemin ferait diverger l'émetteur et les routes
  if (url.pathname !== '/') throw new Error('PUBLIC_URL ne doit pas contenir de chemin (ex. https://cresus.gagnaire.dev)');
  return url.origin;
}

/**
 * Lit et valide l'environnement. En production, rien d'important n'a de valeur par défaut « de développement » :
 * SESSION_SECRET, PUBLIC_URL et DATABASE_URL sont obligatoires, et les identifiants WebAuthn (domaine et origine)
 * se déduisent de PUBLIC_URL tant qu'ils ne sont pas fournis (une valeur explicite l'emporte).
 * Une valeur vide (`PUBLIC_URL=` dans un fichier .env) équivaut à une valeur absente.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = envSchema.parse(env);
  const production = e.NODE_ENV === 'production';
  if (production && !e.SESSION_SECRET) throw new Error('SESSION_SECRET est obligatoire en production');
  if (production && !e.PUBLIC_URL) throw new Error('PUBLIC_URL est obligatoire en production');
  // sans cela, la production démarrerait sur une base PGlite locale (éphémère dans un conteneur) sans rien signaler
  if (production && !e.DATABASE_URL) throw new Error('DATABASE_URL est obligatoire en production (ex. postgres://utilisateur:motdepasse@hote:5432/base)');
  const publicUrl = parsePublicUrl(e.PUBLIC_URL || DEFAULT_PUBLIC_URL);
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL || DEFAULT_DATABASE_URL,
    sessionSecret: e.SESSION_SECRET ?? 'dev-only-secret-dev-only-secret',
    webauthn: {
      rpId: e.WEBAUTHN_RP_ID || (production ? new URL(publicUrl).hostname : DEFAULT_WEBAUTHN_RP_ID),
      rpName: e.WEBAUTHN_RP_NAME,
      origin: e.WEBAUTHN_ORIGIN || (production ? publicUrl : DEFAULT_PUBLIC_URL),
    },
    publicUrl,
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : production,
    seedDemo: e.SEED_DEMO === 'true',
    seedDemoPassword: e.SEED_DEMO_PASSWORD,
    webDist: e.WEB_DIST ? e.WEB_DIST : null,
    authRateLimit: e.AUTH_RATE_LIMIT,
    oauthRateLimitMultiplier: e.OAUTH_RATE_LIMIT_MULTIPLIER,
  };
}
