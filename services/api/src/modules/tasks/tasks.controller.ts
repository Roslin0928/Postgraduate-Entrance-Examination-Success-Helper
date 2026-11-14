import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth.service';
import { TasksService } from './tasks.service';
import { PomodoroService } from './pomodoro.service';

@Controller('v1/tasks')
export class TasksController {
  constructor(
    private readonly authService: AuthService,
    private readonly tasks: TasksService,
    private readonly pomodoro: PomodoroService,
  ) {}

  private async accountId(authorization?: string): Promise<string> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return (await this.authService.getCurrentUser(token)).id;
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    const accountId = await this.accountId(authorization);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Body must be an object');
    const allowed = ['title', 'type', 'plannedMinutes', 'plannedDate', 'priority'];
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length) throw new BadRequestException(`Unsupported fields: ${unknown.join(', ')}`);
    return this.tasks.createTask(accountId, body);
  }

  @Get()
  async list(@Headers('authorization') authorization: string | undefined, @Query('date') date: string) {
    return this.tasks.listByDate(await this.accountId(authorization), date);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const accountId = await this.accountId(authorization);
    if (!body || Object.keys(body).some((key) => key !== 'action') ||
      !['start', 'pause', 'complete', 'skip', 'reschedule'].includes(body.action)) {
      throw new BadRequestException('action must be start, pause, complete, skip, or reschedule');
    }
    return this.tasks.updateStatus(accountId, id, body.action);
  }

  @Post(':id/pomodoro-events')
  async event(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') taskId: string,
    @Body() body: any,
  ) {
    const accountId = await this.accountId(authorization);
    if (!body || Object.keys(body).some((key) => !['eventId', 'action'].includes(key))) {
      throw new BadRequestException('Body must contain eventId and action only');
    }
    return this.pomodoro.recordEvent(accountId, taskId, body.eventId, body.action);
  }
}
