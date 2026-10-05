import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers.js';

const BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};
const HSTS = 'max-age=31536000; includeSubDomains';

/** Réponses de natures différentes : API, erreur, OAuth (routeur du SDK), MCP, front servi par l'API, repli SPA, 404. */
const PATHS = ['/api/health', '/api/auth/me', '/.well-known/oauth-authorization-server', '/mcp', '/', '/profile', '/nope.js'];

function suite(label: string, production: boolean) {
  describe(label, () => {
    let app: NestExpressApplication;
    let dir: string;
    beforeAll(async () => {
      dir = mkdtempSync(join(tmpdir(), 'matreso-web-headers-'));
      writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');
      app = await setupTestApp({ WEB_DIST: dir, ...(production ? { NODE_ENV: 'production', PUBLIC_URL: 'https://cresus.example.test' } : {}) });
    });
    afterAll(async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('sets nosniff, a strict referrer policy and no-framing on every kind of response', async () => {
      for (const path of PATHS) {
        const res = await request(app.getHttpServer()).get(path);
        for (const [name, value] of Object.entries(BASE_HEADERS)) expect(res.headers[name], `${path} ${name}`).toBe(value);
      }
    });

    it(production ? 'sends HSTS (one year, subdomains) in production' : 'does not send HSTS outside production', async () => {
      for (const path of PATHS) {
        const res = await request(app.getHttpServer()).get(path);
        if (production) expect(res.headers['strict-transport-security'], path).toBe(HSTS);
        else expect(res.headers['strict-transport-security'], path).toBeUndefined();
      }
    });

    it('does not advertise Express', async () => {
      expect((await request(app.getHttpServer()).get('/api/health')).headers['x-powered-by']).toBeUndefined();
    });

    it('also covers POST preflight-style and error answers (415, 404)', async () => {
      const bad = await request(app.getHttpServer()).post('/api/auth/login').type('form').send({ a: 1 });
      expect(bad.status).toBe(415);
      expect(bad.headers['x-frame-options']).toBe('DENY');
      const missing = await request(app.getHttpServer()).get('/api/inconnu');
      expect(missing.headers['x-content-type-options']).toBe('nosniff');
    });
  });
}

suite('security headers (test environment)', false);
suite('security headers (production)', true);
