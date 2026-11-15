import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppErrorFilter } from '../src/common/error.filter.js';
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

  it('demande aux moteurs de recherche de ne rien indexer ni suivre, sur toutes les réponses', async () => {
    const ok = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(ok.headers['x-robots-tag']).toBe('noindex, nofollow');
    const missing = await request(app.getHttpServer()).get('/api/nope').expect(404);
    expect(missing.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('refuse une mutation qui n’est pas en JSON', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').set('Content-Type', 'text/plain').send('x').expect(415);
    expect(res.body.code).toBe('JSON_REQUIRED');
  });

  it('laisse passer un DELETE sans corps (aucun formulaire ne peut l’envoyer), refuse un PUT qui n’est pas en JSON', async () => {
    await request(app.getHttpServer()).delete('/api/events/00000000-0000-4000-8000-000000000000').expect(401);
    await request(app.getHttpServer()).put('/api/events/x/articles/order').set('Content-Type', 'text/plain').send('x').expect(415);
  });

  it('parle aux bénévoles en les vouvoyant, même dans les erreurs génériques', async () => {
    const filter = new AppErrorFilter(true);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as Parameters<AppErrorFilter['catch']>[1];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    filter.catch(new Error('boom'), host);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Une erreur est survenue. Réessayez dans un instant.' }));
    vi.restoreAllMocks();
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
