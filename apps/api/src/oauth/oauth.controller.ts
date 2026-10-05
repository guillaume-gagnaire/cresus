import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { OAuthProvider } from './oauth.provider.js';
import { OAuthStore } from './oauth.store.js';

/** Consentement d'une demande d'autorisation OAuth : session obligatoire (garde global), POST en JSON seulement (anti-CSRF). */
@Controller('oauth/requests')
export class OAuthController {
  constructor(private readonly oauth: OAuthProvider) {}

  @Get(':id')
  describe(@Param('id') id: string): Promise<{ clientName: string; redirectHost: string; scope: string }> {
    return this.oauth.describeRequest(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approve(@CurrentUser() userId: string, @Param('id') id: string): Promise<{ redirectUrl: string }> {
    return { redirectUrl: await this.oauth.approveRequest(id, userId) };
  }

  @Post(':id/deny')
  @HttpCode(200)
  async deny(@Param('id') id: string): Promise<{ redirectUrl: string }> {
    return { redirectUrl: await this.oauth.denyRequest(id) };
  }
}

/** Gestion des accès accordés aux applications (Claude Code…) : session obligatoire (garde global), POST en JSON seulement (anti-CSRF). */
@Controller('oauth/tokens')
export class OAuthTokensController {
  constructor(private readonly store: OAuthStore) {}

  /** Révoque tous les jetons OAuth du compte : les applications connectées doivent redemander l'autorisation. */
  @Post('revoke-all')
  @HttpCode(200)
  async revokeAll(@CurrentUser() userId: string): Promise<{ revoked: number }> {
    return { revoked: await this.store.revokeAllForUser(userId) };
  }
}
