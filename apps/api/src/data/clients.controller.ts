import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { Client } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { clientInputSchema, clientPatchSchema, ClientsService, rateSchema } from './clients.service.js';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body(new ZodPipe(clientInputSchema)) body: z.infer<typeof clientInputSchema>): Promise<Client> {
    return this.clients.create(userId, body);
  }

  @Patch(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body(new ZodPipe(clientPatchSchema)) body: z.infer<typeof clientPatchSchema>): Promise<Client> {
    return this.clients.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string): Promise<void> {
    return this.clients.remove(userId, id);
  }

  @Post(':id/rates')
  addRate(@CurrentUser() userId: string, @Param('id') id: string, @Body(new ZodPipe(rateSchema)) body: z.infer<typeof rateSchema>): Promise<Client> {
    return this.clients.upsertRate(userId, id, body);
  }

  @Delete(':id/rates/:rateId')
  removeRate(@CurrentUser() userId: string, @Param('id') id: string, @Param('rateId') rateId: string): Promise<Client> {
    return this.clients.removeRate(userId, id, rateId);
  }
}
