import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BalanceController } from './balance.controller.js';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { ProfileController } from './profile.controller.js';
import { StateController } from './state.controller.js';
import { StateService } from './state.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StateController, ProfileController, BalanceController, ClientsController],
  providers: [StateService, ClientsService],
  exports: [StateService, ClientsService],
})
export class DataModule {}
