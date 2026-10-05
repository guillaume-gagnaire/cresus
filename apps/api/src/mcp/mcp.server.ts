import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { Injectable, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { type ISODate, localToday } from '@matreso/engine';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { describeError } from '../common/error.filter.js';
import { BalanceService } from '../data/balance.service.js';
import { ChargesService } from '../data/charges.service.js';
import { ClientsService } from '../data/clients.service.js';
import { LeavesService } from '../data/leaves.service.js';
import { ProfileService } from '../data/profile.service.js';
import { StateService } from '../data/state.service.js';
import { TransferService } from '../data/transfer.service.js';
import type { AppConfig } from '../config.js';
import { OAuthProvider } from '../oauth/oauth.provider.js';
import { OAUTH_SCOPE } from '../oauth/oauth.store.js';
import { registerTools } from './mcp.tools.js';

/** Taille maximale d'un corps JSON-RPC : un appel d'outil tient en quelques ko (le plus gros, delete_leaves, porte 500 identifiants). */
const BODY_LIMIT = '1mb';

const SERVER_NAME = 'ma-treso';

const INSTRUCTIONS =
  'Ma Tréso : projection de trésorerie d’un indépendant (missions, tarifs, congés, charges, solde). ' +
  'Les montants sont en euros (nombres, 2 décimales au plus), sauf dans export_data (centimes). Les dates sont au format AAAA-MM-JJ et les mois AAAA-MM. ' +
  'Commence par get_overview pour l’état de la trésorerie, puis get_month pour le détail d’un mois.';

/** Version du paquet (package.json de l'API, à côté de `src/` comme de `dist/`). */
function packageVersion(): string {
  try {
    const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: unknown };
    return typeof version === 'string' ? version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Fabrique le serveur MCP d'une requête : les services de l'API (Nest) liés à l'utilisateur du jeton. */
@Injectable()
export class McpService {
  private readonly version = packageVersion();

  /**
   * Date du jour du serveur (TZ=Europe/Paris en production), lue à chaque appel d'outil. Les tests la figent en simulant `Date` ;
   * ils peuvent aussi remplacer cette fonction.
   */
  today: () => ISODate = () => localToday();

  constructor(
    private readonly state: StateService,
    private readonly auth: AuthService,
    private readonly profile: ProfileService,
    private readonly balance: BalanceService,
    private readonly clients: ClientsService,
    private readonly leaves: LeavesService,
    private readonly charges: ChargesService,
    private readonly transfer: TransferService,
  ) {}

  createServer(userId: string): McpServer {
    const server = new McpServer({ name: SERVER_NAME, version: this.version }, { instructions: INSTRUCTIONS });
    registerTools(server, {
      userId,
      today: () => this.today(),
      services: {
        state: this.state,
        auth: this.auth,
        profile: this.profile,
        balance: this.balance,
        clients: this.clients,
        leaves: this.leaves,
        charges: this.charges,
        transfer: this.transfer,
      },
    });
    return server;
  }
}

const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

/** Erreurs de l'analyse du corps (413 trop gros, 400 JSON invalide…) en erreurs JSON-RPC, plutôt que la page HTML d'Express. */
const bodyParserErrors: ErrorRequestHandler = (error: { status?: unknown }, _req, res, next) => {
  const status = error.status;
  if (typeof status !== 'number' || status < 400 || status >= 500) {
    next(error);
    return;
  }
  res.status(status).json(status === 413 ? rpcError(-32600, 'Request body too large') : rpcError(-32700, 'Parse error'));
};

/**
 * Monte `/mcp` (transport Streamable HTTP sans état) comme middleware Express, hors du préfixe /api et avant le parseur JSON global (5 Mo).
 * Le jeton Bearer est vérifié **avant** la lecture du corps : une requête anonyme ne fait rien analyser. Chaque requête POST obtient
 * son propre serveur MCP et son propre transport, liés à l'utilisateur du jeton (`extra.userId`, posé par OAuthProvider.verifyAccessToken).
 * GET (flux SSE initié par le serveur) et DELETE (fin de session) n'ont pas de sens sans session : 405, comme dans l'exemple sans état du SDK.
 */
export function mountMcp(app: NestExpressApplication, config: AppConfig): void {
  const logger = new Logger('Mcp');
  const mcp = app.get(McpService);
  const bearer = requireBearerAuth({
    verifier: app.get(OAuthProvider),
    requiredScopes: [OAUTH_SCOPE],
    // pas de `expectedResource` : les jetons ne portent pas de ressource (OAuthProvider n'en conserve pas), le seul service qu'ils ouvrent est /mcp
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL('/mcp', config.publicUrl)),
  });

  const handle = async (req: Request, res: Response): Promise<void> => {
    const userId: unknown = req.auth?.extra?.userId;
    if (typeof userId !== 'string') {
      res.status(401).json(rpcError(-32001, 'Unauthorized'));
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Method not allowed.'));
      return;
    }
    const server = mcp.createServer(userId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(describeError(error));
      if (!res.headersSent) res.status(500).json(rpcError(-32603, 'Internal server error'));
    }
  };

  // un routeur : seul /mcp lui-même est servi, le reste passe aux routes suivantes (404 de Nest)
  const router = express.Router();
  router.all('/', bearer, express.json({ limit: BODY_LIMIT }), bodyParserErrors, handle);
  app.use('/mcp', router);
}
