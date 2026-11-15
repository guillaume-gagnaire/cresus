import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import type { ArticleDto } from '@cresus/shared';
import type { z } from 'zod';
import { CurrentAccount } from '../common/current-account.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ArticlesService } from './articles.service.js';
import { createArticleSchema, orderSchema, updateArticleSchema } from './schemas.js';

@Controller('events/:id/articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Post()
  create(
    @CurrentAccount() accountId: string,
    @Param('id') eventId: string,
    @Body(new ZodPipe(createArticleSchema)) body: z.infer<typeof createArticleSchema>,
  ): Promise<ArticleDto> {
    return this.articles.create(accountId, eventId, body);
  }

  @Put('order')
  reorder(@CurrentAccount() accountId: string, @Param('id') eventId: string, @Body(new ZodPipe(orderSchema)) body: z.infer<typeof orderSchema>): Promise<ArticleDto[]> {
    return this.articles.reorder(accountId, eventId, body.ids);
  }

  @Patch(':articleId')
  update(
    @CurrentAccount() accountId: string,
    @Param('id') eventId: string,
    @Param('articleId') articleId: string,
    @Body(new ZodPipe(updateArticleSchema)) body: z.infer<typeof updateArticleSchema>,
  ): Promise<ArticleDto> {
    return this.articles.update(accountId, eventId, articleId, body);
  }

  @Delete(':articleId')
  @HttpCode(204)
  remove(@CurrentAccount() accountId: string, @Param('id') eventId: string, @Param('articleId') articleId: string): Promise<void> {
    return this.articles.remove(accountId, eventId, articleId);
  }
}
