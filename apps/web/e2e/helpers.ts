import { demoExportFile, type ExportFileV1 } from '@matreso/engine';
import type { Page } from '@playwright/test';

/** Typographie FR des montants : « −2 310 € » avec U+202F et U+00A0. */
export const fr = (text: string): string => text.replace(/(\d) (\d)/g, '$1 $2').replace(/ €/g, ' €');

/** Compte neuf et isolé, avec les données de démo (ou un fichier fourni), date figée au 4 octobre 2026. */
export async function freshAccount(page: Page, opts: { file?: ExportFileV1 | null; firstName?: string } = {}): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@matreso.test`;
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00'));
  const res = await page.request.post('/api/auth/register', { data: { email, password: 'motdepasse1', firstName: opts.firstName ?? 'Guillaume' } });
  if (!res.ok()) throw new Error(`register failed: ${res.status()}`);
  const file = opts.file === undefined ? demoExportFile() : opts.file;
  if (file) {
    const imported = await page.request.post('/api/import', { data: file });
    if (!imported.ok()) throw new Error(`import failed: ${imported.status()}`);
  }
  await page.goto('/');
  return email;
}
