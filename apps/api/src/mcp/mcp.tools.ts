import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '@nestjs/common';
import { type ISODate, LEAVE_SCOPES } from '@matreso/engine';
import { z } from 'zod';
import type { AuthService } from '../auth/auth.service.js';
import { AppError } from '../common/app-error.js';
import { describeError } from '../common/error.filter.js';
import { parseWith } from '../common/zod.pipe.js';
import { balanceSchema, type BalanceService } from '../data/balance.service.js';
import { chargeInputSchema, chargePatchSchema, type ChargesService } from '../data/charges.service.js';
import { clientFields, clientInputSchema, clientPatchSchema, type ClientsService, rateSchema } from '../data/clients.service.js';
import { deleteLeavesSchema, leavesInputSchema, type LeavesService } from '../data/leaves.service.js';
import { profilePatchSchema, type ProfileService } from '../data/profile.service.js';
import type { StateService } from '../data/state.service.js';
import type { TransferService } from '../data/transfer.service.js';
import { balanceView, chargeView, clientView, leavePeriodsView, monthView, overviewView, profileView } from './mcp.views.js';
import { toCents } from './money.js';

/** Services de l'API réutilisés tels quels par les outils (aucune règle métier n'est recopiée ici). */
export interface McpServices {
  state: StateService;
  auth: AuthService;
  profile: ProfileService;
  balance: BalanceService;
  clients: ClientsService;
  leaves: LeavesService;
  charges: ChargesService;
  transfer: TransferService;
}

export interface ToolContext {
  /** Utilisateur du jeton : tous les outils agissent pour lui seul. */
  userId: string;
  services: McpServices;
  /** Date du jour du serveur (TZ=Europe/Paris en production). */
  today: () => ISODate;
}

/** Champs d'un schéma d'entrée (zod classique : `.describe` et `.optional` disponibles). */
type Shape = Record<string, z.ZodType>;

const logger = new Logger('Mcp');

const GENERIC_ERROR = 'Une erreur est survenue. Réessaie dans un instant.';

const succeed = (result: object): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  structuredContent: result as Record<string, unknown>,
});

/**
 * Erreur métier (AppError) : son message français, tel que l'API le renvoie ; le code reste lisible dans `structuredContent.error`
 * (ex. LAST_RATE). Toute autre erreur est journalisée (jamais renvoyée : elle peut contenir du SQL) et devient un message générique.
 */
function fail(error: unknown): CallToolResult {
  let code = 'INTERNAL';
  let message = GENERIC_ERROR;
  if (error instanceof AppError) {
    code = error.code;
    message = error.message;
  } else {
    logger.error(describeError(error));
  }
  return { isError: true, content: [{ type: 'text', text: message }], structuredContent: { error: { code, message } } };
}

/** Retire les clés `undefined` : une valeur absente ne doit pas écraser un défaut en passant par un spread. */
const defined = <T extends Record<string, unknown>>(values: T): Partial<T> => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Ajoute des descriptions (lues par le modèle) à des champs de schémas existants, sans toucher à leurs règles. */
const described = <S extends Shape>(shape: S, texts: { [K in keyof S]?: string }): S => {
  const docs: Record<string, string | undefined> = texts;
  return Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, docs[key] ? schema.describe(docs[key]) : schema])) as S;
};

const euros = (what: string) => z.number().describe(`${what}, en euros (nombre, 2 décimales au plus).`);
const date = (what: string) => z.string().describe(`${what}, au format AAAA-MM-JJ.`);
const id = (what: string) => z.string().describe(`Identifiant ${what}.`);

const CLIENT_DOCS = {
  name: 'Nom du client ou de la mission.',
  subtitle: 'Sous-titre libre (ex. « Via ESN »), ou null.',
  color: 'Couleur d’affichage dans l’application.',
  billingMode: 'TJM = facturation au jour travaillé ; FORFAIT = montant mensuel fixe.',
  weekdays: 'Jours travaillés chaque semaine : 0 = lundi … 4 = vendredi. Sans objet en FORFAIT.',
  startDate: 'Premier jour de la mission, au format AAAA-MM-JJ.',
  endDate: 'Dernier jour de la mission au format AAAA-MM-JJ, ou null si elle n’a pas de fin.',
  paymentTerm: 'Délai de paiement des factures (émises le dernier jour du mois) : RECEPTION, NET_30, NET_45, EOM_30 (30 jours fin de mois) ou NET_60.',
  averageDelayDays: 'Retard moyen de paiement constaté, de 0 à 30 jours.',
  isProspect: 'true pour une piste non signée : elle ne compte que si les pistes sont incluses.',
  archived: 'true archive le client (il sort des projections), false le restaure.',
};

const PROFILE_DOCS = {
  firstName: 'Prénom.',
  companyName: 'Nom de la société, ou null.',
  legalStatus: 'Statut juridique : SASU, SAS, SASU_IR, SARL, EURL_IS, EURL_IR, EI ou MICRO (micro-entreprise).',
  microVersementLiberatoire: 'Micro-entreprise : versement libératoire de l’impôt sur le revenu.',
  microIncomeTaxProvisionPct: 'Micro-entreprise : provision pour l’impôt sur le revenu, en % du chiffre d’affaires (0 à 30).',
  includeProspects: 'Compter les pistes (clients non signés) dans les projections.',
  alertRedMonth: 'Alerte quand un mois passe dans le rouge.',
  alertLatePayment: 'Alerte en cas de retard de paiement.',
};

const CHARGE_DOCS = {
  name: 'Nom de la charge.',
  frequency: 'MONTHLY = chaque mois ; YEARLY = une fois par an, le mois indiqué par `month`.',
  month: 'Mois du prélèvement d’une charge annuelle : 0 = janvier … 11 = décembre. Obligatoire en YEARLY, null en MONTHLY.',
  category: 'Catégorie libre (ex. « Assurance »), ou null.',
};

type ToolKind = 'read' | 'write' | 'delete';
const ANNOTATIONS = {
  read: { readOnlyHint: true },
  write: { readOnlyHint: false, destructiveHint: false },
  delete: { readOnlyHint: false, destructiveHint: true },
} as const;

/**
 * Déclare un outil. Le schéma d'entrée est strict (une clé inconnue, comme `role`, est refusée plutôt qu'ignorée) ; le handler
 * reçoit les arguments déjà validés, et renvoie un objet : tout échec devient un résultat `isError` (voir `fail`).
 */
function defineTool<S extends Shape>(
  server: McpServer,
  name: string,
  config: { title: string; description: string; kind: ToolKind },
  shape: S,
  run: (args: z.output<z.ZodObject<S, z.core.$strict>>) => Promise<object> | object,
): void {
  const inputSchema = z.strictObject(shape);
  server.registerTool<AnySchema, typeof inputSchema>(
    name,
    { title: config.title, description: config.description, inputSchema, annotations: { title: config.title, ...ANNOTATIONS[config.kind] } },
    async (args) => {
      try {
        return succeed(await run(args as z.output<typeof inputSchema>));
      } catch (error) {
        return fail(error);
      }
    },
  );
}

/** Enregistre les 19 outils de gestion de la trésorerie, pour l'utilisateur du contexte. */
export function registerTools(server: McpServer, { userId, services, today }: ToolContext): void {
  const { state, auth, profile, balance, clients, leaves, charges, transfer } = services;

  // --- lecture : projection ---------------------------------------------------------------------------------------

  defineTool(
    server,
    'get_overview',
    {
      title: 'Vue d’ensemble de la trésorerie',
      kind: 'read',
      description:
        'Projection de trésorerie sur 15 mois à partir du mois courant : pour chaque mois, encaissements, charges, résultat, solde cumulé et état ' +
        '(POSITIVE ; RED = résultat négatif ; RED_DUE_TO_LEAVES = négatif à cause des congés ; OVERDRAFT = solde négatif), plus une synthèse et le solde actuel. ' +
        'En micro-entreprise, ajoute le montant « pour toi » de chaque mois, la jauge du plafond de chiffre d’affaires et le revenu lissé. Tous les montants sont en euros.',
    },
    { includeProspects: z.boolean().optional().describe('Compter les pistes (clients non signés) pour cet appel ; par défaut, le réglage du profil.') },
    async (args) => overviewView(await state.getState(userId), today(), args.includeProspects),
  );

  defineTool(
    server,
    'get_month',
    {
      title: 'Détail d’un mois',
      kind: 'read',
      description:
        'Détail d’un mois de la projection (dans les 15 mois de get_overview) : état, encaissements par client (mois facturé, date d’encaissement, montant, ' +
        'coût des congés) et liste des charges, y compris les lignes calculées de rémunération (« Salaire (net) », « Cotisations sociales »). ' +
        '`chargesTotal` est le total des charges. Tous les montants sont en euros.',
    },
    { month: z.string().describe('Mois au format AAAA-MM (ex. 2026-11).') },
    async (args) => monthView(await state.getState(userId), today(), parseWith(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mois invalide : utilise le format AAAA-MM.'), args.month)),
  );

  // --- profil et solde --------------------------------------------------------------------------------------------

  defineTool(
    server,
    'get_profile',
    {
      title: 'Profil',
      kind: 'read',
      description:
        'Profil de l’utilisateur : e-mail, rôle, statut juridique, rémunération nette mensuelle et réglages (micro-entreprise, pistes, alertes). ' +
        'Les montants (netPayMonthly, microProExpensesMonthly) sont en euros.',
    },
    {},
    async () => profileView((await auth.me(userId)).user),
  );

  defineTool(
    server,
    'update_profile',
    {
      title: 'Modifier le profil',
      kind: 'write',
      description:
        'Modifie un ou plusieurs champs du profil ; les champs omis sont inchangés. Changer le statut juridique recalcule la rémunération et les cotisations ' +
        'dans toute la projection. Le rôle n’est jamais modifiable. Les montants (netPayMonthly = rémunération nette mensuelle, microProExpensesMonthly = frais pro mensuels) sont en euros.',
    },
    {
      ...described(profilePatchSchema.shape, PROFILE_DOCS),
      netPayMonthly: euros('Rémunération nette mensuelle').optional(),
      microProExpensesMonthly: euros('Micro-entreprise : frais professionnels mensuels').optional(),
    },
    async (args) => {
      const { netPayMonthly, microProExpensesMonthly, ...fields } = args;
      const patch = defined({
        ...fields,
        netPayMonthly: netPayMonthly === undefined ? undefined : toCents(netPayMonthly),
        microProExpensesMonthly: microProExpensesMonthly === undefined ? undefined : toCents(microProExpensesMonthly),
      });
      return profileView(await profile.patch(userId, parseWith(profilePatchSchema, patch)));
    },
  );

  defineTool(
    server,
    'set_balance',
    {
      title: 'Enregistrer le solde',
      kind: 'write',
      description: 'Enregistre le solde actuel du compte bancaire : il devient le point de départ de la projection. Le montant est en euros et peut être négatif.',
    },
    { amount: euros('Solde du compte'), date: date('Date du solde, par défaut aujourd’hui').optional() },
    async (args) => balanceView(await balance.create(userId, parseWith(balanceSchema, { amount: toCents(args.amount), date: args.date ?? today() }))),
  );

  // --- clients et tarifs ------------------------------------------------------------------------------------------

  defineTool(
    server,
    'list_clients',
    {
      title: 'Lister les clients',
      kind: 'read',
      description: 'Liste les clients et missions avec leurs tarifs historisés (TJM par jour travaillé, ou montant mensuel en FORFAIT). Les montants sont en euros. Les clients archivés sont exclus par défaut.',
    },
    { includeArchived: z.boolean().optional().describe('Inclure les clients archivés.') },
    async (args) => ({
      clients: (await state.getState(userId)).clients.filter((c) => args.includeArchived || c.archivedAt === null).map(clientView),
    }),
  );

  defineTool(
    server,
    'create_client',
    {
      title: 'Créer un client',
      kind: 'write',
      description:
        'Crée un client (une mission) avec son premier tarif : `rate.amount` est le tarif journalier (TJM) ou le montant mensuel (FORFAIT), en euros, applicable dès `rate.validFrom`. ' +
        'Par défaut : sans sous-titre ni date de fin, couleur indigo, aucun jour travaillé (à renseigner en TJM), retard de paiement 0, pas une piste.',
    },
    {
      ...described(
        {
          ...clientFields,
          subtitle: clientFields.subtitle.optional(),
          color: clientFields.color.optional(),
          weekdays: clientFields.weekdays.optional(),
          endDate: clientFields.endDate.optional(),
          averageDelayDays: clientFields.averageDelayDays.optional(),
          isProspect: clientFields.isProspect.optional(),
          startDate: date('Premier jour de la mission'),
        },
        CLIENT_DOCS,
      ),
      rate: z
        .object({ validFrom: date('Date d’application du tarif'), amount: euros('Tarif (par jour travaillé en TJM, par mois en FORFAIT)') })
        .strict()
        .describe('Premier tarif du client.'),
    },
    async (args) => {
      const { rate, ...fields } = args;
      const input = parseWith(clientInputSchema, {
        subtitle: null, color: 'indigo', weekdays: [], endDate: null, averageDelayDays: 0, isProspect: false,
        ...defined(fields),
        rate: { ...rate, amount: toCents(rate.amount) },
      });
      return clientView(await clients.create(userId, input));
    },
  );

  defineTool(
    server,
    'update_client',
    {
      title: 'Modifier un client',
      kind: 'write',
      description:
        'Modifie un ou plusieurs champs d’un client (identifiant : voir list_clients) ; les champs omis sont inchangés. `archived: true` archive le client (il sort des projections), ' +
        '`archived: false` le restaure. Pour changer de tarif, utilise add_rate.',
    },
    { id: id('du client (voir list_clients)'), ...described(clientPatchSchema.shape, CLIENT_DOCS) },
    async (args) => {
      const { id: clientId, ...patch } = args;
      return clientView(await clients.update(userId, clientId, parseWith(clientPatchSchema, patch)));
    },
  );

  defineTool(
    server,
    'delete_client',
    {
      title: 'Supprimer un client',
      kind: 'delete',
      description: 'Supprime définitivement un client, ses tarifs et les congés qui lui sont propres. Pour le garder dans l’historique sans le compter, préfère update_client avec `archived: true`.',
    },
    { id: id('du client (voir list_clients)') },
    async (args) => {
      await clients.remove(userId, args.id);
      return { deleted: true };
    },
  );

  defineTool(
    server,
    'add_rate',
    {
      title: 'Ajouter un tarif',
      kind: 'write',
      description:
        'Ajoute un tarif à un client, applicable à partir de `validFrom` (augmentation, nouveau contrat…). Une date de début déjà utilisée remplace le tarif de cette date. ' +
        'Le montant est en euros : par jour travaillé en TJM, par mois en FORFAIT. Renvoie le client avec tous ses tarifs.',
    },
    { clientId: id('du client (voir list_clients)'), validFrom: date('Date d’application du tarif'), amount: euros('Tarif') },
    async (args) => clientView(await clients.upsertRate(userId, args.clientId, parseWith(rateSchema, { validFrom: args.validFrom, amount: toCents(args.amount) }))),
  );

  defineTool(
    server,
    'delete_rate',
    {
      title: 'Supprimer un tarif',
      kind: 'delete',
      description: 'Supprime un tarif d’un client (identifiants : voir list_clients). Le dernier tarif d’un client ne peut pas être supprimé. Renvoie le client avec ses tarifs restants.',
    },
    { clientId: id('du client'), rateId: id('du tarif (champ `rates[].id` de list_clients)') },
    async (args) => clientView(await clients.removeRate(userId, args.clientId, args.rateId)),
  );

  // --- congés -----------------------------------------------------------------------------------------------------

  defineTool(
    server,
    'list_leaves',
    {
      title: 'Lister les congés',
      kind: 'read',
      description:
        'Liste les périodes de congés (jours ouvrés consécutifs regroupés) : dates, nombre de jours, portée (ALL = tous les clients ; CLIENT = un seul, nommé), ' +
        'coût en encaissements perdus, mois d’encaissement touchés (`impacts`) et identifiants des jours (`leaveIds`, pour delete_leaves). Montants en euros.',
    },
    {},
    async () => ({ periods: leavePeriodsView(await state.getState(userId)) }),
  );

  defineTool(
    server,
    'add_leaves',
    {
      title: 'Poser des congés',
      kind: 'write',
      description:
        'Pose des congés du `from` au `to` inclus (un seul jour si `to` est omis) : seuls les jours ouvrés (hors week-ends et jours fériés) sont créés, ' +
        'un jour déjà posé est ignoré. `scope: "ALL"` vaut pour tous les clients, `scope: "CLIENT"` pour un seul (`clientId` obligatoire). Renvoie le nombre de jours créés et les jours de la période.',
    },
    {
      from: date('Premier jour de congé'),
      to: date('Dernier jour de congé (inclus), par défaut le premier').optional(),
      scope: z.enum(LEAVE_SCOPES).describe('ALL = tous les clients ; CLIENT = un seul client (clientId obligatoire).'),
      clientId: id('du client, obligatoire si scope vaut CLIENT (voir list_clients)').optional(),
    },
    async (args) => {
      const result = await leaves.create(userId, parseWith(leavesInputSchema, defined(args)));
      return { created: result.created, leaves: result.leaves };
    },
  );

  defineTool(
    server,
    'delete_leaves',
    {
      title: 'Supprimer des congés',
      kind: 'delete',
      description: 'Supprime des jours de congés par identifiant (`leaveIds` d’une période de list_leaves, ou `leaves[].id` d’add_leaves). Renvoie le nombre de jours supprimés.',
    },
    { ids: z.array(z.string()).min(1).max(500).describe('Identifiants des jours de congé à supprimer (500 au plus).') },
    async (args) => leaves.remove(userId, parseWith(deleteLeavesSchema, args).ids),
  );

  // --- charges ----------------------------------------------------------------------------------------------------

  defineTool(
    server,
    'list_charges',
    {
      title: 'Lister les charges',
      kind: 'read',
      description:
        'Liste les charges saisies (mensuelles ou annuelles). Les lignes de rémunération calculées (salaire net, cotisations sociales), qui découlent du profil, n’en font pas partie : ' +
        'elles apparaissent dans get_month. Montants en euros.',
    },
    {},
    async () => ({ charges: (await state.getState(userId)).charges.map(chargeView) }),
  );

  defineTool(
    server,
    'create_charge',
    {
      title: 'Créer une charge',
      kind: 'write',
      description: 'Crée une charge récurrente : mensuelle, ou annuelle (`frequency: "YEARLY"` avec `month`, 0 = janvier … 11 = décembre). Le montant est en euros.',
    },
    {
      name: chargeInputSchema.shape.name.describe(CHARGE_DOCS.name),
      amount: euros('Montant de la charge (par mois en MONTHLY, par prélèvement en YEARLY)'),
      frequency: chargeInputSchema.shape.frequency.describe(CHARGE_DOCS.frequency),
      month: chargeInputSchema.shape.month.optional().describe(CHARGE_DOCS.month),
      category: chargeInputSchema.shape.category.optional().describe(CHARGE_DOCS.category),
    },
    async (args) => chargeView(await charges.create(userId, parseWith(chargeInputSchema, { month: null, category: null, ...defined(args), amount: toCents(args.amount) }))),
  );

  defineTool(
    server,
    'update_charge',
    {
      title: 'Modifier une charge',
      kind: 'write',
      description: 'Modifie un ou plusieurs champs d’une charge (identifiant : voir list_charges) ; les champs omis sont inchangés. Le montant est en euros.',
    },
    {
      id: id('de la charge (voir list_charges)'),
      ...described(chargePatchSchema.shape, CHARGE_DOCS),
      amount: euros('Montant de la charge').optional(),
    },
    async (args) => {
      const { id: chargeId, amount, ...fields } = args;
      const patch = defined({ ...fields, amount: amount === undefined ? undefined : toCents(amount) });
      return chargeView(await charges.update(userId, chargeId, parseWith(chargePatchSchema, patch)));
    },
  );

  defineTool(
    server,
    'delete_charge',
    { title: 'Supprimer une charge', kind: 'delete', description: 'Supprime définitivement une charge (identifiant : voir list_charges).' },
    { id: id('de la charge (voir list_charges)') },
    async (args) => {
      await charges.remove(userId, args.id);
      return { deleted: true };
    },
  );

  // --- sauvegarde -------------------------------------------------------------------------------------------------

  defineTool(
    server,
    'export_data',
    {
      title: 'Exporter les données',
      kind: 'read',
      description:
        'Sauvegarde JSON complète du compte (profil, soldes, clients et tarifs, congés, charges), au format du fichier d’export de l’application. ' +
        'Attention : contrairement aux autres outils, les montants de ce fichier sont en CENTIMES (entiers), pour que la sauvegarde puisse être réimportée telle quelle dans l’application.',
    },
    {},
    async () => transfer.exportFile(userId),
  );
}
