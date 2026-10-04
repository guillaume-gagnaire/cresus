import { Body, Controller, Delete, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { MeDto } from '@matreso/engine';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Request, Response } from 'express';
import { AppError } from '../common/app-error.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Public } from '../common/public.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { type AppConfig, CONFIG } from '../config.js';
import { AuthService } from './auth.service.js';
import { setSessionCookie } from './cookies.js';
import { PasskeyService } from './passkey.service.js';
import { SessionService } from './session.service.js';

const CHALLENGE_COOKIE = 'mt_webauthn';

@Controller('auth/passkeys')
export class PasskeyController {
  constructor(
    private readonly passkeys: PasskeyService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private setChallenge(res: Response, challenge: string, userId?: string): void {
    res.cookie(CHALLENGE_COOKIE, JSON.stringify({ challenge, userId }), {
      httpOnly: true, sameSite: 'strict', secure: this.config.cookieSecure, signed: true, maxAge: 5 * 60_000, path: '/api/auth/passkeys',
    });
  }

  private takeChallenge(req: Request, res: Response): { challenge: string; userId?: string } {
    const raw: unknown = req.signedCookies?.[CHALLENGE_COOKIE];
    res.clearCookie(CHALLENGE_COOKIE, { path: '/api/auth/passkeys' });
    if (typeof raw !== 'string') throw new AppError(400, 'PASSKEY_EXPIRED', 'La demande a expiré. Réessaie.');
    return JSON.parse(raw) as { challenge: string; userId?: string };
  }

  @Post('register/options')
  async registerOptions(@CurrentUser() userId: string, @Res({ passthrough: true }) res: Response) {
    const options = await this.passkeys.registrationOptions(userId);
    this.setChallenge(res, options.challenge, userId);
    return options;
  }

  @Post('register/verify')
  async registerVerify(@CurrentUser() userId: string, @Body() body: RegistrationResponseJSON, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const pending = this.takeChallenge(req, res);
    if (pending.userId !== userId) throw new AppError(400, 'PASSKEY_EXPIRED', 'La demande a expiré. Réessaie.');
    await this.passkeys.verifyRegistration(userId, body, pending.challenge);
    return this.auth.me(userId);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login/options')
  async loginOptions(@Res({ passthrough: true }) res: Response) {
    const options = await this.passkeys.authenticationOptions();
    this.setChallenge(res, options.challenge);
    return options;
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login/verify')
  @HttpCode(200)
  async loginVerify(@Body() body: AuthenticationResponseJSON, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const pending = this.takeChallenge(req, res);
    const userId = await this.passkeys.verifyAuthentication(body, pending.challenge);
    setSessionCookie(res, await this.sessions.create(userId), this.config);
    return this.auth.me(userId);
  }

  @Delete()
  @HttpCode(204)
  async disable(@CurrentUser() userId: string): Promise<void> {
    await this.passkeys.deleteAll(userId);
  }
}
