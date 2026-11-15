import { BadRequestException, Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth.service';
import { AnalyticsService } from './analytics.service';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly auth: AuthService, private readonly analytics: AnalyticsService) {}

  private async accountId(authorization?: string): Promise<string> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return (await this.auth.getCurrentUser(token)).id;
  }

  @Get('daily')
  async daily(@Headers('authorization') authorization: string | undefined, @Headers('x-time-zone') timeZone: string | undefined, @Query('date') date: string) {
    if (!date) throw new BadRequestException('date is required');
    return this.analytics.daily(await this.accountId(authorization), date, timeZone || 'UTC');
  }

  @Get('weekly')
  async weekly(@Headers('authorization') authorization: string | undefined, @Headers('x-time-zone') timeZone: string | undefined, @Query('date') date: string) {
    if (!date) throw new BadRequestException('date is required');
    return this.analytics.weekly(await this.accountId(authorization), date, timeZone || 'UTC');
  }
}
