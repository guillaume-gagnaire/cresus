import { Body, Controller, Delete, HttpCode, Inject, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { AccountDto } from '@cresus/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import { type AuthedRequest, CurrentAccount } from '../common/current-account.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type AppConfig, CONFIG } from '../config.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie } from './cookies.js';
import { changePasswordSchema, deleteAccountSchema, renameSchema } from './schemas.js';
import { SessionService } from './session.service.js';

@Controller('account')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Patch()
  rename(@CurrentAccount() accountId: string, @Body(new ZodPipe(renameSchema)) body: z.infer<typeof renameSchema>): Promise<AccountDto> {
    return this.auth.rename(accountId, body.name);
  }

  @UseGuards(RateLimitGuard)
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentAccount() accountId: string,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ): Promise<void> {
    await this.auth.changePassword(accountId, body.currentPassword, body.newPassword);
    // les autres téléphones doivent se reconnecter avec le nouveau mot de passe ; celui-ci reste connecté
    await this.sessions.destroyOthers(accountId, req.sessionToken as string);
  }

  @UseGuards(RateLimitGuard)
  @Delete()
  @HttpCode(204)
  async remove(
    @CurrentAccount() accountId: string,
    @Body(new ZodPipe(deleteAccountSchema)) body: z.infer<typeof deleteAccountSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(accountId, body.password);
    clearSessionCookie(res, this.config);
  }
}
