import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { setupTestApp } from './helpers.js';

describe('durcissements', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await setupTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('pose les en-têtes de sécurité', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('refuse une mutation qui n’est pas en JSON', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').set('Content-Type', 'text/plain').send('x').expect(415);
    expect(res.body.code).toBe('JSON_REQUIRED');
  });

  it('répond 404 en JSON sur une route inconnue', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});

describe('configuration de production', () => {
  it('exige SESSION_SECRET puis DATABASE_URL', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
    const config = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), DATABASE_URL: 'postgres://u:p@h:5432/d' });
    expect(config.cookieSecure).toBe(true);
    expect(config.authRateLimit).toBe(30);
  });
});
