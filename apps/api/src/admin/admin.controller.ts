import { Controller, Delete, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { AdminAccountDetailDto, AdminAccountDto, AdminStatsDto, EventDetailDto } from '@cresus/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentAccount } from '../common/current-account.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { sendWorkbook } from '../events/export.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

const searchSchema = z.object({ q: z.string().max(100).optional() });

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }

  @Get('accounts')
  accounts(@Query(new ZodPipe(searchSchema)) query: z.infer<typeof searchSchema>): Promise<AdminAccountDto[]> {
    return this.admin.accounts(query.q);
  }

  @Get('accounts/:id')
  account(@Param('id') id: string): Promise<AdminAccountDetailDto> {
    return this.admin.account(id);
  }

  @Post('accounts/:id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id') id: string): Promise<{ password: string }> {
    return this.admin.resetPassword(id);
  }

  @Delete('accounts/:id')
  @HttpCode(204)
  remove(@CurrentAccount() adminId: string, @Param('id') id: string): Promise<void> {
    return this.admin.deleteAccount(adminId, id);
  }

  @Get('events/:id')
  event(@Param('id') id: string): Promise<EventDetailDto> {
    return this.admin.event(id);
  }

  @Get('events/:id/export')
  async export(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await sendWorkbook(res, await this.admin.exportEvent(id));
  }
}
