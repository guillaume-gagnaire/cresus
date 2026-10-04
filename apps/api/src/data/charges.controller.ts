import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { StateDto } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { chargeInputSchema, chargePatchSchema, ChargesService } from './charges.service.js';

type ChargeDto = StateDto['charges'][number];

@Controller('charges')
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(chargeInputSchema)) body: z.infer<typeof chargeInputSchema>): Promise<ChargeDto> {
    return this.charges.create(userId, body);
  }

  @Patch(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body(new ZodPipe(chargePatchSchema)) body: z.infer<typeof chargePatchSchema>): Promise<ChargeDto> {
    return this.charges.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
    return this.charges.remove(userId, id);
  }
}
