import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { effectiveSeconds, transitionTaskStatus, type CreateTaskInput, type PomodoroStatus, type TaskAction, type TaskStatus, type TaskSummary } from '@kaoyan/domain';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(accountId: string, input: CreateTaskInput): Promise<TaskSummary> {
    this.validateInput(input);
    const task = await this.prisma.task.create({
      data: { accountId, ...input, plannedDate: asUtcDate(input.plannedDate) },
    });
    return this.summary(task);
  }

  async listByDate(accountId: string, date: string): Promise<TaskSummary[]> {
    if (!isDate(date)) throw new BadRequestException('date must use YYYY-MM-DD');
    const start = asUtcDate(date);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const tasks = await this.prisma.task.findMany({
      where: { accountId, plannedDate: { gte: start, lt: end } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return tasks.map((task: any) => this.summary(task));
  }

  async updateStatus(accountId: string, taskId: string, action: TaskAction): Promise<TaskSummary> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, accountId } });
    if (!task) throw new NotFoundException('Task not found');
    let status: TaskStatus;
    try {
      status = transitionTaskStatus(task.status as TaskStatus, action);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (action === 'pause' || action === 'complete' || action === 'skip' || action === 'reschedule') {
      await this.closeActiveSession(taskId, action === 'pause' ? 'paused' : 'completed');
    }
    if (action === 'reschedule') {
      const nextDate = new Date(task.plannedDate.getTime() + 24 * 60 * 60 * 1000);
      const [updated, copy] = await this.prisma.$transaction([
        this.prisma.task.update({ where: { id: task.id }, data: { status: 'rescheduled' } }),
        this.prisma.task.create({
          data: {
            accountId,
            title: task.title,
            type: task.type,
            plannedMinutes: task.plannedMinutes,
            plannedDate: nextDate,
            priority: task.priority,
            sourceTaskId: task.id,
          },
        }),
      ]);
      return this.summary(copy ?? updated);
    }
    const updated = await this.prisma.task.update({ where: { id: task.id }, data: { status } });
    return this.summary(updated);
  }

  private async closeActiveSession(taskId: string, status: 'paused' | 'completed'): Promise<void> {
    const session = await this.prisma.pomodoroSession.findFirst({
      where: { taskId, status: { in: ['running', 'paused'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) return;
    const now = new Date();
    const seconds = effectiveSeconds({ ...session, status: session.status as PomodoroStatus }, now);
    await this.prisma.pomodoroSession.update({
      where: { id: session.id },
      data: {
        status,
        accumulatedSeconds: seconds,
        runningSince: null,
        pauseSegments: status === 'paused' && session.runningSince
          ? JSON.stringify([
              ...JSON.parse(session.pauseSegments || '[]'),
              { startedAt: session.runningSince.toISOString(), endedAt: now.toISOString() },
            ])
          : session.pauseSegments,
        endedAt: status === 'completed' ? now : null,
      },
    });
    if (status === 'completed') {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { completedMinutes: Math.floor(seconds / 60) },
      });
    }
  }

  private validateInput(input: CreateTaskInput): void {
    if (!input || typeof input !== 'object') throw new BadRequestException('Body must be an object');
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 160) {
      throw new BadRequestException('title must be a non-empty string up to 160 characters');
    }
    if (!['custom', 'vocabulary', 'sentence', 'school_search'].includes(input.type)) {
      throw new BadRequestException('type is invalid');
    }
    if (!Number.isInteger(input.plannedMinutes) || input.plannedMinutes < 1 || input.plannedMinutes > 1440) {
      throw new BadRequestException('plannedMinutes must be an integer from 1 to 1440');
    }
    if (!isDate(input.plannedDate)) throw new BadRequestException('plannedDate must use YYYY-MM-DD');
    if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 5) {
      throw new BadRequestException('priority must be an integer from 0 to 5');
    }
  }

  private summary(task: any): TaskSummary {
    return {
      id: task.id,
      title: task.title,
      type: task.type,
      plannedMinutes: task.plannedMinutes,
      plannedDate: task.plannedDate.toISOString().slice(0, 10),
      priority: task.priority,
      status: task.status,
      completedMinutes: task.completedMinutes ?? 0,
      sourceTaskId: task.sourceTaskId ?? null,
    };
  }
}

function isDate(value: string): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(asUtcDate(value).getTime()) && asUtcDate(value).toISOString().slice(0, 10) === value;
}

function asUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
