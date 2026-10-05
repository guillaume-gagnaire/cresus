import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AppConfig, CONFIG, loadConfig } from '../src/config.js';
import { DB, type Db } from '../src/db/db.module.js';
import { oauthClients, oauthCodes, oauthRequests, oauthTokens } from '../src/db/schema.js';
import { OAuthProvider } from '../src/oauth/oauth.provider.js';
import { OAuthStore } from '../src/oauth/oauth.store.js';
import { isAllowedRedirectUri } from '../src/oauth/redirect-uri.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const REDIRECT = 'http://localhost:33418/callback';
const EXPIRED_MESSAGE = 'Cette demande d’autorisation a expiré. Relance la connexion depuis Claude Code.';
const creds = { email: 'guillaume@example.com', password: 'motdepasse1', firstName: 'Guillaume' };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};
const past = () => new Date(Date.now() - 60_000);

describe('isAllowedRedirectUri', () => {
  it('accepts loopback http and https, and nothing else', () => {
    for (const uri of ['http://localhost:33418/callback', 'http://127.0.0.1:8080/cb', 'http://localhost/cb', 'https://claude.ai/api/mcp/auth_callback', 'https://example.com:8443/x?y=1']) {
      expect(isAllowedRedirectUri(uri), uri).toBe(true);
    }
    for (const uri of [
      'myapp://cb',
      'http://evil.example/cb',
      'http://localhost.evil.example/cb',
      'http://localhost@evil.example/cb',
      'http://[::1]:1234/cb',
      'https://user:secret@example.com/cb',
      'https://example.com/cb#frag',
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://example.com/cb',
      '/relative',
      '',
    ]) {
      expect(isAllowedRedirectUri(uri), uri).toBe(false);
    }
  });
});

describe('OAuth 2.1 authorization server', () => {
  let app: NestExpressApplication;
  let config: AppConfig;
  let db: Db;
  let provider: OAuthProvider;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await setupTestApp();
    config = app.get<AppConfig>(CONFIG);
    db = app.get<Db>(DB);
    provider = app.get(OAuthProvider);
  });
  beforeEach(async () => { await resetDb(app); });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await app.close(); });

  const newUser = async (email = creds.email) => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ ...creds, email }).expect(201);
    return agent;
  };
  /** Enregistrement dynamique par HTTP ; les limites du routeur du SDK sont relevées par setupTestApp (OAUTH_RATE_LIMIT_MULTIPLIER). */
  const registerClient = async (redirectUri = REDIRECT): Promise<string> => {
    const res = await http()
      .post('/register')
      .send({ client_name: 'Claude Code', redirect_uris: [redirectUri], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' })
      .expect(201);
    return res.body.client_id as string;
  };
  const authorizeQuery = (clientId: string, challenge: string, extra: Record<string, string> = {}) => ({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'cresus',
    ...extra,
  });
  /** Démarre /authorize et renvoie l'identifiant de la demande de consentement. */
  const startAuthorize = async (clientId: string, challenge: string, extra: Record<string, string> = {}): Promise<string> => {
    const res = await http().get('/authorize').query(authorizeQuery(clientId, challenge, extra)).expect(302);
    const location = new URL(res.headers.location as string);
    expect(`${location.origin}${location.pathname}`).toBe(`${config.publicUrl}/oauth/consent`);
    return location.searchParams.get('request') as string;
  };
  /** Parcours complet jusqu'au code d'autorisation, approuvé par `agent`. */
  const obtainCode = async (agent: ReturnType<typeof agentFor>, clientId: string, challenge: string): Promise<string> => {
    const id = await startAuthorize(clientId, challenge);
    const res = await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(200);
    return new URL(res.body.redirectUrl as string).searchParams.get('code') as string;
  };
  const tokenRequest = (body: Record<string, string>) => http().post('/token').type('form').send(body);
  const exchangeCode = (clientId: string, code: string, verifier: string, extra: Record<string, string> = {}) =>
    tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT, ...extra });
  const fullFlow = async (email?: string) => {
    const agent = await newUser(email);
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const code = await obtainCode(agent, clientId, challenge);
    const tokens = (await exchangeCode(clientId, code, verifier).expect(200)).body as { access_token: string; refresh_token: string };
    return { agent, clientId, tokens };
  };

  it('publishes the authorization server metadata (RFC 8414)', async () => {
    const res = await http().get('/.well-known/oauth-authorization-server').expect(200);
    const base = new URL(config.publicUrl);
    expect(res.body).toMatchObject({
      issuer: base.href,
      authorization_endpoint: new URL('/authorize', base).href,
      token_endpoint: new URL('/token', base).href,
      registration_endpoint: new URL('/register', base).href,
      revocation_endpoint: new URL('/revoke', base).href,
      scopes_supported: ['cresus'],
    });
    expect(res.body.code_challenge_methods_supported).toContain('S256');
    expect(res.body.grant_types_supported).toEqual(expect.arrayContaining(['authorization_code', 'refresh_token']));
  });

  it('publishes the protected resource metadata (RFC 9728), at the root and at the path of /mcp', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const res = await http().get(path).expect(200);
      expect(res.body.resource, path).toBe(`${config.publicUrl}/mcp`);
      expect(res.body.authorization_servers, path).toContain(new URL(config.publicUrl).href);
      expect(res.body.scopes_supported, path).toEqual(['cresus']);
    }
  });

  it('registers public clients dynamically and refuses redirect URIs outside the allow-list', async () => {
    const ok = await http()
      .post('/register')
      .send({ client_name: 'Claude Code', redirect_uris: [REDIRECT], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' })
      .expect(201);
    expect(ok.body.client_id).toEqual(expect.any(String));
    expect(ok.body.client_secret).toBeUndefined();
    expect(ok.body).toMatchObject({ client_name: 'Claude Code', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' });
    // un client enregistré par HTTP peut lancer un parcours d'autorisation
    await startAuthorize(ok.body.client_id, pkce().challenge);
    const [row] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, ok.body.client_id));
    expect(row).toMatchObject({ clientName: 'Claude Code', redirectUris: [REDIRECT] });

    for (const bad of ['myapp://cb', 'http://evil.example/cb']) {
      const res = await http().post('/register').send({ client_name: 'Evil', redirect_uris: [bad], token_endpoint_auth_method: 'none' }).expect(400);
      expect(res.body.error).toBe('invalid_redirect_uri');
    }
    // une seule URI refusée suffit à refuser l'enregistrement
    await http().post('/register').send({ redirect_uris: [REDIRECT, 'http://evil.example/cb'] }).expect(400);
    await http().post('/register').send({ redirect_uris: [] }).expect(400);
    expect(await db.select().from(oauthClients)).toHaveLength(1);
  });

  it('bounds what /register accepts: body size, number and size of redirect URIs, name length', async () => {
    const register = (body: Record<string, unknown>) => http().post('/register').send(body);
    const tooBig = await register({ redirect_uris: [REDIRECT], jwks: { keys: ['x'.repeat(20_000)] } }).expect(413);
    expect(tooBig.body.error).toBe('invalid_request');
    expect((await http().post('/register').type('json').send('{"redirect_uris": [').expect(400)).body.error).toBe('invalid_request');

    const many = Array.from({ length: 11 }, (_, i) => `https://app${i}.example/cb`);
    expect((await register({ redirect_uris: many }).expect(400)).body.error).toBe('invalid_client_metadata');
    await register({ redirect_uris: many.slice(0, 10) }).expect(201);
    const longUri = `https://app.example/${'a'.repeat(2048)}`;
    expect((await register({ redirect_uris: [longUri] }).expect(400)).body.error).toBe('invalid_client_metadata');
    expect((await register({ redirect_uris: [REDIRECT], client_name: 'n'.repeat(201) }).expect(400)).body.error).toBe('invalid_client_metadata');
    await register({ redirect_uris: [REDIRECT], client_name: 'n'.repeat(200) }).expect(201);
    expect((await register({ redirect_uris: [REDIRECT], software_id: 's'.repeat(2049) }).expect(400)).body.error).toBe('invalid_client_metadata');
  });

  it('bounds the form bodies of /token and /revoke too', async () => {
    const junk = { grant_type: 'authorization_code', junk: 'x'.repeat(20_000) };
    expect((await http().post('/token').type('form').send(junk).expect(413)).body.error).toBe('invalid_request');
    expect((await http().post('/revoke').type('form').send({ token: 'x'.repeat(20_000) }).expect(413)).body.error).toBe('invalid_request');
  });

  it('persists only a whitelist of client metadata', async () => {
    const res = await http()
      .post('/register')
      .send({
        redirect_uris: [REDIRECT],
        client_name: 'Claude Code',
        client_uri: 'https://claude.ai',
        logo_uri: 'https://claude.ai/logo.png',
        scope: 'cresus',
        software_id: 'claude-code',
        software_version: '1.2.3',
        grant_types: ['authorization_code', 'client_credentials'],
        response_types: ['code', 'token'],
        token_endpoint_auth_method: 'none',
        jwks: { keys: [{ kty: 'RSA', n: 'x'.repeat(5_000), e: 'AQAB' }] },
        contacts: ['a@example.com'],
        software_statement: 'y'.repeat(5_000),
        tos_uri: 'https://claude.ai/tos',
        policy_uri: 'https://claude.ai/policy',
        jwks_uri: 'https://claude.ai/jwks',
      })
      .expect(201);
    const allowed = ['redirect_uris', 'client_name', 'client_uri', 'logo_uri', 'grant_types', 'response_types', 'token_endpoint_auth_method', 'scope', 'software_id', 'software_version'];
    expect(Object.keys(res.body).sort()).toEqual([...allowed, 'client_id', 'client_id_issued_at'].sort());
    expect(res.body).toMatchObject({ grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], software_id: 'claude-code' });
    const [row] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, res.body.client_id));
    expect(Object.keys(row?.metadata ?? {}).sort()).toEqual([...allowed].sort());
    const client = await provider.clientsStore.getClient(res.body.client_id);
    expect(client).toEqual(res.body);
  });

  it('forces every registered client to be public, whatever authentication method it asks for', async () => {
    const res = await http().post('/register').send({ redirect_uris: [REDIRECT] }).expect(201);
    expect(res.body.client_secret).toBeUndefined();
    expect(res.body.client_secret_expires_at).toBeUndefined();
    expect(res.body.token_endpoint_auth_method).toBe('none');
    expect(res.body.client_name).toBe('Application sans nom');
  });

  it('redirects /authorize to the consent page with a pending request', async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();
    const id = await startAuthorize(clientId, challenge);
    const [row] = await db.select().from(oauthRequests).where(eq(oauthRequests.id, id));
    expect(row).toMatchObject({ clientId, redirectUri: REDIRECT, codeChallenge: challenge, state: 'xyz', scope: 'cresus', resource: null });
    const ttl = (row?.expiresAt.getTime() ?? 0) - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000);
  });

  it('answers /authorize errors directly when the client or the redirect URI cannot be trusted', async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();
    const unknownClient = await http().get('/authorize').query(authorizeQuery('inconnu', challenge)).expect(400);
    expect(unknownClient.body.error).toBe('invalid_client');
    const badRedirect = await http().get('/authorize').query(authorizeQuery(clientId, challenge, { redirect_uri: 'http://localhost:33418/autre' })).expect(400);
    expect(badRedirect.body.error).toBe('invalid_request');
    const noPkce = await http().get('/authorize').query({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, state: 'xyz' }).expect(302);
    expect(noPkce.headers.location).toMatch(/^http:\/\/localhost:33418\/callback\?error=invalid_request/);
    expect(await db.select().from(oauthRequests)).toHaveLength(0);
  });

  it('accepts any loopback port at /authorize, keeps the requested one, and defaults the scope to cresus', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { challenge } = pkce();
    const other = 'http://localhost:51234/callback';
    const id = await startAuthorize(clientId, challenge, { redirect_uri: other, scope: 'cresus extra' });
    const res = await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(200);
    expect(res.body.redirectUrl.startsWith(`${other}?`)).toBe(true);
    const [code] = await db.select().from(oauthCodes);
    expect(code).toMatchObject({ redirectUri: other, scope: 'cresus' });
  });

  it('requires a session to read a consent request, then describes it', async () => {
    const clientId = await registerClient();
    const id = await startAuthorize(clientId, pkce().challenge);
    await request(app.getHttpServer()).get(`/api/oauth/requests/${id}`).expect(401);
    const agent = await newUser();
    const res = await agent.get(`/api/oauth/requests/${id}`).expect(200);
    expect(res.body).toEqual({ clientName: 'Claude Code', redirectHost: 'localhost:33418', scope: 'cresus' });
  });

  it('approves once: returns the redirect URL with the code and the state, then answers 404', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const id = await startAuthorize(clientId, pkce().challenge);
    const res = await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(200);
    const url = new URL(res.body.redirectUrl as string);
    expect((res.body.redirectUrl as string).startsWith(REDIRECT)).toBe(true);
    expect(url.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBe('xyz');
    const replay = await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(404);
    expect(replay.body.message).toBe(EXPIRED_MESSAGE);
    expect(await db.select().from(oauthRequests)).toHaveLength(0);
    const [stored] = await db.select().from(oauthCodes);
    const ttl = (stored?.expiresAt.getTime() ?? 0) - Date.now();
    expect(ttl).toBeGreaterThan(4 * 60_000);
    expect(ttl).toBeLessThanOrEqual(5 * 60_000);
  });

  it('refuses a consent request: redirects with access_denied and the state, then answers 404', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const id = await startAuthorize(clientId, pkce().challenge);
    const res = await agent.post(`/api/oauth/requests/${id}/deny`).send({}).expect(200);
    expect(res.body.redirectUrl).toBe(`${REDIRECT}?error=access_denied&state=xyz`);
    await agent.post(`/api/oauth/requests/${id}/deny`).send({}).expect(404);
    await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(404);
    expect(await db.select().from(oauthCodes)).toHaveLength(0);
  });

  it('answers 404 with the French message for unknown, malformed or expired requests', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    for (const id of ['00000000-0000-4000-8000-000000000000', 'pas-un-uuid']) {
      const res = await agent.get(`/api/oauth/requests/${id}`).expect(404);
      expect(res.body.message).toBe(EXPIRED_MESSAGE);
    }
    const id = await startAuthorize(clientId, pkce().challenge);
    await db.update(oauthRequests).set({ expiresAt: past() }).where(eq(oauthRequests.id, id));
    const calls = [
      () => agent.get(`/api/oauth/requests/${id}`),
      () => agent.post(`/api/oauth/requests/${id}/approve`).send({}),
      () => agent.post(`/api/oauth/requests/${id}/deny`).send({}),
    ];
    for (const call of calls) expect((await call().expect(404)).body.message).toBe(EXPIRED_MESSAGE);
    expect(await db.select().from(oauthCodes)).toHaveLength(0);
  });

  it('requires a session and a JSON body to approve or deny', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const id = await startAuthorize(clientId, pkce().challenge);
    await http().post(`/api/oauth/requests/${id}/approve`).send({}).expect(401);
    await http().post(`/api/oauth/requests/${id}/deny`).send({}).expect(401);
    await agent.post(`/api/oauth/requests/${id}/approve`).type('form').send({ a: '1' }).expect(415);
    await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(200);
  });

  it('exchanges the code for tokens (PKCE verified), once only', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const code = await obtainCode(agent, clientId, challenge);
    const res = await exchangeCode(clientId, code, verifier).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ token_type: 'bearer', expires_in: 3600, scope: 'cresus' });
    expect(res.body.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.access_token).not.toBe(res.body.refresh_token);
    const replay = await exchangeCode(clientId, code, verifier).expect(400);
    expect(replay.body.error).toBe('invalid_grant');
    expect(await db.select().from(oauthCodes)).toHaveLength(0);
  });

  it('revokes the tokens issued from an authorization code when that code is replayed (RFC 6749 4.1.2)', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const code = await obtainCode(agent, clientId, challenge);
    const first = (await exchangeCode(clientId, code, verifier).expect(200)).body as { access_token: string; refresh_token: string };
    // le jeton issu d'une rotation descend du même code : il est révoqué lui aussi
    const rotated = (await tokenRequest({ grant_type: 'refresh_token', refresh_token: first.refresh_token, client_id: clientId }).expect(200)).body as { access_token: string; refresh_token: string };
    // un autre parcours, sans rapport avec ce code
    const other = await fullFlow('other@example.com');
    await provider.verifyAccessToken(rotated.access_token);

    expect((await exchangeCode(clientId, code, verifier).expect(400)).body.error).toBe('invalid_grant');
    await expect(provider.verifyAccessToken(rotated.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    expect((await tokenRequest({ grant_type: 'refresh_token', refresh_token: rotated.refresh_token, client_id: clientId }).expect(400)).body.error).toBe('invalid_grant');
    await expect(provider.verifyAccessToken(other.tokens.access_token)).resolves.toMatchObject({ scopes: ['cresus'] });
    expect((await db.select().from(oauthTokens).where(eq(oauthTokens.clientId, clientId))).filter((t) => t.revokedAt === null)).toHaveLength(0);
  });

  it('does not revoke anything when an unknown code, or another client, presents a code that was never redeemed', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const first = await fullFlow('other@example.com');
    const code = await obtainCode(agent, clientId, challenge);
    expect((await exchangeCode(first.clientId, code, verifier).expect(400)).body.error).toBe('invalid_grant');
    expect((await exchangeCode(clientId, randomBytes(32).toString('base64url'), verifier).expect(400)).body.error).toBe('invalid_grant');
    await provider.verifyAccessToken(first.tokens.access_token);
    await exchangeCode(clientId, code, verifier).expect(200);
  });

  it('refuses a wrong code_verifier, an unknown code, another client, another redirect URI and an expired code', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const otherClientId = await registerClient();
    const { verifier, challenge } = pkce();

    const code = await obtainCode(agent, clientId, challenge);
    const wrong = await exchangeCode(clientId, code, pkce().verifier).expect(400);
    expect(wrong.body.error).toBe('invalid_grant');
    // l'échec PKCE ne consomme pas le code : le bon vérificateur fonctionne encore
    await exchangeCode(clientId, code, verifier).expect(200);

    expect((await exchangeCode(clientId, randomBytes(32).toString('base64url'), verifier).expect(400)).body.error).toBe('invalid_grant');

    // un autre client ne peut ni utiliser ni brûler le code d'un client : le propriétaire peut encore l'échanger
    const stolen = await obtainCode(agent, clientId, challenge);
    expect((await exchangeCode(otherClientId, stolen, verifier).expect(400)).body.error).toBe('invalid_grant');
    await exchangeCode(clientId, stolen, verifier).expect(200);

    const moved = await obtainCode(agent, clientId, challenge);
    expect((await exchangeCode(clientId, moved, verifier, { redirect_uri: 'http://localhost:33418/ailleurs' }).expect(400)).body.error).toBe('invalid_grant');

    const stale = await obtainCode(agent, clientId, challenge);
    await db.update(oauthCodes).set({ expiresAt: past() });
    expect((await exchangeCode(clientId, stale, verifier).expect(400)).body.error).toBe('invalid_grant');
    // seuls les deux échanges valides ont émis des jetons
    expect(await db.select().from(oauthTokens)).toHaveLength(2);
  });

  it('rotates the refresh token: new pair issued, the old one is refused', async () => {
    const { clientId, tokens } = await fullFlow();
    const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }).expect(200);
    expect(refreshed.body).toMatchObject({ token_type: 'bearer', expires_in: 3600, scope: 'cresus' });
    expect(refreshed.body.access_token).not.toBe(tokens.access_token);
    expect(refreshed.body.refresh_token).not.toBe(tokens.refresh_token);
    const replay = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }).expect(400);
    expect(replay.body.error).toBe('invalid_grant');
    // l'ancienne paire est révoquée en entier, la nouvelle fonctionne
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(provider.verifyAccessToken(refreshed.body.access_token)).resolves.toMatchObject({ clientId });
    const next = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token, client_id: clientId, scope: 'cresus' }).expect(200);
    expect(next.body.refresh_token).not.toBe(refreshed.body.refresh_token);
  });

  it('refuses refresh tokens that are expired, unknown, foreign or ask for another scope', async () => {
    const { clientId, tokens } = await fullFlow();
    const otherClientId = await registerClient();
    const refresh = (body: Record<string, string>) => tokenRequest({ grant_type: 'refresh_token', client_id: clientId, ...body });
    expect((await refresh({ refresh_token: randomBytes(32).toString('base64url') }).expect(400)).body.error).toBe('invalid_grant');
    expect((await tokenRequest({ grant_type: 'refresh_token', client_id: otherClientId, refresh_token: tokens.refresh_token }).expect(400)).body.error).toBe('invalid_grant');
    expect((await refresh({ refresh_token: tokens.refresh_token, scope: 'admin' }).expect(400)).body.error).toBe('invalid_scope');
    await db.update(oauthTokens).set({ refreshExpiresAt: past() });
    expect((await refresh({ refresh_token: tokens.refresh_token }).expect(400)).body.error).toBe('invalid_grant');
  });

  it('verifies access tokens and exposes the user id', async () => {
    const { agent, clientId, tokens } = await fullFlow();
    const me = await agent.get('/api/auth/me').expect(200);
    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info).toMatchObject({ token: tokens.access_token, clientId, scopes: ['cresus'], extra: { userId: me.body.user.id } });
    const expectedExpiry = Math.floor(Date.now() / 1000) + 3600;
    expect(Math.abs((info.expiresAt ?? 0) - expectedExpiry)).toBeLessThan(30);

    await expect(provider.verifyAccessToken(randomBytes(32).toString('base64url'))).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(provider.verifyAccessToken(tokens.refresh_token)).rejects.toBeInstanceOf(InvalidTokenError);
    await db.update(oauthTokens).set({ accessExpiresAt: past() });
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('revokes a token pair through /revoke, from the access token or the refresh token', async () => {
    const { clientId, tokens } = await fullFlow();
    await provider.verifyAccessToken(tokens.access_token);
    await http().post('/revoke').type('form').send({ token: tokens.access_token, client_id: clientId }).expect(200);
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    expect((await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }).expect(400)).body.error).toBe('invalid_grant');

    const second = await fullFlow('second@example.com');
    await http().post('/revoke').type('form').send({ token: second.tokens.refresh_token, token_type_hint: 'refresh_token', client_id: second.clientId }).expect(200);
    await expect(provider.verifyAccessToken(second.tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);

    // un jeton inconnu n'est pas une erreur (RFC 7009)
    await http().post('/revoke').type('form').send({ token: 'inconnu', client_id: clientId }).expect(200);
  });

  it('does not let a client revoke the tokens of another client', async () => {
    const { tokens } = await fullFlow();
    const otherClientId = await registerClient();
    await http().post('/revoke').type('form').send({ token: tokens.access_token, client_id: otherClientId }).expect(200);
    await expect(provider.verifyAccessToken(tokens.access_token)).resolves.toMatchObject({ scopes: ['cresus'] });
  });

  it('stores only SHA-256 hashes of codes and tokens', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const code = await obtainCode(agent, clientId, challenge);

    const codeRows = await db.select().from(oauthCodes);
    expect(codeRows).toHaveLength(1);
    expect(codeRows[0]?.codeHash).toBe(sha256(code));
    expect(JSON.stringify(codeRows)).not.toContain(code);

    const tokens = (await exchangeCode(clientId, code, verifier).expect(200)).body as { access_token: string; refresh_token: string };
    const tokenRows = await db.select().from(oauthTokens);
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]).toMatchObject({ accessHash: sha256(tokens.access_token), refreshHash: sha256(tokens.refresh_token), clientId, scope: 'cresus', revokedAt: null });
    const dump = JSON.stringify(tokenRows);
    expect(dump).not.toContain(tokens.access_token);
    expect(dump).not.toContain(tokens.refresh_token);
    expect(JSON.stringify(await db.select().from(oauthCodes))).not.toContain(code);
  });

  it('deletes the codes and tokens of a user together with the user', async () => {
    const { agent } = await fullFlow();
    await obtainCode(agent, await registerClient(), pkce().challenge);
    expect(await db.select().from(oauthTokens)).toHaveLength(1);
    expect(await db.select().from(oauthCodes)).toHaveLength(1);
    await agent.delete('/api/account').send({ password: creds.password }).expect(204);
    expect(await db.select().from(oauthTokens)).toHaveLength(0);
    expect(await db.select().from(oauthCodes)).toHaveLength(0);
  });

  it('only accepts the MCP endpoint as the RFC 8707 resource, and records it', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();

    const bad = await http().get('/authorize').query(authorizeQuery(clientId, challenge, { resource: 'https://autre.example/mcp' })).expect(302);
    expect(bad.headers.location).toMatch(/^http:\/\/localhost:33418\/callback\?error=invalid_target/);
    expect(bad.headers.location).toContain('state=xyz');
    expect(await db.select().from(oauthRequests)).toHaveLength(0);

    const resource = `${config.publicUrl}/mcp`;
    const id = await startAuthorize(clientId, challenge, { resource });
    const [request_] = await db.select().from(oauthRequests).where(eq(oauthRequests.id, id));
    expect(request_?.resource).toBe(resource);
    const approved = await agent.post(`/api/oauth/requests/${id}/approve`).send({}).expect(200);
    const code = new URL(approved.body.redirectUrl as string).searchParams.get('code') as string;
    const mismatch = await exchangeCode(clientId, code, verifier, { resource: 'https://autre.example/mcp' }).expect(400);
    expect(mismatch.body.error).toBe('invalid_target');
    const code2 = await (async () => {
      const id2 = await startAuthorize(clientId, challenge, { resource });
      const res = await agent.post(`/api/oauth/requests/${id2}/approve`).send({}).expect(200);
      return new URL(res.body.redirectUrl as string).searchParams.get('code') as string;
    })();
    await exchangeCode(clientId, code2, verifier, { resource }).expect(200);
  });

  it('logs the unexpected errors that the SDK router answers with a bare 500, without any secret', async () => {
    const agent = await newUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const code = await obtainCode(agent, clientId, challenge);
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(app.get(OAuthStore), 'consumeCode').mockRejectedValueOnce(new Error('boom'));
    const res = await exchangeCode(clientId, code, verifier).expect(500);
    expect(res.body).toEqual({ error: 'server_error', error_description: 'Internal Server Error' });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0]?.[0])).toContain('boom');
    expect(JSON.stringify(logged.mock.calls)).not.toContain(code);
    // les erreurs OAuth attendues ne sont pas journalisées
    await exchangeCode(clientId, 'inconnu', verifier).expect(400);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('purges expired requests, codes and tokens when a new authorization starts', async () => {
    const { agent, clientId } = await fullFlow();
    const staleRequest = await startAuthorize(clientId, pkce().challenge);
    const staleCode = await obtainCode(agent, clientId, pkce().challenge);
    expect(staleCode).toBeTruthy();
    await db.update(oauthRequests).set({ expiresAt: past() });
    await db.update(oauthCodes).set({ expiresAt: past() });
    await db.update(oauthTokens).set({ refreshExpiresAt: past() });
    const fresh = await startAuthorize(clientId, pkce().challenge);
    const requests = await db.select().from(oauthRequests);
    expect(requests.map((r) => r.id)).toEqual([fresh]);
    expect(requests.map((r) => r.id)).not.toContain(staleRequest);
    expect(await db.select().from(oauthCodes)).toHaveLength(0);
    expect(await db.select().from(oauthTokens)).toHaveLength(0);
  });
});

describe('PUBLIC_URL', () => {
  const base = { NODE_ENV: 'test', DATABASE_URL: 'pglite:memory', SESSION_SECRET: 'test-secret-test-secret' };

  it('defaults to http://localhost:3000, drops trailing slashes and is required in production', () => {
    expect(loadConfig(base).publicUrl).toBe('http://localhost:3000');
    expect(loadConfig({ ...base, PUBLIC_URL: '' }).publicUrl).toBe('http://localhost:3000');
    expect(loadConfig({ ...base, PUBLIC_URL: 'https://cresus.gagnaire.dev/' }).publicUrl).toBe('https://cresus.gagnaire.dev');
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('PUBLIC_URL est obligatoire en production');
    expect(loadConfig({ ...base, NODE_ENV: 'production', PUBLIC_URL: 'https://cresus.gagnaire.dev' }).publicUrl).toBe('https://cresus.gagnaire.dev');
  });

  it('rejects anything that is not an http(s) origin: other schemes, paths, query, fragment', () => {
    for (const bad of ['cresus', 'ftp://cresus.gagnaire.dev', 'https://cresus.gagnaire.dev/?a=1', 'https://cresus.gagnaire.dev/#x', 'https://cresus.gagnaire.dev/app', 'https://cresus.gagnaire.dev/app/']) {
      expect(() => loadConfig({ ...base, PUBLIC_URL: bad }), bad).toThrow(/PUBLIC_URL/);
    }
    expect(() => loadConfig({ ...base, PUBLIC_URL: 'https://cresus.gagnaire.dev/app' })).toThrow('PUBLIC_URL ne doit pas contenir de chemin');
  });
});

describe('OAUTH_RATE_LIMIT_MULTIPLIER', () => {
  const base = { NODE_ENV: 'test', DATABASE_URL: 'pglite:memory', SESSION_SECRET: 'test-secret-test-secret' };

  it('defaults to 1 (the SDK limits) and must be a positive integer', () => {
    expect(loadConfig(base).oauthRateLimitMultiplier).toBe(1);
    expect(loadConfig({ ...base, OAUTH_RATE_LIMIT_MULTIPLIER: '1000' }).oauthRateLimitMultiplier).toBe(1000);
    for (const bad of ['0', '-1', '1.5', 'beaucoup']) expect(() => loadConfig({ ...base, OAUTH_RATE_LIMIT_MULTIPLIER: bad }), bad).toThrow();
  });

  const registrations = async (multiplier: string, count: number): Promise<number[]> => {
    const app = await setupTestApp({ OAUTH_RATE_LIMIT_MULTIPLIER: multiplier });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < count; i++) statuses.push((await request(app.getHttpServer()).post('/register').send({ redirect_uris: [REDIRECT] })).status);
      return statuses;
    } finally {
      await app.close();
    }
  };

  it('keeps the SDK limit on /register (20 per hour and per IP) by default', async () => {
    const statuses = await registrations('1', 21);
    expect(statuses.slice(0, 20).every((status) => status === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('scales the limits of the SDK router', async () => {
    const statuses = await registrations('2', 41);
    expect(statuses.slice(0, 40).every((status) => status === 201)).toBe(true);
    expect(statuses[40]).toBe(429);
  });
});

describe('static front and OAuth routes', () => {
  let app: NestExpressApplication;
  let dir: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'matreso-oauth-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');
    app = await setupTestApp({ WEB_DIST: dir });
  });
  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('never answers the SPA for the OAuth and MCP endpoints, but still does for the consent page', async () => {
    const http = () => request(app.getHttpServer());
    await http().get('/oauth/consent?request=abc').expect(200).expect(/<title>spa<\/title>/);
    await http().get('/login').expect(200).expect(/<title>spa<\/title>/);
    expect((await http().get('/authorize').expect(400)).body.error).toBe('invalid_request');
    expect((await http().get('/token').expect(405)).body.error).toBe('method_not_allowed');
    expect((await http().get('/register').expect(405)).body.error).toBe('method_not_allowed');
    expect((await http().get('/revoke').expect(405)).body.error).toBe('method_not_allowed');
    // /mcp existe (Task 39) : sans jeton, c'est le 401 du serveur MCP, jamais le repli SPA
    const mcp = await http().get('/mcp').expect(401);
    expect(mcp.text).not.toContain('<title>spa</title>');
    expect(mcp.headers['www-authenticate']).toContain('resource_metadata=');
    for (const path of ['/.well-known/openid-configuration', '/.well-known/oauth-authorization-server/x']) {
      const res = await http().get(path);
      expect(res.status, path).toBe(404);
      expect(res.text, path).not.toContain('<title>spa</title>');
    }
  });
});
