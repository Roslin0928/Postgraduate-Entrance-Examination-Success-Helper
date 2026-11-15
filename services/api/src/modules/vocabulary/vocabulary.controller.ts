import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import type { ReviewFeedback } from '@kaoyan/domain';
import { AuthService } from '../../auth.service';
import { VocabularyService } from './vocabulary.service';

@Controller('v1/vocabulary')
export class VocabularyController {
  constructor(private readonly auth: AuthService, private readonly vocabulary: VocabularyService) {}

  private async accountId(authorization?: string): Promise<string> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return (await this.auth.getCurrentUser(token)).id;
  }

  @Get('due')
  async due(@Headers('authorization') authorization: string | undefined, @Headers('x-time-zone') timeZone?: string) {
    return this.vocabulary.getDueWords(await this.accountId(authorization), new Date(), timeZone || 'UTC');
  }

  @Post(':id/reviews')
  async review(@Headers('authorization') authorization: string | undefined, @Headers('x-time-zone') timeZone: string | undefined,
    @Param('id') wordId: string, @Body() body: any) {
    const accountId = await this.accountId(authorization);
    if (!body || Object.keys(body).some((key) => !['feedback', 'taskId'].includes(key)) ||
      !['unknown', 'fuzzy', 'known'].includes(body.feedback) || (body.taskId !== undefined && typeof body.taskId !== 'string')) {
      throw new BadRequestException('feedback and optional taskId are required');
    }
    return this.vocabulary.reviewWord(accountId, wordId, body.feedback as ReviewFeedback, body.taskId, timeZone || 'UTC');
  }

  @Post('custom')
  async custom(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    if (!body || Object.keys(body).some((key) => !['word', 'meaning'].includes(key)) || typeof body.word !== 'string' || typeof body.meaning !== 'string') {
      throw new BadRequestException('word and meaning are required');
    }
    return this.vocabulary.createCustomWord(await this.accountId(authorization), body.word, body.meaning);
  }

  @Post('import')
  async import(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    if (!body || Object.keys(body).some((key) => !['fileName', 'content'].includes(key)) || typeof body.fileName !== 'string' || typeof body.content !== 'string') {
      throw new BadRequestException('fileName and content are required');
    }
    return this.vocabulary.importWords(await this.accountId(authorization), body.fileName, body.content);
  }
}
