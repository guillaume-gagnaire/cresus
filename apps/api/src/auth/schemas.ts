import { LIMITS } from '@cresus/shared';
import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email invalide.'));
export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Le mot de passe doit faire au moins ${LIMITS.passwordMin} caractères.`)
  .max(LIMITS.passwordMax, 'Mot de passe trop long.');
export const accountNameSchema = z
  .string()
  .trim()
  .min(1, 'Indiquez le nom de l’asso.')
  .max(LIMITS.accountName, `Le nom de l’asso fait au plus ${LIMITS.accountName} caractères.`);

export const signupSchema = z.object({ name: accountNameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Indiquez le mot de passe.') });
export const renameSchema = z.object({ name: accountNameSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Indiquez le mot de passe actuel.'), newPassword: passwordSchema });
export const deleteAccountSchema = z.object({ password: z.string().min(1, 'Indiquez le mot de passe.') });
