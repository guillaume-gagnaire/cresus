import { relative, resolve } from 'node:path';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { type AppConfig, CONFIG } from '../config.js';

/**
 * Routes que l'API sert elle-même (la liste du service worker, apps/web/nuxt.config.ts) : le repli SPA ne les intercepte
 * jamais, quelle que soit la casse (Express route sans distinguer majuscules et minuscules).
 */
const SERVER_ROUTES = /^\/(?:api|mcp|authorize|token|register|revoke|\.well-known)(?:[/?]|$)/i;

/**
 * Assets de `_nuxt/` dont le nom porte une empreinte : immuables. `_nuxt/builds/` (latest.json, meta/*) n'en a pas
 * (latest.json change à chaque déploiement) et reste revalidé comme index.html, sw.js et manifest.webmanifest.
 */
const IMMUTABLE_ASSET = /^_nuxt[\\/](?!builds[\\/])/;

const cacheControl = (file: string): string => (IMMUTABLE_ASSET.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache');

/**
 * Sert le front (build Nuxt, `WEB_DIST`) avec repli SPA, après les routes de l'API : tout GET qui n'est ni un fichier ni
 * une route du serveur reçoit index.html. Remplace `@nestjs/serve-static` dont le repli fait `res.sendFile(chemin absolu)` :
 * Express y refuse les dossiers cachés du chemin (`.output`, dossier par défaut du build Nuxt) et répond 404 sur toute
 * URL profonde. Ici le chemin est relatif à `root`, seule la partie sous `WEB_DIST` est contrôlée.
 */
@Injectable()
export class FrontService implements OnModuleInit {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.webDist) return;
    const root = resolve(this.config.webDist);
    const app = this.adapterHost.httpAdapter.getInstance<Express>();
    // `redirect: false` : /calendar (dossier prérendu) reçoit la coquille du SPA en 200 au lieu d'une redirection vers /calendar/
    app.use(express.static(root, { redirect: false, setHeaders: (res, file) => res.setHeader('Cache-Control', cacheControl(relative(root, file))) }));
    app.get('{*any}', (req: Request, res: Response, next: NextFunction) => {
      if (SERVER_ROUTES.test(req.originalUrl)) {
        next();
        return;
      }
      res.setHeader('Cache-Control', cacheControl('index.html'));
      res.sendFile('index.html', { root }, (error) => {
        if (!error) return;
        // réponse déjà entamée puis interrompue (client parti) : on coupe ; sinon index.html manque, la 404 de Nest répond
        if (res.headersSent) res.destroy();
        else next();
      });
    });
  }
}
