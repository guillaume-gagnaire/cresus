import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAccount } from '../common/current-account.decorator.js';
import { type EventExport, ExportService } from './export.service.js';

/** Envoie le classeur en téléchargement (nom de fichier ASCII, et sa forme UTF-8 pour les navigateurs qui la lisent). */
export async function sendWorkbook(res: Response, { filename, workbook }: EventExport): Promise<void> {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Cache-Control', 'no-store');
  await workbook.xlsx.write(res);
  res.end();
}

@Controller('events/:id')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('export')
  async export(@CurrentAccount() accountId: string, @Param('id') eventId: string, @Res() res: Response): Promise<void> {
    await sendWorkbook(res, await this.exports.build(accountId, eventId));
  }
}
