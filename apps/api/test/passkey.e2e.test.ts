import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { passkeys } from '../src/db/schema.js';
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

  describe('full ceremony with a software authenticator', () => {
    const ORIGIN = 'http://localhost:3000';
    const rpIdHash = createHash('sha256').update('localhost').digest();
    const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64url');
    const counterBytes = (n: number) => { const c = Buffer.alloc(4); c.writeUInt32BE(n); return c; };
    const clientData = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));

    /** Authentificateur logiciel minimal : clé ES256, attestation « none ». */
    const makeAuthenticator = () => {
      const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const credentialId = randomBytes(32);
      const jwk = publicKey.export({ format: 'jwk' });
      const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([
        [1, 2], [3, -7], [-1, 1], [-2, isoBase64URL.toBuffer(jwk.x as string)], [-3, isoBase64URL.toBuffer(jwk.y as string)],
      ]));
      const idLen = Buffer.alloc(2);
      idLen.writeUInt16BE(credentialId.length);
      return {
        id: b64(credentialId),
        attest(challenge: string) {
          const authData = Buffer.concat([rpIdHash, Buffer.from([0x45]), counterBytes(0), Buffer.alloc(16), idLen, credentialId, cose]);
          const attestationObject = isoCBOR.encode(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]) as never);
          return {
            id: b64(credentialId), rawId: b64(credentialId), type: 'public-key', clientExtensionResults: {},
            response: { clientDataJSON: b64(clientData('webauthn.create', challenge)), attestationObject: b64(attestationObject), transports: ['internal'] },
          };
        },
        assert(challenge: string, counter: number, userHandle?: string) {
          const authData = Buffer.concat([rpIdHash, Buffer.from([0x05]), counterBytes(counter)]);
          const clientDataJSON = clientData('webauthn.get', challenge);
          const signature = sign('sha256', Buffer.concat([authData, createHash('sha256').update(clientDataJSON).digest()]), privateKey);
          return {
            id: b64(credentialId), rawId: b64(credentialId), type: 'public-key', clientExtensionResults: {},
            response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData), signature: b64(signature), userHandle },
          };
        },
      };
    };

    const enable = async (agent: ReturnType<typeof agentFor>, authenticator: ReturnType<typeof makeAuthenticator>) => {
      const opts = await agent.post('/api/auth/passkeys/register/options').send({}).expect(201);
      return agent.post('/api/auth/passkeys/register/verify').send(authenticator.attest(opts.body.challenge)).expect(201);
    };

    it('enables Face ID, logs in with the passkey, tracks the counter and disables it', async () => {
      const agent = await register();
      const authenticator = makeAuthenticator();
      const enabled = await enable(agent, authenticator);
      expect(enabled.body.hasPasskey).toBe(true);
      const db = app.get<Db>(DB);
      const [stored] = await db.select().from(passkeys).where(eq(passkeys.credentialId, authenticator.id));
      expect(stored).toMatchObject({ counter: 0, transports: ['internal'] });

      // connexion depuis un navigateur sans session
      const fresh = agentFor(app);
      const opts = await fresh.post('/api/auth/passkeys/login/options').send({}).expect(201);
      const login = await fresh.post('/api/auth/passkeys/login/verify').send(authenticator.assert(opts.body.challenge, 1)).expect(200);
      expect(login.body).toMatchObject({ user: { email: 'pk@example.com' }, hasPasskey: true });
      expect(String(login.headers['set-cookie'])).toMatch(/mt_session=/);
      await fresh.get('/api/auth/me').expect(200);
      const [afterLogin] = await db.select().from(passkeys).where(eq(passkeys.credentialId, authenticator.id));
      expect(afterLogin?.counter).toBe(1);

      // le défi est à usage unique : rejouer la même réponse est refusé
      const replay = await fresh.post('/api/auth/passkeys/login/verify').send(authenticator.assert(opts.body.challenge, 2)).expect(400);
      expect(replay.body.code).toBe('PASSKEY_EXPIRED');

      // un compteur qui ne progresse pas est refusé
      const again = await fresh.post('/api/auth/passkeys/login/options').send({}).expect(201);
      const stale = await fresh.post('/api/auth/passkeys/login/verify').send(authenticator.assert(again.body.challenge, 1)).expect(401);
      expect(stale.body.code).toBe('PASSKEY_INVALID');

      // désactivation : la passkey n'est plus reconnue
      await agent.delete('/api/auth/passkeys').send({}).expect(204);
      const last = await fresh.post('/api/auth/passkeys/login/options').send({}).expect(201);
      const gone = await fresh.post('/api/auth/passkeys/login/verify').send(authenticator.assert(last.body.challenge, 3)).expect(401);
      expect(gone.body.code).toBe('PASSKEY_UNKNOWN');
    });

    it('rejects a login signed by another key and a registration for a different challenge', async () => {
      const agent = await register();
      const authenticator = makeAuthenticator();
      await enable(agent, authenticator);

      // même identifiant de credential, mais signature produite par une autre clé
      const fresh = agentFor(app);
      const opts = await fresh.post('/api/auth/passkeys/login/options').send({}).expect(201);
      const forged = { ...makeAuthenticator().assert(opts.body.challenge, 1), id: authenticator.id, rawId: authenticator.id };
      const bad = await fresh.post('/api/auth/passkeys/login/verify').send(forged).expect(401);
      expect(bad.body.code).toBe('PASSKEY_INVALID');

      await agent.post('/api/auth/passkeys/register/options').send({}).expect(201);
      const wrong = await agent.post('/api/auth/passkeys/register/verify').send(makeAuthenticator().attest(b64(randomBytes(32)))).expect(400);
      expect(wrong.body.code).toBe('PASSKEY_INVALID');
    });
  });
});
