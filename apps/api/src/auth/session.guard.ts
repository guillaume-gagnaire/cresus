import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/app-error.js';
import type { AuthedRequest } from '../common/current-user.decorator.js';
import { IS_PUBLIC } from '../common/public.decorator.js';
import { SESSION_COOKIE } from './cookies.js';
import { SessionService } from './session.service.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const userId = typeof token === 'string' ? await this.sessions.validate(token) : null;
    if (!userId) throw new AppError(401, 'UNAUTHENTICATED', 'Connecte-toi pour continuer.');
    req.userId = userId;
    req.sessionToken = token as string;
    return true;
  }
}
