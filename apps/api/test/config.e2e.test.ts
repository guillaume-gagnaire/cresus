import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const prod = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'prod-secret-prod-secret',
  DATABASE_URL: 'postgres://u:p@db:5432/matreso',
  PUBLIC_URL: 'https://cresus.gagnaire.dev',
};

describe('loadConfig (production rules)', () => {
  it('requires SESSION_SECRET, PUBLIC_URL and DATABASE_URL, treating an empty value as missing', () => {
    expect(() => loadConfig({ ...prod, SESSION_SECRET: undefined })).toThrow('SESSION_SECRET est obligatoire en production');
    expect(() => loadConfig({ ...prod, PUBLIC_URL: undefined })).toThrow('PUBLIC_URL est obligatoire en production');
    expect(() => loadConfig({ ...prod, PUBLIC_URL: '' })).toThrow('PUBLIC_URL est obligatoire en production');
    expect(() => loadConfig({ ...prod, DATABASE_URL: undefined })).toThrow('DATABASE_URL est obligatoire en production');
    expect(() => loadConfig({ ...prod, DATABASE_URL: '' })).toThrow('DATABASE_URL est obligatoire en production');
    expect(() => loadConfig({ ...prod, DATABASE_URL: '   ' })).toThrow('DATABASE_URL est obligatoire en production');
    expect(loadConfig(prod).databaseUrl).toBe(prod.DATABASE_URL);
  });

  it('derives the WebAuthn RP ID (hostname) and origin from PUBLIC_URL when they are not set', () => {
    expect(loadConfig(prod).webauthn).toMatchObject({ rpId: 'cresus.gagnaire.dev', origin: 'https://cresus.gagnaire.dev', rpName: 'Ma Tréso' });
    // port conservé dans l'origine, absent du RP ID ; « / » final ignoré
    expect(loadConfig({ ...prod, PUBLIC_URL: 'https://cresus.example.org:8443/' }).webauthn).toMatchObject({ rpId: 'cresus.example.org', origin: 'https://cresus.example.org:8443' });
    // une valeur vide (`WEBAUTHN_RP_ID=` dans un .env) équivaut à une valeur absente
    expect(loadConfig({ ...prod, WEBAUTHN_RP_ID: '', WEBAUTHN_ORIGIN: '' }).webauthn).toMatchObject({ rpId: 'cresus.gagnaire.dev', origin: 'https://cresus.gagnaire.dev' });
  });

  it('lets explicit WebAuthn values win over the derivation', () => {
    const config = loadConfig({ ...prod, WEBAUTHN_RP_ID: 'gagnaire.dev', WEBAUTHN_ORIGIN: 'https://app.gagnaire.dev' });
    expect(config.webauthn).toMatchObject({ rpId: 'gagnaire.dev', origin: 'https://app.gagnaire.dev' });
  });

  it('rejects a PUBLIC_URL with a path, query or fragment, or that is not http(s)', () => {
    expect(() => loadConfig({ ...prod, PUBLIC_URL: 'https://cresus.gagnaire.dev/app' })).toThrow('PUBLIC_URL ne doit pas contenir de chemin');
    for (const bad of ['https://cresus.gagnaire.dev/?a=1', 'https://cresus.gagnaire.dev/#x', 'ftp://cresus.gagnaire.dev', 'cresus.gagnaire.dev']) {
      expect(() => loadConfig({ ...prod, PUBLIC_URL: bad }), bad).toThrow(/PUBLIC_URL/);
    }
  });

  it('turns Secure cookies on by default, unless COOKIE_SECURE says otherwise', () => {
    expect(loadConfig(prod).cookieSecure).toBe(true);
    expect(loadConfig({ ...prod, COOKIE_SECURE: 'false' }).cookieSecure).toBe(false);
  });
});

describe('loadConfig (development and test defaults)', () => {
  const dev = { NODE_ENV: 'development' };

  it('keeps the local defaults: PGlite folder, localhost WebAuthn, local public URL', () => {
    const config = loadConfig(dev);
    expect(config).toMatchObject({
      databaseUrl: 'pglite:./.data/pglite',
      publicUrl: 'http://localhost:3000',
      cookieSecure: false,
      webauthn: { rpId: 'localhost', origin: 'http://localhost:3000' },
    });
    expect(loadConfig({ ...dev, DATABASE_URL: '' }).databaseUrl).toBe('pglite:./.data/pglite');
  });

  it('does not derive WebAuthn from PUBLIC_URL outside production (explicit values only)', () => {
    expect(loadConfig({ ...dev, PUBLIC_URL: 'https://cresus.gagnaire.dev' }).webauthn).toMatchObject({ rpId: 'localhost', origin: 'http://localhost:3000' });
    expect(loadConfig({ ...dev, WEBAUTHN_RP_ID: 'example.test', WEBAUTHN_ORIGIN: 'http://example.test:4000' }).webauthn).toMatchObject({ rpId: 'example.test', origin: 'http://example.test:4000' });
  });
});
