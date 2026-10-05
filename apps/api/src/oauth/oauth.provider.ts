import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
  OAuthError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from '../common/app-error.js';
import { describeError } from '../common/error.filter.js';
import { type AppConfig, CONFIG } from '../config.js';
import { OAUTH_SCOPE, OAuthStore, type TokenPair } from './oauth.store.js';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requestExpired = (): AppError =>
  new AppError(404, 'NOT_FOUND', 'Cette demande d’autorisation a expiré. Relance la connexion depuis Claude Code.');

const withoutFragmentAndTrailingSlash = (href: string): string => href.replace(/#.*$/, '').replace(/\/$/, '');

const toOAuthTokens = (pair: TokenPair): OAuthTokens => ({
  access_token: pair.accessToken,
  token_type: 'bearer',
  expires_in: pair.expiresIn,
  refresh_token: pair.refreshToken,
  scope: pair.scope,
});

/**
 * Serveur d'autorisation OAuth 2.1 : implémente l'interface du SDK MCP (montée par `mcpAuthRouter`) et porte
 * la partie consentement (demande en attente → code), appelée par OAuthController avec la session de l'utilisateur.
 * Les messages d'erreur OAuth restent en anglais ASCII (RFC 6749 §5.2) ; seul le consentement parle à l'utilisateur.
 */
@Injectable()
export class OAuthProvider implements OAuthServerProvider {
  /** Seule ressource protégée : le serveur MCP (RFC 8707). */
  private readonly resourceUrl: string;
  private readonly logger = new Logger('OAuth');

  constructor(
    private readonly store: OAuthStore,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {
    this.resourceUrl = new URL('/mcp', config.publicUrl).href;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId) => this.guarded(() => this.store.getClient(clientId)),
      registerClient: (client) => this.guarded(() => this.store.registerClient(client)),
    };
  }

  /**
   * Enregistre la demande en attente et envoie l'utilisateur sur la page de consentement du front.
   * Le scope demandé est ignoré : le seul scope existant (`cresus`) est toujours celui accordé, et la réponse du jeton l'indique.
   */
  authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    return this.guarded(async () => {
      this.assertResource(params.resource);
      await this.store.purgeExpired();
      const id = await this.store.createRequest({
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        state: params.state ?? null,
        scope: OAUTH_SCOPE,
        resource: params.resource?.href ?? null,
      });
      res.redirect(`${this.config.publicUrl}/oauth/consent?request=${id}`);
    });
  }

  challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    return this.guarded(async () => {
      const challenge = await this.store.codeChallenge(authorizationCode, client.client_id);
      if (!challenge) {
        // un code déjà échangé n'existe plus : s'il est présenté de nouveau, ce qu'il a émis est révoqué
        await this.revokeIfReplayed(authorizationCode);
        throw new InvalidGrantError('Invalid or expired authorization code');
      }
      return challenge;
    });
  }

  /** Le PKCE a déjà été vérifié par le SDK (challengeForAuthorizationCode) ; le code est à usage unique. */
  exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    return this.guarded(async () => {
      this.assertResource(resource);
      const code = await this.store.consumeCode(authorizationCode);
      if (!code) {
        // deux échanges simultanés du même code : le perdant arrive ici
        await this.revokeIfReplayed(authorizationCode);
        throw new InvalidGrantError('Invalid or expired authorization code');
      }
      if (code.expiresAt.getTime() <= Date.now() || code.clientId !== client.client_id) throw new InvalidGrantError('Invalid or expired authorization code');
      if (redirectUri !== code.redirectUri) throw new InvalidGrantError('redirect_uri does not match the authorization request');
      return toOAuthTokens(await this.store.issueTokens({ clientId: code.clientId, userId: code.userId, scope: code.scope, codeHash: code.codeHash }));
    });
  }

  exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    return this.guarded(async () => {
      if (scopes?.some((scope) => scope !== OAUTH_SCOPE)) throw new InvalidScopeError(`The only supported scope is ${OAUTH_SCOPE}`);
      this.assertResource(resource);
      const pair = await this.store.rotateTokens(refreshToken, client.client_id);
      if (!pair) throw new InvalidGrantError('Invalid, expired or revoked refresh token');
      return toOAuthTokens(pair);
    });
  }

  /** Consommé par le serveur MCP (Task 39) : `extra.userId` est l'utilisateur au nom duquel les outils agissent. */
  verifyAccessToken(token: string): Promise<AuthInfo> {
    return this.guarded(async () => {
      const record = await this.store.findAccessToken(token);
      if (!record) throw new InvalidTokenError('Invalid, expired or revoked access token');
      return {
        token,
        clientId: record.clientId,
        scopes: [record.scope],
        expiresAt: Math.floor(record.accessExpiresAt.getTime() / 1000),
        extra: { userId: record.userId },
      };
    });
  }

  /** Jeton inconnu, déjà révoqué ou émis à un autre client : sans effet (RFC 7009 §2.2). */
  revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    return this.guarded(() => this.store.revokeTokens(request.token, client.client_id));
  }

  // --- consentement (utilisateur connecté) -----------------------------------------------------------------------

  async describeRequest(id: string): Promise<{ clientName: string; redirectHost: string; scope: string }> {
    const request = REQUEST_ID.test(id) ? await this.store.findRequest(id) : null;
    if (!request) throw requestExpired();
    return { clientName: request.clientName, redirectHost: new URL(request.redirectUri).host, scope: request.scope };
  }

  /** Renvoie l'URL de redirection du client, avec le code d'autorisation et le `state` d'origine. */
  async approveRequest(id: string, userId: string): Promise<string> {
    const approved = REQUEST_ID.test(id) ? await this.store.approveRequest(id, userId) : null;
    if (!approved) throw requestExpired();
    return this.redirectUrl(approved.redirectUri, approved.state, { code: approved.code });
  }

  async denyRequest(id: string): Promise<string> {
    const denied = REQUEST_ID.test(id) ? await this.store.denyRequest(id) : null;
    if (!denied) throw requestExpired();
    return this.redirectUrl(denied.redirectUri, denied.state, { error: 'access_denied' });
  }

  private redirectUrl(redirectUri: string, state: string | null, params: Record<string, string>): string {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (state) url.searchParams.set('state', state);
    return url.href;
  }

  /** RFC 6749 §4.1.2 : un code déjà utilisé qu'on présente de nouveau fait révoquer les jetons qu'il a émis (sans effet si le code est simplement inconnu). */
  private async revokeIfReplayed(authorizationCode: string): Promise<void> {
    const revoked = await this.store.revokeTokensIssuedFromCode(authorizationCode);
    if (revoked > 0) this.logger.warn(`Code d’autorisation rejoué : ${revoked} jeton(s) révoqué(s)`);
  }

  /**
   * Le routeur du SDK transforme toute erreur autre qu'une OAuthError en réponse 500 `server_error` sans rien journaliser :
   * on la journalise ici (describeError n'en garde que le SQL, jamais les paramètres : ni jeton, ni code).
   */
  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof OAuthError)) this.logger.error(describeError(error));
      throw error;
    }
  }

  /** RFC 8707 : le paramètre `resource`, s'il est fourni, doit désigner le serveur MCP (seul service protégé par ces jetons). */
  private assertResource(resource: URL | undefined): void {
    if (resource && withoutFragmentAndTrailingSlash(resource.href) !== withoutFragmentAndTrailingSlash(this.resourceUrl)) {
      throw new InvalidTargetError('The resource parameter must be the MCP server URL');
    }
  }
}
