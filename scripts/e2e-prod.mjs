#!/usr/bin/env node
/**
 * Suite Playwright complète contre le build de production, sans Docker : même topologie que l'image (un seul process,
 * un seul port, l'API sert le front construit), sur le port 3100 et avec une base PGlite en mémoire.
 *
 *   node scripts/e2e-prod.mjs [arguments de playwright test…]   (ex. : pwa.spec.ts --project=desktop)
 *   npm run e2e:prod
 *
 * E2E_PROD_SKIP_BUILD=1 réutilise le dernier build (itérations locales) ; sans cette variable, `npm run build` repart de zéro
 * (engine, puis web, puis api).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB = fileURLToPath(new URL('../apps/web/', import.meta.url));
const WEB_DIST = fileURLToPath(new URL('../apps/web/.output/public', import.meta.url));
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const HEALTH_TIMEOUT_MS = 60_000;

/** Pour le serveur : tout ce qu'il lit est fixé ici, l'environnement de l'appelant ne doit pas le contredire. */
const SERVER_ENV = {
  NODE_ENV: 'production',
  PORT: String(PORT),
  DATABASE_URL: 'pglite:memory',
  SESSION_SECRET: 'e2e-prod-secret-e2e-prod-secret',
  PUBLIC_URL: BASE_URL,
  WEB_DIST,
  SEED_DEMO: 'true',
  COOKIE_SECURE: 'false',
  AUTH_RATE_LIMIT: '10000',
  OAUTH_RATE_LIMIT_MULTIPLIER: '1000',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_ORIGIN: BASE_URL,
  TZ: 'Europe/Paris',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isHealthy() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2_000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Journal du serveur : conservé en mémoire (borné) et affiché seulement si quelque chose tourne mal (sans la liste des routes de Nest). */
function collectLogs(child) {
  let logs = '';
  const append = (chunk) => {
    logs = (logs + chunk).slice(-200_000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return () =>
    logs
      .split('\n')
      .filter((line) => !/RouterExplorer|RoutesResolver|InstanceLoader/.test(line))
      .slice(-40)
      .join('\n');
}

async function waitForHealth(child) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`le serveur s'est arrêté au démarrage (code ${child.exitCode})`);
    if (await isHealthy()) return;
    await sleep(500);
  }
  throw new Error(`${BASE_URL}/api/health ne répond pas 200 après ${HEALTH_TIMEOUT_MS / 1000} s`);
}

function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const forceKill = setTimeout(() => child.kill('SIGKILL'), 10_000);
    child.once('exit', () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill();
  });
}

function runPlaywright(args) {
  // le CLI de Playwright est lancé par node (pas de shell ni de npx) : même résolution que `npx playwright test` dans apps/web
  const cli = createRequire(`${WEB}package.json`).resolve('@playwright/test/cli');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'test', ...args], {
      cwd: WEB,
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: BASE_URL },
    });
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function main() {
  if (await isHealthy()) {
    console.error(`Le port ${PORT} est déjà occupé par un serveur Ma Tréso : arrête-le avant de lancer les tests de production.`);
    return 1;
  }

  if (!process.env.E2E_PROD_SKIP_BUILD) {
    // NUXT_PUBLIC_E2E : les specs pilotent le store par `window.__treso`, exposé « sur demande » dans un build (valeur figée au build)
    const build = spawnSync('npm run build', { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, NUXT_PUBLIC_E2E: 'true' } });
    if (build.status !== 0) {
      console.error('`npm run build` a échoué.');
      return build.status ?? 1;
    }
  }

  const server = spawn(process.execPath, ['apps/api/dist/main.js'], {
    cwd: ROOT,
    env: { ...process.env, ...SERVER_ENV },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tail = collectLogs(server);
  let code = 1;
  const onSignal = () => void stopServer(server).then(() => process.exit(130));
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    await waitForHealth(server);
    console.log(`Serveur de production prêt sur ${BASE_URL} (front : ${WEB_DIST})`);
    code = await runPlaywright(process.argv.slice(2));
    if (server.exitCode !== null) console.error(`Le serveur s'est arrêté pendant les tests (code ${server.exitCode}).`);
    if (code !== 0) console.error(`--- fin du journal du serveur ---\n${tail()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`--- fin du journal du serveur ---\n${tail()}`);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    await stopServer(server);
  }
  return code;
}

process.exitCode = await main();
