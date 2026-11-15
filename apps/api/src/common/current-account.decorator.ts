import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthedRequest extends Request {
  accountId?: string;
  sessionToken?: string;
}

/** Identifiant du compte (asso) connecté, posé par SessionGuard. */
export const CurrentAccount = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.accountId!;
});
