import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasskeyController } from './passkey.controller.js';
import { PasskeyService } from './passkey.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController, PasskeyController],
  providers: [AuthService, PasskeyService, SessionService, RateLimitGuard, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
