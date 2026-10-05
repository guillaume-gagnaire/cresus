import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CustomOAuthError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { oauthClients, oauthCodes, oauthRequests, oauthTokens } from '../db/schema.js';
import { isAllowedRedirectUri } from './redirect-uri.js';

/** Unique scope de l'API : l'accès complet au compte (cf. `scopesSupported`). */
export const OAUTH_SCOPE = 'cresus';

export const REQUEST_TTL_MS = 10 * 60_000;
export const CODE_TTL_MS = 5 * 60_000;
export const ACCESS_TOKEN_TTL_MS = 60 * 60_000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;

const UNNAMED_CLIENT = 'Application sans nom';
const MAX_CLIENT_NAME_LENGTH = 100;

/** Secret aléatoire de 32 octets, en base64url : codes d'autorisation et jetons. */
const newSecret = (): string => randomBytes(32).toString('base64url');

/** Seuls ces hachages SHA-256 (hexadécimal) sont stockés : un secret en clair ne touche jamais la base. */
export const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');

export interface PendingRequest {
  clientName: string;
  redirectUri: string;
  scope: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie du jeton d'accès, en secondes. */
  expiresIn: number;
  scope: string;
}

export interface AccessTokenRecord {
  clientId: string;
  userId: string;
  scope: string;
  accessExpiresAt: Date;
}

/** Magasin PostgreSQL du serveur d'autorisation : clients, demandes de consentement, codes et jetons. */
@Injectable()
export class OAuthStore implements OAuthRegisteredClientsStore {
  constructor(@Inject(DB) private readonly db: Db) {}

  // --- clients (RFC 7591) -------------------------------------------------------------------------------------------

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const [row] = await this.db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
    if (!row) return undefined;
    // `metadata` est ce que registerClient a écrit : une OAuthClientInformationFull
    return { ...(row.metadata as unknown as OAuthClientInformationFull), client_id: row.clientId, client_name: row.clientName, redirect_uris: row.redirectUris };
  }

  /**
   * Clients publics uniquement : pas de secret, `client_id` aléatoire. Les valeurs imposées par le serveur
   * (méthode d'authentification, types de grant) remplacent celles demandées, comme le prévoit le SDK.
   */
  async registerClient(client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>): Promise<OAuthClientInformationFull> {
    if (client.redirect_uris.length === 0 || !client.redirect_uris.every(isAllowedRedirectUri)) {
      // le SDK n'a pas de classe dédiée : RFC 7591 §3.2.2 définit `invalid_redirect_uri`
      throw new CustomOAuthError('invalid_redirect_uri', 'Redirect URIs must be http://localhost, http://127.0.0.1 or https URLs');
    }
    const { client_secret: _secret, client_secret_expires_at: _secretExpiresAt, ...metadata } = client;
    const info: OAuthClientInformationFull = {
      ...metadata,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.client_name?.trim().slice(0, MAX_CLIENT_NAME_LENGTH) || UNNAMED_CLIENT,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
    await this.db.insert(oauthClients).values({
      clientId: info.client_id,
      clientName: info.client_name as string,
      redirectUris: info.redirect_uris,
      metadata: info as unknown as Record<string, unknown>,
    });
    return info;
  }

  // --- demandes de consentement -------------------------------------------------------------------------------------

  /** Supprime ce qui a expiré : demandes et codes périmés, jetons dont le rafraîchissement est expiré. */
  async purgeExpired(): Promise<void> {
    const now = new Date();
    await this.db.delete(oauthRequests).where(lt(oauthRequests.expiresAt, now));
    await this.db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
    await this.db.delete(oauthTokens).where(lt(oauthTokens.refreshExpiresAt, now));
  }

  async createRequest(input: { clientId: string; redirectUri: string; codeChallenge: string; state: string | null; scope: string; resource: string | null }): Promise<string> {
    const [row] = await this.db
      .insert(oauthRequests)
      .values({ ...input, expiresAt: new Date(Date.now() + REQUEST_TTL_MS) })
      .returning({ id: oauthRequests.id });
    return row!.id;
  }

  async findRequest(id: string): Promise<PendingRequest | null> {
    const [row] = await this.db
      .select({ clientName: oauthClients.clientName, redirectUri: oauthRequests.redirectUri, scope: oauthRequests.scope })
      .from(oauthRequests)
      .innerJoin(oauthClients, eq(oauthClients.clientId, oauthRequests.clientId))
      .where(and(eq(oauthRequests.id, id), gt(oauthRequests.expiresAt, new Date())));
    return row ?? null;
  }

  /** Consomme la demande (suppression atomique : une seule réponse possible) et crée le code d'autorisation de `userId`. */
  async approveRequest(id: string, userId: string): Promise<{ redirectUri: string; state: string | null; code: string } | null> {
    const code = newSecret();
    const request = await this.db.transaction(async (tx) => {
      const [row] = await tx.delete(oauthRequests).where(and(eq(oauthRequests.id, id), gt(oauthRequests.expiresAt, new Date()))).returning();
      if (!row) return null;
      await tx.insert(oauthCodes).values({
        codeHash: hashSecret(code),
        clientId: row.clientId,
        userId,
        redirectUri: row.redirectUri,
        codeChallenge: row.codeChallenge,
        scope: row.scope,
        resource: row.resource,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
      return row;
    });
    return request ? { redirectUri: request.redirectUri, state: request.state, code } : null;
  }

  async denyRequest(id: string): Promise<{ redirectUri: string; state: string | null } | null> {
    const [row] = await this.db.delete(oauthRequests).where(and(eq(oauthRequests.id, id), gt(oauthRequests.expiresAt, new Date()))).returning();
    return row ? { redirectUri: row.redirectUri, state: row.state } : null;
  }

  // --- codes d'autorisation -----------------------------------------------------------------------------------------

  /** Défi PKCE d'un code valide (non expiré) émis à ce client, sans le consommer. */
  async codeChallenge(code: string, clientId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ codeChallenge: oauthCodes.codeChallenge })
      .from(oauthCodes)
      .where(and(eq(oauthCodes.codeHash, hashSecret(code)), eq(oauthCodes.clientId, clientId), gt(oauthCodes.expiresAt, new Date())));
    return row?.codeChallenge ?? null;
  }

  /** Usage unique : la suppression est atomique, un code rejoué (ou présenté deux fois en parallèle) ne sort qu'une fois. */
  async consumeCode(code: string): Promise<typeof oauthCodes.$inferSelect | null> {
    const [row] = await this.db.delete(oauthCodes).where(eq(oauthCodes.codeHash, hashSecret(code))).returning();
    return row ?? null;
  }

  // --- jetons -------------------------------------------------------------------------------------------------------

  issueTokens(input: { clientId: string; userId: string; scope: string }): Promise<TokenPair> {
    return this.insertTokens(this.db, input);
  }

  /** Rotation : la paire présentée est révoquée (une seule fois, atomiquement) et remplacée par une nouvelle. */
  async rotateTokens(refreshToken: string, clientId: string): Promise<TokenPair | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [old] = await tx
        .update(oauthTokens)
        .set({ revokedAt: now })
        .where(and(eq(oauthTokens.refreshHash, hashSecret(refreshToken)), eq(oauthTokens.clientId, clientId), isNull(oauthTokens.revokedAt), gt(oauthTokens.refreshExpiresAt, now)))
        .returning();
      return old ? this.insertTokens(tx, { clientId: old.clientId, userId: old.userId, scope: old.scope }) : null;
    });
  }

  /** Révoque la paire dont `token` est le jeton d'accès ou de rafraîchissement, si elle appartient à ce client. */
  async revokeTokens(token: string, clientId: string): Promise<void> {
    const hash = hashSecret(token);
    await this.db
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(and(or(eq(oauthTokens.accessHash, hash), eq(oauthTokens.refreshHash, hash)), eq(oauthTokens.clientId, clientId), isNull(oauthTokens.revokedAt)));
  }

  async findAccessToken(token: string): Promise<AccessTokenRecord | null> {
    const [row] = await this.db
      .select({ clientId: oauthTokens.clientId, userId: oauthTokens.userId, scope: oauthTokens.scope, accessExpiresAt: oauthTokens.accessExpiresAt })
      .from(oauthTokens)
      .where(and(eq(oauthTokens.accessHash, hashSecret(token)), isNull(oauthTokens.revokedAt), gt(oauthTokens.accessExpiresAt, new Date())));
    return row ?? null;
  }

  private async insertTokens(db: Db, input: { clientId: string; userId: string; scope: string }): Promise<TokenPair> {
    const accessToken = newSecret();
    const refreshToken = newSecret();
    const now = Date.now();
    await db.insert(oauthTokens).values({
      accessHash: hashSecret(accessToken),
      refreshHash: hashSecret(refreshToken),
      ...input,
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000, scope: input.scope };
  }
}
