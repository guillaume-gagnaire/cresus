import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AppError } from '../common/app-error.js';
import type { AuthedRequest } from '../common/current-user.decorator.js';
import { IS_PUBLIC } from '../common/public.decorator.js';
import { type AppConfig, CONFIG } from '../config.js';
import { SESSION_COOKIE, setSessionCookie } from './cookies.js';
import { SessionService } from './session.service.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const http = ctx.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const session = typeof token === 'string' ? await this.sessions.validate(token) : null;
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Connecte-toi pour continuer.');
    // expiration glissante : le navigateur ne la voit que si on ré-émet le cookie
    if (session.renewed) setSessionCookie(http.getResponse<Response>(), token as string, this.config);
    req.userId = session.userId;
    req.sessionToken = token as string;
    return true;
  }
}
