import type { ApiErrorBody } from '@matreso/engine';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  body(): ApiErrorBody {
    return { statusCode: this.status, code: this.code, message: this.message };
  }
}

export const notFound = (what = 'Élément'): AppError => new AppError(404, 'NOT_FOUND', `${what} introuvable.`);
