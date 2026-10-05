import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CustomOAuthError, InvalidClientMetadataError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
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
const MAX_CLIENT_NAME_LENGTH = 200;
const MAX_REDIRECT_URIS = 10;
/** Taille maximale d'une redirect_uri et de chaque champ texte conservé. */
const MAX_FIELD_LENGTH = 2048;
/** Métadonnées d'enregistrement conservées en plus de redirect_uris, client_name et des valeurs imposées (liste blanche). */
const OPTIONAL_FIELDS = ['client_uri', 'logo_uri', 'scope', 'software_id', 'software_version'] as const;

type OAuthClientMetadata = Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at' | 'client_secret' | 'client_secret_expires_at'>;

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

/** Propriétaire d'une paire de jetons, et code d'autorisation dont elle découle (absent pour une paire créée hors parcours). */
export interface TokenOwner {
  clientId: string;
  userId: string;
  scope: string;
  codeHash?: string | null;
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
    // `metadata` est ce que registerClient a écrit (la liste blanche) ; l'identifiant et la date d'émission viennent des colonnes
    return {
      ...(row.metadata as unknown as OAuthClientMetadata),
      client_id: row.clientId,
      client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
      client_name: row.clientName,
      redirect_uris: row.redirectUris,
    };
  }

  /**
   * Clients publics uniquement : pas de secret, `client_id` aléatoire. Les valeurs imposées par le serveur
   * (méthode d'authentification, types de grant) remplacent celles demandées, comme le prévoit le SDK.
   * Cette route est publique : seuls les champs de la liste blanche sont conservés (ni `jwks`, ni `contacts`,
   * ni `software_statement`…) et leur taille est bornée, sinon une inscription anonyme pourrait remplir la base.
   */
  async registerClient(client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>): Promise<OAuthClientInformationFull> {
    if (client.redirect_uris.length > MAX_REDIRECT_URIS) throw new InvalidClientMetadataError(`At most ${MAX_REDIRECT_URIS} redirect URIs are allowed`);
    if (client.redirect_uris.some((uri) => uri.length > MAX_FIELD_LENGTH)) {
      throw new InvalidClientMetadataError(`Redirect URIs must not exceed ${MAX_FIELD_LENGTH} characters`);
    }
    const name = client.client_name?.trim();
    if (name && name.length > MAX_CLIENT_NAME_LENGTH) throw new InvalidClientMetadataError(`client_name must not exceed ${MAX_CLIENT_NAME_LENGTH} characters`);
    const metadata: OAuthClientMetadata = {
      redirect_uris: client.redirect_uris,
      client_name: name || UNNAMED_CLIENT,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
    for (const field of OPTIONAL_FIELDS) {
      const value = client[field];
      if (value === undefined) continue;
      if (value.length > MAX_FIELD_LENGTH) throw new InvalidClientMetadataError(`${field} must not exceed ${MAX_FIELD_LENGTH} characters`);
      metadata[field] = value;
    }
    if (metadata.redirect_uris.length === 0 || !metadata.redirect_uris.every(isAllowedRedirectUri)) {
      // le SDK n'a pas de classe dédiée : RFC 7591 §3.2.2 définit `invalid_redirect_uri`
      throw new CustomOAuthError('invalid_redirect_uri', 'Redirect URIs must be http://localhost, http://127.0.0.1 or https URLs');
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const info: OAuthClientInformationFull = { ...metadata, client_id: randomUUID(), client_id_issued_at: issuedAt };
    await this.db.insert(oauthClients).values({
      clientId: info.client_id,
      clientName: metadata.client_name as string,
      redirectUris: metadata.redirect_uris,
      metadata: metadata as unknown as Record<string, unknown>,
      createdAt: new Date(issuedAt * 1000),
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

  /** `codeHash` : code d'autorisation d'origine, pour pouvoir révoquer ces jetons si le code est rejoué. */
  issueTokens(input: TokenOwner): Promise<TokenPair> {
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
      // la nouvelle paire garde le lien avec le code d'origine
      return old ? this.insertTokens(tx, { clientId: old.clientId, userId: old.userId, scope: old.scope, codeHash: old.codeHash }) : null;
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

  /**
   * Un code d'autorisation rejoué (RFC 6749 §4.1.2) laisse supposer qu'il a été intercepté : on révoque tous les jetons
   * issus de ce code, rotations comprises. Renvoie le nombre de jetons révoqués (0 si le code n'a jamais été échangé).
   */
  async revokeTokensIssuedFromCode(code: string): Promise<number> {
    const revoked = await this.db
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthTokens.codeHash, hashSecret(code)), isNull(oauthTokens.revokedAt)))
      .returning({ id: oauthTokens.id });
    return revoked.length;
  }

  async findAccessToken(token: string): Promise<AccessTokenRecord | null> {
    const [row] = await this.db
      .select({ clientId: oauthTokens.clientId, userId: oauthTokens.userId, scope: oauthTokens.scope, accessExpiresAt: oauthTokens.accessExpiresAt })
      .from(oauthTokens)
      .where(and(eq(oauthTokens.accessHash, hashSecret(token)), isNull(oauthTokens.revokedAt), gt(oauthTokens.accessExpiresAt, new Date())));
    return row ?? null;
  }

  private async insertTokens(db: Db, input: TokenOwner): Promise<TokenPair> {
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
