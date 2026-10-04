import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { type AppConfig, CONFIG } from '../config.js';

const WINDOW_MS = 60_000;
/** Compteur unique pour toutes les routes décorées : la clé ne dépend pas du chemin, donc ni de la casse ni du « / » final. */
const BUCKET = 'auth';

/** Compteurs partagés : les gardes sont instanciés par module (AuthModule, DataModule…), le compteur doit donc vivre dans un fournisseur commun. */
@Injectable()
export class RateLimitStore {
  readonly hits = new Map<string, number[]>();
}

/** `authRateLimit` requêtes par minute et par IP, toutes routes /auth décorées confondues. En mémoire : suffisant pour une instance unique. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly store: RateLimitStore,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = `${req.ip}:${BUCKET}`;
    const now = Date.now();
    const recent = (this.store.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= this.config.authRateLimit) throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.store.hits.set(key, recent);
    return true;
  }
}
