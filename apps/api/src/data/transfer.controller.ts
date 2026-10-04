import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Res, UseGuards } from '@nestjs/common';
import type { ExportFileV1, StateDto } from '@matreso/engine';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { clearSessionCookie } from '../auth/cookies.js';
import { AppError } from '../common/app-error.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type AppConfig, CONFIG } from '../config.js';
import { exportFileSchema } from './export.schema.js';
import { TransferService } from './transfer.service.js';

const deleteSchema = z.object({ password: z.string().min(1, 'Indique ton mot de passe.') }).strict();

@Controller()
export class TransferController {
  constructor(
    private readonly transfer: TransferService,
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('export')
  export(@CurrentUser() userId: string): Promise<ExportFileV1> {
    return this.transfer.exportFile(userId);
  }

  @Post('import')
  import(@CurrentUser() userId: string, @Body() body: unknown): Promise<StateDto> {
    const parsed = exportFileSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, 'INVALID_FILE', 'Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
    return this.transfer.importFile(userId, parsed.data);
  }

  /** Vérifie le mot de passe : même compteur par IP que /auth, sinon cette route serait un oracle de mot de passe sans limite. */
  @Delete('account')
  @UseGuards(RateLimitGuard)
  @HttpCode(204)
  async deleteAccount(@CurrentUser() userId: string, @Body(new ZodPipe(deleteSchema)) body: z.infer<typeof deleteSchema>, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.checkPassword(userId, body.password);
    await this.transfer.deleteAccount(userId);
    clearSessionCookie(res, this.config);
  }
}
