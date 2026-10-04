import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { LeaveDto } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { deleteLeavesSchema, leavesInputSchema, LeavesService } from './leaves.service.js';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(leavesInputSchema)) body: z.infer<typeof leavesInputSchema>): Promise<{ leaves: LeaveDto[]; created: number }> {
    return this.leaves.create(userId, body);
  }

  @Post('delete')
  @HttpCode(200)
  remove(@CurrentUser() userId: string, @Body(new ZodPipe(deleteLeavesSchema)) body: z.infer<typeof deleteLeavesSchema>): Promise<{ deleted: number }> {
    return this.leaves.remove(userId, body.ids);
  }
}
