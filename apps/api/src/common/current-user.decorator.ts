import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthedRequest extends Request {
  userId?: string;
  sessionToken?: string;
}

/** Identifiant de l'utilisateur connecté (posé par SessionGuard). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.userId!;
});
