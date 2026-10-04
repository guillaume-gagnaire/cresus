import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard, RateLimitStore } from '../common/rate-limit.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasskeyController } from './passkey.controller.js';
import { PasskeyService } from './passkey.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController, PasskeyController],
  providers: [AuthService, PasskeyService, SessionService, RateLimitStore, RateLimitGuard, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService, SessionService, RateLimitStore],
})
export class AuthModule {}
