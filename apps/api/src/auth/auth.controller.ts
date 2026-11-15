import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { AccountDto } from '@cresus/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import { type AuthedRequest, CurrentAccount } from '../common/current-account.decorator.js';
import { Public } from '../common/public.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type AppConfig, CONFIG } from '../config.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, setSessionCookie } from './cookies.js';
import { loginSchema, signupSchema } from './schemas.js';
import { SessionService } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('signup')
  async signup(@Body(new ZodPipe(signupSchema)) body: z.infer<typeof signupSchema>, @Res({ passthrough: true }) res: Response): Promise<AccountDto> {
    const account = await this.auth.signup(body);
    setSessionCookie(res, await this.sessions.create(account.id), this.config);
    return account;
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Res({ passthrough: true }) res: Response): Promise<AccountDto> {
    const account = await this.auth.login(body.email, body.password);
    setSessionCookie(res, await this.sessions.create(account.id), this.config);
    return account;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.sessionToken) await this.sessions.destroy(req.sessionToken);
    clearSessionCookie(res, this.config);
  }

  @Get('me')
  me(@CurrentAccount() accountId: string): Promise<AccountDto> {
    return this.auth.me(accountId);
  }
}
