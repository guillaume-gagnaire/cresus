import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error.js';

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
    const detail = exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
    if (this.logToConsole) console.error(`[Errors] ${detail}`);
    else this.logger.error(detail);
    res.status(500).json({ statusCode: 500, code: 'INTERNAL', message: 'Une erreur est survenue. Réessaie dans un instant.' });
  }
}
