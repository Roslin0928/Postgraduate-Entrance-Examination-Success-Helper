import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { applyPomodoroEvent, effectiveSeconds, type PomodoroEventAction } from '@kaoyan/domain';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PomodoroService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(accountId: string, taskId: string, eventId: string, action: PomodoroEventAction) {
    if (typeof eventId !== 'string' || !eventId.trim() || eventId.length > 128) {
      throw new BadRequestException('eventId is required');
    }
    if (!['start', 'pause', 'resume', 'complete', 'sync'].includes(action)) {
      throw new BadRequestException('action is invalid');
    }
    const task = await this.prisma.task.findFirst({ where: { id: taskId, accountId } });
    if (!task) throw new NotFoundException('Task not found');
    const now = new Date();
    return this.prisma.$transaction(async (tx: any) => {
      const prior = await tx.pomodoroEvent.findUnique({
        where: { taskId_eventId: { taskId, eventId } },
        include: { session: true },
      });
      if (prior) return this.view(prior.session, now);

      let session = await tx.pomodoroSession.findFirst({
        where: { taskId, status: { in: ['running', 'paused'] } },
        orderBy: { startedAt: 'desc' },
      });
      if (action === 'sync') return session ? this.view(session, now) : this.emptyView();
      if (task.status === 'completed' || task.status === 'skipped' || task.status === 'rescheduled') {
        throw new BadRequestException('Task is no longer active');
      }
      if (!session && action !== 'start') throw new BadRequestException('No active pomodoro session');
      if (!session) {
        if (action !== 'start') throw new BadRequestException('No active pomodoro session');
        session = await tx.pomodoroSession.create({
          data: { taskId, status: 'running', startedAt: now, runningSince: now },
        });
        await tx.pomodoroEvent.create({ data: { taskId, sessionId: session.id, eventId, action: 'start', createdAt: now } });
        await tx.task.update({ where: { id: taskId }, data: { status: 'in_progress' } });
        return this.view(session, now);
      }

      let state;
      try {
        state = applyPomodoroEvent({
          status: session.status,
          accumulatedSeconds: session.accumulatedSeconds,
          runningSince: session.runningSince,
        }, action, now);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
      await tx.pomodoroEvent.create({ data: { taskId, sessionId: session.id, eventId, action, createdAt: now } });
      session = await tx.pomodoroSession.update({
        where: { id: session.id },
        data: {
          status: state.status,
          runningSince: state.runningSince,
          accumulatedSeconds: state.accumulatedSeconds,
          pauseSegments: action === 'pause'
            ? JSON.stringify([
                ...JSON.parse(session.pauseSegments || '[]'),
                { startedAt: session.runningSince?.toISOString(), endedAt: now.toISOString() },
              ])
            : session.pauseSegments,
          endedAt: state.status === 'completed' ? now : null,
        },
      });
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: state.status === 'completed' ? 'completed' : state.status === 'running' ? 'in_progress' : 'planned',
          completedMinutes: Math.floor(effectiveSeconds(state, now) / 60),
        },
      });
      return this.view(session, now);
    });
  }

  private view(session: any, now: Date) {
    const seconds = effectiveSeconds(session, now);
    return {
      sessionId: session.id,
      status: session.status,
      effectiveSeconds: seconds,
      effectiveMinutes: Math.floor(seconds / 60),
      runningSince: session.runningSince?.toISOString() ?? null,
    };
  }

  private emptyView() {
    return { sessionId: null, status: 'planned', effectiveSeconds: 0, effectiveMinutes: 0, runningSince: null };
  }
}
