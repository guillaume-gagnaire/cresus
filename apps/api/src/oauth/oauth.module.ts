import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller.js';
import { OAuthProvider } from './oauth.provider.js';
import { OAuthStore } from './oauth.store.js';

/** DbModule et la configuration sont globaux ; SessionGuard est un garde global (AuthModule). */
@Module({
  controllers: [OAuthController],
  providers: [OAuthStore, OAuthProvider],
  exports: [OAuthProvider],
})
export class OAuthModule {}
