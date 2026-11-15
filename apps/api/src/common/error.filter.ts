import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { Response } from 'express';
import { AppError } from './app-error.js';

const QUERY_PREFIX = 'Failed query: ';

const framesOf = (e: Error): string[] => (e.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line));

/**
 * Texte journalisé pour une erreur inattendue. Le message et la stack d'une erreur de requête drizzle
 * (« Failed query: … params: … ») contiennent les paramètres (e-mail, hash, montants…) : on n'en garde
 * que le SQL, les frames de la stack et la cause (erreur PostgreSQL), jamais les paramètres.
 */
export function describeError(exception: unknown): string {
  if (!(exception instanceof Error)) return String(exception);
  const isQueryError = exception instanceof DrizzleQueryError || exception.message.startsWith(QUERY_PREFIX);
  if (!isQueryError) return exception.stack ?? exception.message;
  const sqlText = exception instanceof DrizzleQueryError ? exception.query : exception.message.slice(QUERY_PREFIX.length).split('\nparams:')[0];
  const cause = exception.cause;
  const causeText = cause instanceof Error ? (cause.stack ?? cause.message) : cause === undefined ? '' : String(cause);
  return [QUERY_PREFIX + sqlText, ...framesOf(exception), ...(causeText ? [`Caused by: ${causeText}`] : [])].join('\n');
}

@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  /** `logToConsole` : écrit aussi sur la console, car le logger Nest est désactivé en test (sinon une 500 resterait muette). */
  constructor(private readonly logToConsole = false) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppError) {
      res.status(exception.status).json(exception.body());
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = status === 404 ? 'Introuvable.' : status === 429 ? 'Trop de tentatives. Réessaie dans une minute.' : 'Requête invalide.';
      const code = status === 404 ? 'NOT_FOUND' : status === 429 ? 'TOO_MANY_REQUESTS' : 'HTTP_ERROR';
      res.status(status).json({ statusCode: status, code, message });
      return;
    }
    const detail = describeError(exception);
    if (this.logToConsole) console.error(`[Errors] ${detail}`);
    else this.logger.error(detail);
    res.status(500).json({ statusCode: 500, code: 'INTERNAL', message: 'Une erreur est survenue. Réessaie dans un instant.' });
  }
}
