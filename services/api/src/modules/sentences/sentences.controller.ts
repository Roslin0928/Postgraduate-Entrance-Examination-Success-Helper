import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth.service';
import { SentencesService } from './sentences.service';

@Controller('v1/sentence-analyses')
export class SentencesController {
  constructor(private readonly auth: AuthService, private readonly sentences: SentencesService) {}

  private async accountId(authorization?: string): Promise<string> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return (await this.auth.getCurrentUser(token)).id;
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    if (!body || Object.keys(body).some((key) => !['sentence', 'mode'].includes(key)) || typeof body.sentence !== 'string' ||
      (body.mode !== undefined && typeof body.mode !== 'string')) throw new BadRequestException('sentence and optional mode are required');
    return this.sentences.create(await this.accountId(authorization), body.sentence, body.mode ?? 'detailed');
  }

  @Get()
  async history(@Headers('authorization') authorization: string | undefined) {
    return this.sentences.history(await this.accountId(authorization));
  }

  @Post(':id/retry')
  async retry(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.sentences.retry(await this.accountId(authorization), id);
  }

  @Patch(':id/status')
  async updateStatus(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() body: any) {
    if (!body || Object.keys(body).length !== 1 || !['understood', 'needs_review'].includes(body.status)) {
      throw new BadRequestException('status must be understood or needs_review');
    }
    return this.sentences.updateUnderstanding(await this.accountId(authorization), id, body.status);
  }
}
