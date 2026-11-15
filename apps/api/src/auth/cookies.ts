import type { Response } from 'express';
import type { AppConfig } from '../config.js';

export const SESSION_COOKIE = 'cresus_session';
/** 24 h, prolongées à chaque usage (au plus toutes les 5 minutes, cf. SESSION_RENEW_MS) : l'appli ouverte reste connectée. */
export const SESSION_TTL_MS = 24 * 3600 * 1000;
/** Une session n'est prolongée que si sa dernière prolongation date d'au moins 5 minutes. */
export const SESSION_RENEW_MS = 5 * 60 * 1000;

export function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });
}
