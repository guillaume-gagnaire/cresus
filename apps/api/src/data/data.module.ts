import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BalanceController } from './balance.controller.js';
import { BalanceService } from './balance.service.js';
import { ChargesController } from './charges.controller.js';
import { ChargesService } from './charges.service.js';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { LeavesController } from './leaves.controller.js';
import { LeavesService } from './leaves.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { StateController } from './state.controller.js';
import { StateService } from './state.service.js';
import { TransferController } from './transfer.controller.js';
import { TransferService } from './transfer.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StateController, ProfileController, BalanceController, ClientsController, LeavesController, ChargesController, TransferController],
  providers: [StateService, ProfileService, BalanceService, ClientsService, LeavesService, ChargesService, TransferService],
  exports: [StateService, ProfileService, BalanceService, ClientsService, LeavesService, ChargesService, TransferService],
})
export class DataModule {}
