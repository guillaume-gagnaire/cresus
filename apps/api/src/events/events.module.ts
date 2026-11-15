import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { SummaryService } from './summary.service.js';
import { LiveBus } from '../live/live.bus.js';
import { LiveGateway } from '../live/live.gateway.js';

@Module({
  controllers: [EventsController, ArticlesController, SalesController, ExportController],
  providers: [EventsService, ArticlesService, SummaryService, SalesService, ExportService, LiveBus, LiveGateway],
  exports: [EventsService, SummaryService, ExportService],
})
export class EventsModule {}
