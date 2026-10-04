import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (password: string): Promise<string> => hash(password);

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
