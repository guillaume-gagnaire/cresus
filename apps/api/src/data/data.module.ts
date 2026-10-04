import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BalanceController } from './balance.controller.js';
import { ProfileController } from './profile.controller.js';
import { StateController } from './state.controller.js';
import { StateService } from './state.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StateController, ProfileController, BalanceController],
  providers: [StateService],
  exports: [StateService],
})
export class DataModule {}
