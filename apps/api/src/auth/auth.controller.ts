import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { MeDto } from '@matreso/engine';
import type { Response } from 'express';
import { z } from 'zod';
import { type AuthedRequest, CurrentUser } from '../common/current-user.decorator.js';
import { Public } from '../common/public.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type AppConfig, CONFIG } from '../config.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, setSessionCookie } from './cookies.js';
import { SessionService } from './session.service.js';

const email = z.string().trim().toLowerCase().email('E-mail invalide.');
const password = z.string().min(8, 'Ton mot de passe doit faire au moins 8 caractères.').max(200, 'Mot de passe trop long.');
const registerSchema = z.object({ email, password, firstName: z.string().trim().min(1, 'Indique ton prénom.').max(60, 'Prénom trop long.') });
const loginSchema = z.object({ email, password: z.string().min(1, 'Indique ton mot de passe.') });
const passwordSchema = z.object({ currentPassword: z.string().min(1, 'Indique ton mot de passe actuel.'), newPassword: password });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('register')
  async register(@Body(new ZodPipe(registerSchema)) body: z.infer<typeof registerSchema>, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const userId = await this.auth.register(body);
    setSessionCookie(res, await this.sessions.create(userId), this.config);
    return this.auth.me(userId);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Res({ passthrough: true }) res: Response): Promise<MeDto> {
    const userId = await this.auth.login(body.email, body.password);
    setSessionCookie(res, await this.sessions.create(userId), this.config);
    return this.auth.me(userId);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.sessionToken) await this.sessions.destroy(req.sessionToken);
    clearSessionCookie(res, this.config);
  }

  @Get('me')
  me(@CurrentUser() userId: string): Promise<MeDto> {
    return this.auth.me(userId);
  }

  @UseGuards(RateLimitGuard)
  @Patch('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() userId: string,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(passwordSchema)) body: z.infer<typeof passwordSchema>,
  ): Promise<void> {
    await this.auth.changePassword(userId, body.currentPassword, body.newPassword);
    // les autres appareils doivent se reconnecter avec le nouveau mot de passe ; la session courante est conservée
    await this.sessions.destroyOthersForUser(userId, req.sessionToken as string);
  }
}
