import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAccount } from '../common/current-account.decorator.js';
import { ExportService } from './export.service.js';

@Controller('events/:id')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('export')
  async export(@CurrentAccount() accountId: string, @Param('id') eventId: string, @Res() res: Response): Promise<void> {
    const { filename, workbook } = await this.exports.build(accountId, eventId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'no-store');
    await workbook.xlsx.write(res);
    res.end();
  }
}
