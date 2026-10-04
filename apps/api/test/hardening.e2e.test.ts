import { HttpException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/common/app-error.js';
import { AppErrorFilter } from '../src/common/error.filter.js';
import { ZodPipe } from '../src/common/zod.pipe.js';
import { openDb } from '../src/db/client.js';

function fakeHost() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const host = { switchToHttp: () => ({ getResponse: () => res }) };
  return { res, host: host as unknown as Parameters<AppErrorFilter['catch']>[1] };
}

afterEach(() => vi.restoreAllMocks());

describe('durcissements (R13)', () => {
  it('maps zod default messages (including Unrecognized key) to a French generic message', () => {
    const pipe = new ZodPipe(z.object({ a: z.string() }).strict());
    expect(() => pipe.transform({ a: 'x', b: 1 })).toThrowError(expect.objectContaining({ status: 400, message: 'Données invalides.' }));
    expect(() => pipe.transform({})).toThrowError(expect.objectContaining({ message: 'Données invalides.' }));
  });

  it('logs unexpected errors with their stack on the console when asked to, and answers 500', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res, host } = fakeHost();
    const boom = new Error('boom');
    new AppErrorFilter(true).catch(boom, host);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(boom.stack);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }));
  });

  it('uses the Nest logger otherwise, stays quiet for expected errors, and stringifies non-Error throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const filter = new AppErrorFilter();
    filter.catch(new Error('boom'), fakeHost().host);
    filter.catch('texte brut', fakeHost().host);
    expect(loggerError).toHaveBeenCalledTimes(2);
    expect(loggerError).toHaveBeenLastCalledWith('texte brut');
    expect(consoleError).not.toHaveBeenCalled();

    const quiet = new AppErrorFilter(true);
    const app = fakeHost();
    quiet.catch(new AppError(409, 'X', 'conflit'), app.host);
    quiet.catch(new HttpException('nope', 404), fakeHost().host);
    quiet.catch(new HttpException('slow down', 429), fakeHost().host);
    expect(app.res.status).toHaveBeenCalledWith(409);
    expect(consoleError).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledTimes(2);
  });

  it('survives an error emitted on the pg pool (idle client failure)', async () => {
    const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const handle = await openDb('postgres://u:p@127.0.0.1:1/db');
    const pool = (handle.db as unknown as { $client: { emit(event: string, err: Error): boolean } }).$client;
    expect(() => pool.emit('error', new Error('connexion perdue'))).not.toThrow();
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('connexion perdue'), expect.any(String));
    await handle.close();
  });
});
