import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from './app-error.js';

/** Valide le corps avec un schéma zod. Les messages zod personnalisés (en français) sont renvoyés tels quels. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issue = result.error.issues[0];
    const custom = issue?.message && !/^(Invalid|Expected|Required|Too |Unrecognized)/i.test(issue.message);
    throw new AppError(400, 'VALIDATION', custom ? issue.message : 'Données invalides.');
  }
}
