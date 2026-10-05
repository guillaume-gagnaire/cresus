import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';
import { setupTestApp } from './helpers.js';

const configWith = (webDist?: string) =>
  loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'pglite:memory', SESSION_SECRET: 'test-secret-test-secret', ...(webDist ? { WEB_DIST: webDist } : {}) });

afterEach(() => vi.restoreAllMocks());

describe('AppModule.register : service du front (WEB_DIST)', () => {
  it('serves the front only when WEB_DIST is an existing directory, without any warning', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const unset = AppModule.register(configWith());
    expect(warn).not.toHaveBeenCalled();
    const dir = mkdtempSync(join(tmpdir(), 'matreso-web-'));
    try {
      const served = AppModule.register(configWith(dir));
      expect(warn).not.toHaveBeenCalled();
      expect(served.providers).toHaveLength(unset.providers!.length + 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns and serves nothing when WEB_DIST points to a missing directory', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const missing = join(tmpdir(), 'matreso-web-inexistant');
    const unset = AppModule.register(configWith());
    const module = AppModule.register(configWith(missing));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toBe(`WEB_DIST introuvable : ${missing} — le front ne sera pas servi`);
    expect(module.providers).toHaveLength(unset.providers!.length);
  });
});

describe('front servi par l’API : en-têtes de cache et repli SPA', () => {
  const NO_CACHE = 'no-cache';
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  let app: NestExpressApplication;
  let root: string;
  let dir: string;
  beforeAll(async () => {
    // dans un dossier caché, comme le `.output/public` de Nuxt : le repli SPA doit y répondre aussi
    root = mkdtempSync(join(tmpdir(), 'matreso-web-cache-'));
    dir = join(root, '.output', 'public');
    const files: Record<string, string> = {
      'index.html': '<!doctype html><title>spa</title>',
      'sw.js': '// service worker',
      'manifest.webmanifest': '{}',
      'calendar/index.html': '<!doctype html><title>spa</title>',
      '_nuxt/entry.Cx7Ab12Z.js': 'export {}',
      '_nuxt/builds/latest.json': '{"id":"abc"}',
      '_nuxt/builds/meta/abc.json': '{"id":"abc"}',
    };
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(join(dir, file, '..'), { recursive: true });
      writeFileSync(join(dir, file), content);
    }
    app = await setupTestApp({ WEB_DIST: dir });
  });
  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const http = () => request(app.getHttpServer());

  it('revalidates the shell, the service worker, the manifest and the app manifest of Nuxt', async () => {
    for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/_nuxt/builds/latest.json', '/_nuxt/builds/meta/abc.json']) {
      expect((await http().get(path).expect(200)).headers['cache-control'], path).toBe(NO_CACHE);
    }
  });

  it('keeps the fingerprinted assets immutable', async () => {
    expect((await http().get('/_nuxt/entry.Cx7Ab12Z.js').expect(200)).headers['cache-control']).toBe(IMMUTABLE);
  });

  it('answers the SPA shell (revalidated) on client routes, even those named after a prerendered folder, without redirecting', async () => {
    for (const path of ['/calendar', '/clients/new', '/oauth/consent?request=abc']) {
      const res = await http().get(path).expect(200);
      expect(res.text, path).toContain('<title>spa</title>');
      expect(res.headers['cache-control'], path).toBe(NO_CACHE);
    }
  });

  it('lets the API win over the SPA fallback, whatever the case of the path', async () => {
    for (const path of ['/api/health', '/API/health', '/Api/Health']) {
      const res = await http().get(path).expect(200);
      expect(res.body, path).toEqual({ status: 'ok', db: 'ok' });
    }
    expect((await http().get('/API/inconnu').expect(404)).text).not.toContain('<title>spa</title>');
    expect((await http().get('/Mcp').expect(401)).text).not.toContain('<title>spa</title>');
  });
});
