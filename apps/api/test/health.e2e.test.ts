import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers.js';

describe('health', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  afterAll(async () => { await app.close(); });

  it('reports ok with the database reachable', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('rejects non-JSON mutations (CSRF guard)', async () => {
    const res = await request(app.getHttpServer()).post('/api/health').type('form').send('a=1').expect(415);
    expect(res.body.code).toBe('JSON_REQUIRED');
  });

  it('answers unknown API routes with a JSON 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
