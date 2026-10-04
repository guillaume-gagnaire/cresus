import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';

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
      expect(served.imports).toHaveLength(unset.imports!.length + 1);
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
    expect(module.imports).toHaveLength(unset.imports!.length);
  });
});
