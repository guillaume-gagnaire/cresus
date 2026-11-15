import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, resetDb, setupTestApp, signedUpAgent } from './helpers.js';

function binary(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

const rowsOf = (sheet: ExcelJS.Worksheet): unknown[][] => {
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
};

describe('export Excel d’un évènement', () => {
  let app: NestExpressApplication;
  let agent: Agent;
  let eventId: string;

  beforeAll(async () => {
    app = await setupTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
    agent = await signedUpAgent(app);
    eventId = (await agent.post('/api/events').send({ name: 'Kermesse 2027', date: '2026-06-20' }).expect(201)).body.id;
    const crepe = (await agent.post(`/api/events/${eventId}/articles`).send({ name: 'Crêpe', priceCents: 250 }).expect(201)).body.id;
    const soda = (await agent.post(`/api/events/${eventId}/articles`).send({ name: 'Soda', priceCents: 150 }).expect(201)).body.id;
    const voided = randomUUID();
    await agent
      .post(`/api/events/${eventId}/sync`)
      .send({
        ops: [
          { op: 'sale', id: randomUUID(), articleId: crepe, priceCents: 250, soldAt: '2026-06-20T12:10:00.000Z' },
          { op: 'sale', id: randomUUID(), articleId: crepe, priceCents: 250, soldAt: '2026-06-20T12:20:00.000Z' },
          { op: 'sale', id: randomUUID(), articleId: crepe, priceCents: 300, soldAt: '2026-06-20T13:05:00.000Z' },
          { op: 'sale', id: voided, articleId: soda, priceCents: 150, soldAt: '2026-06-20T13:06:00.000Z' },
          { op: 'void', id: voided },
        ],
      })
      .expect(200);
  });

  it('produit un classeur avec récapitulatif, ventes et tranches horaires', async () => {
    const res = await agent.get(`/api/events/${eventId}/export`).buffer(true).parse(binary).expect(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('filename="cresus-kermesse-2027-2026-06-20.xlsx"');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body as Buffer);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Récapitulatif', 'Ventes', 'Par heure']);

    const recap = rowsOf(workbook.getWorksheet('Récapitulatif')!);
    expect(recap).toContainEqual(['Asso', 'APE ape@ecole.fr']);
    expect(recap).toContainEqual(['Évènement', 'Kermesse 2027']);
    expect(recap).toContainEqual(['Date', '20/06/2026']);
    expect(recap).toContainEqual(['Article', 'Prix unitaire', 'Quantité', 'Total']);
    expect(recap).toContainEqual(['Crêpe', 2.5, 2, 5]);
    expect(recap).toContainEqual(['Crêpe', 3, 1, 3]);
    expect(recap.at(-1)).toEqual(['Total', undefined, 3, 8]);
    expect(recap.some((row) => row[0] === 'Soda')).toBe(false);

    const ventes = rowsOf(workbook.getWorksheet('Ventes')!);
    expect(ventes).toEqual([
      ['Date', 'Heure', 'Article', 'Prix'],
      ['20/06/2026', '14:10:00', 'Crêpe', 2.5],
      ['20/06/2026', '14:20:00', 'Crêpe', 2.5],
      ['20/06/2026', '15:05:00', 'Crêpe', 3],
    ]);

    const hours = rowsOf(workbook.getWorksheet('Par heure')!);
    expect(hours).toEqual([
      ['Tranche horaire', 'Nombre de ventes', 'Montant'],
      ['14:00 – 15:00', 2, 5],
      ['15:00 – 16:00', 1, 3],
    ]);
  });

  it('refuse l’export de l’évènement d’une autre asso', async () => {
    const other = await signedUpAgent(app, 'autre@ecole.fr');
    await other.get(`/api/events/${eventId}/export`).expect(404);
  });
});
