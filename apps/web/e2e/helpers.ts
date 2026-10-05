import { createHash, randomBytes } from 'node:crypto';
import { demoExportFile, type ExportFileV1 } from '@matreso/engine';
import type { APIRequestContext, Page } from '@playwright/test';

/** Typographie FR des montants : « −2 310 € » avec U+202F et U+00A0. */
export const fr = (text: string): string => text.replace(/(\d) (\d)/g, '$1 $2').replace(/ €/g, ' €');

/** Compte neuf et isolé, avec les données de démo (ou un fichier fourni), date figée au 4 octobre 2026. */
export async function freshAccount(page: Page, opts: { file?: ExportFileV1 | null; firstName?: string } = {}): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@matreso.test`;
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00'));
  const res = await page.request.post('/api/auth/register', { data: { email, password: 'motdepasse1', firstName: opts.firstName ?? 'Guillaume' } });
  if (!res.ok()) throw new Error(`register failed: ${res.status()}`);
  const file = opts.file === undefined ? demoExportFile() : opts.file;
  if (file) {
    const imported = await page.request.post('/api/import', { data: file });
    if (!imported.ok()) throw new Error(`import failed: ${imported.status()}`);
  }
  await page.goto('/');
  return email;
}

// même origine que le baseURL de Playwright (3000 en dev, 3100 contre le build de production) : c’est aussi le PUBLIC_URL de l’API
const ORIGIN = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const APP_CALLBACK = 'http://localhost:3999/callback';

/**
 * Connecte une application « Claude Code » au compte de la session portée par `request` (celle de la page) : enregistrement
 * dynamique, autorisation PKCE approuvée par cette session, échange du code. Renvoie le jeton d’accès.
 */
export async function connectApp(request: APIRequestContext): Promise<string> {
  const registered = await request.post('/register', {
    data: {
      client_name: 'Claude Code',
      redirect_uris: [APP_CALLBACK],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  });
  if (registered.status() !== 201) throw new Error(`register failed: ${registered.status()}`);
  const clientId = ((await registered.json()) as { client_id: string }).client_id;
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: APP_CALLBACK,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'e2e',
    scope: 'cresus',
    resource: `${ORIGIN}/mcp`,
  });
  const authorize = await request.get(`/authorize?${query}`, { maxRedirects: 0 });
  const requestId = new URL(authorize.headers().location ?? '', ORIGIN).searchParams.get('request');
  if (authorize.status() !== 302 || !requestId) throw new Error(`authorize failed: ${authorize.status()}`);
  const approved = await request.post(`/api/oauth/requests/${requestId}/approve`, { data: {} });
  if (!approved.ok()) throw new Error(`approve failed: ${approved.status()}`);
  const code = new URL(((await approved.json()) as { redirectUrl: string }).redirectUrl).searchParams.get('code');
  const token = await request.post('/token', {
    form: { grant_type: 'authorization_code', code: code ?? '', code_verifier: verifier, client_id: clientId, redirect_uri: APP_CALLBACK, resource: `${ORIGIN}/mcp` },
  });
  if (!token.ok()) throw new Error(`token failed: ${token.status()}`);
  return ((await token.json()) as { access_token: string }).access_token;
}

/** Statut HTTP du serveur MCP pour ce jeton d’accès : 200 tant qu’il est valable, 401 une fois révoqué. */
export async function mcpStatus(request: APIRequestContext, accessToken: string): Promise<number> {
  const res = await request.post('/mcp', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1.0.0' } } },
  });
  return res.status();
}
