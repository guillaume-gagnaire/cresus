import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard, RateLimitStore } from '../common/rate-limit.guard.js';
import { AccountController } from './account.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

@Global()
@Module({
  controllers: [AuthController, AccountController],
  providers: [AuthService, SessionService, RateLimitStore, RateLimitGuard, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [SessionService, RateLimitStore, RateLimitGuard],
})
export class AuthModule {}
