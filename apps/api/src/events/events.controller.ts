import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { EventDetailDto, EventDto } from '@cresus/shared';
import type { z } from 'zod';
import { CurrentAccount } from '../common/current-account.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { EventsService } from './events.service.js';
import { createEventSchema, updateEventSchema } from './schemas.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentAccount() accountId: string): Promise<EventDto[]> {
    return this.events.list(accountId);
  }

  @Post()
  create(@CurrentAccount() accountId: string, @Body(new ZodPipe(createEventSchema)) body: z.infer<typeof createEventSchema>): Promise<EventDto> {
    return this.events.create(accountId, body);
  }

  @Get(':id')
  detail(@CurrentAccount() accountId: string, @Param('id') id: string): Promise<EventDetailDto> {
    return this.events.detail(accountId, id);
  }

  @Patch(':id')
  update(
    @CurrentAccount() accountId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(updateEventSchema)) body: z.infer<typeof updateEventSchema>,
  ): Promise<EventDto> {
    return this.events.update(accountId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentAccount() accountId: string, @Param('id') id: string): Promise<void> {
    return this.events.remove(accountId, id);
  }
}
