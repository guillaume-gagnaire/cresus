import type { Response } from 'express';
import type { AppConfig } from '../config.js';

export const SESSION_COOKIE = 'cresus_session';
/** 180 jours, prolongés à l'usage : un bénévole ne retape pas le mot de passe à chaque kermesse. */
export const SESSION_TTL_MS = 180 * 24 * 3600 * 1000;

export function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });
}
