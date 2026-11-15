import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { SummaryService } from './summary.service.js';

@Module({
  controllers: [EventsController, ArticlesController, SalesController],
  providers: [EventsService, ArticlesService, SummaryService, SalesService],
  exports: [EventsService, SummaryService],
})
export class EventsModule {}
