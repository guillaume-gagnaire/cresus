/** Contrats de l'API JSON (`/api`), partagés par l'API et le front. Montants en centimes, dates ISO. */

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

export interface AccountDto {
  id: string;
  email: string;
  name: string;
}

export interface EventDto {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  salesCount: number;
  revenueCents: number;
  createdAt: string;
}

export interface ArticleDto {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  /** Picto choisi (clé), ou null : choix automatique d'après le nom. */
  picto: string | null;
  position: number;
  onSale: boolean;
  archived: boolean;
}

export interface ArticleTotals {
  articleId: string;
  count: number;
  revenueCents: number;
}

export interface HourBucket {
  /** Début de la tranche, heure de Paris : YYYY-MM-DDTHH:00 */
  hour: string;
  count: number;
  revenueCents: number;
}

export interface SummaryDto {
  eventId: string;
  salesCount: number;
  revenueCents: number;
  articles: ArticleTotals[];
  byHour: HourBucket[];
}

export interface EventDetailDto {
  event: EventDto;
  /** Archivés compris, triés par position. */
  articles: ArticleDto[];
  summary: SummaryDto;
}

export type SyncOp =
  | { op: 'sale'; id: string; articleId: string; priceCents: number; soldAt: string }
  | { op: 'void'; id: string };

export interface SyncRequest {
  ops: SyncOp[];
}

export interface SyncResponse {
  applied: number;
  /** Identifiants des opérations refusées (article inconnu) : le client les abandonne. */
  rejected: string[];
  summary: SummaryDto;
}

export interface SaleDto {
  id: string;
  articleId: string;
  articleName: string;
  priceCents: number;
  soldAt: string;
}

export interface SalesPageDto {
  sales: SaleDto[];
  /** Curseur de la page suivante, ou null. */
  next: string | null;
}

/** Bornes communes à l'API et aux formulaires. */
export const LIMITS = {
  articleName: 40,
  eventName: 60,
  accountName: 60,
  passwordMin: 8,
  passwordMax: 200,
  priceMaxCents: 99_999,
  syncBatch: 500,
} as const;
