import { Inject, Injectable } from '@nestjs/common';
import {
  type AuthenticationResponseJSON, generateAuthenticationOptions, generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON, verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { uniqueViolation } from '../common/pg-errors.js';
import { type AppConfig, CONFIG } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { passkeys, users } from '../db/schema.js';

type Transport = NonNullable<RegistrationResponseJSON['response']['transports']>[number];
const INVALID = () => new AppError(400, 'PASSKEY_INVALID', 'Impossible d’activer Face ID sur cet appareil.');

@Injectable()
export class PasskeyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async registrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Connecte-toi pour continuer.');
    const existing = await this.db.select().from(passkeys).where(eq(passkeys.userId, userId));
    return generateRegistrationOptions({
      rpName: this.config.webauthn.rpName,
      rpID: this.config.webauthn.rpId,
      userName: user.email,
      userDisplayName: user.firstName,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports as Transport[] })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
  }

  async verifyRegistration(userId: string, response: RegistrationResponseJSON, expectedChallenge: string): Promise<void> {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.webauthn.origin,
        expectedRPID: this.config.webauthn.rpId,
        requireUserVerification: false,
      });
    } catch {
      throw INVALID();
    }
    if (!verification.verified || !verification.registrationInfo) throw INVALID();
    const { credential } = verification.registrationInfo;
    try {
      await this.db.insert(passkeys).values({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
      });
    } catch (e) {
      // la même passkey (credential_id unique) enregistrée deux fois, par un double clic ou un rejeu : refus propre, pas une 500
      if (uniqueViolation(e)) throw INVALID();
      throw e;
    }
  }

  authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({ rpID: this.config.webauthn.rpId, userVerification: 'preferred', allowCredentials: [] });
  }

  /** Renvoie l'userId propriétaire de la passkey. */
  async verifyAuthentication(response: AuthenticationResponseJSON, expectedChallenge: string): Promise<string> {
    const [row] = await this.db.select().from(passkeys).where(eq(passkeys.credentialId, response.id));
    if (!row) throw new AppError(401, 'PASSKEY_UNKNOWN', 'Cette passkey n’est pas reconnue.');
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.webauthn.origin,
        expectedRPID: this.config.webauthn.rpId,
        credential: { id: row.credentialId, publicKey: new Uint8Array(row.publicKey), counter: row.counter, transports: row.transports as Transport[] },
        requireUserVerification: false,
      });
    } catch {
      throw new AppError(401, 'PASSKEY_INVALID', 'Connexion par Face ID refusée.');
    }
    if (!verification.verified) throw new AppError(401, 'PASSKEY_INVALID', 'Connexion par Face ID refusée.');
    await this.db.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, row.id));
    return row.userId;
  }

  async deleteAll(userId: string): Promise<void> {
    await this.db.delete(passkeys).where(eq(passkeys.userId, userId));
  }
}
