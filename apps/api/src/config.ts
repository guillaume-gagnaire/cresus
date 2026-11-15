import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().trim().optional(),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET doit faire au moins 16 caractères').optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  WEB_DIST: z.string().optional(),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(30),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  cookieSecure: boolean;
  webDist: string | null;
  /** Requêtes par minute et par IP sur /api/auth/* (30 par défaut : un rush de bénévoles sur le même wifi passe). */
  authRateLimit: number;
}

export const CONFIG = Symbol('CONFIG');

const DEFAULT_DATABASE_URL = 'pglite:./.data/pglite';

/**
 * Lit et valide l'environnement. En production, SESSION_SECRET et DATABASE_URL sont obligatoires (sinon le serveur
 * signerait ses cookies avec un secret connu, ou démarrerait sur une base locale éphémère). Une valeur vide équivaut à une valeur absente.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = envSchema.parse(Object.fromEntries(Object.entries(env).filter(([, value]) => value !== '')));
  const production = e.NODE_ENV === 'production';
  if (production && !e.SESSION_SECRET) throw new Error('SESSION_SECRET est obligatoire en production');
  if (production && !e.DATABASE_URL) throw new Error('DATABASE_URL est obligatoire en production (ex. postgres://utilisateur:motdepasse@hote:5432/base)');
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL || DEFAULT_DATABASE_URL,
    sessionSecret: e.SESSION_SECRET ?? 'dev-only-secret-dev-only-secret',
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : production,
    webDist: e.WEB_DIST ? e.WEB_DIST : null,
    authRateLimit: e.AUTH_RATE_LIMIT,
  };
}
