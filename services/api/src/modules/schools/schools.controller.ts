import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth.service';
import { SchoolsService } from './schools.service';

@Controller('v1/school-queries')
export class SchoolsController {
  constructor(private readonly auth: AuthService, private readonly schools: SchoolsService) {}

  private async accountId(authorization?: string): Promise<string> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return (await this.auth.getCurrentUser(token)).id;
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    if (!body || Object.keys(body).some((key) => key !== 'instruction') || typeof body.instruction !== 'string') throw new BadRequestException('instruction is required');
    return this.schools.create(await this.accountId(authorization), body.instruction);
  }

  @Get(':id')
  async get(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.schools.get(await this.accountId(authorization), id);
  }
}
