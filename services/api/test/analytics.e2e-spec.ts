import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth.service';
import { PrismaService } from '../src/prisma.service';

describe('analytics API', () => {
  let app: INestApplication;
  let prisma: any;
  const today = '2026-11-12';
  const rows = {
    task: [
      { id: 't1', accountId: 'user-a', plannedDate: new Date('2026-11-13T00:00:00Z'), status: 'completed', completedMinutes: 30, plannedMinutes: 30 },
      { id: 't2', accountId: 'user-a', plannedDate: new Date('2026-11-13T00:00:00Z'), status: 'planned', completedMinutes: 0, plannedMinutes: 25 },
    ],
    pomodoroSession: [{ id: 'p1', taskId: 't1', status: 'completed', startedAt: new Date('2026-11-12T16:30:00Z'), accumulatedSeconds: 1800 }],
    wordReview: [{ id: 'w1', accountId: 'user-a', reviewedAt: new Date('2026-11-12T16:45:00Z'), feedback: 'known' }],
    sentenceAnalysis: [{ id: 's1', accountId: 'user-a', createdAt: new Date('2026-11-12T16:50:00Z'), status: 'completed' }],
    userWord: [{ id: 'uw1', accountId: 'user-a', consecutiveKnown: 2 }, { id: 'uw2', accountId: 'user-a', consecutiveKnown: 4 }],
  };

  beforeEach(async () => {
    const matches = (where: any, row: any, dateField: string) => row.accountId === where.accountId && row[dateField] >= where[dateField].gte && row[dateField] < where[dateField].lt;
    prisma = {
      task: { findMany: jest.fn(({ where }: any) => rows.task.filter((row) => matches(where, row, 'plannedDate'))) },
      pomodoroSession: { findMany: jest.fn(({ where }: any) => rows.pomodoroSession.filter((row) => row.status === 'completed' && row.startedAt >= where.startedAt.gte && row.startedAt < where.startedAt.lt)) },
      wordReview: { findMany: jest.fn(({ where }: any) => rows.wordReview.filter((row) => matches(where, row, 'reviewedAt'))) },
      sentenceAnalysis: { findMany: jest.fn(({ where }: any) => rows.sentenceAnalysis.filter((row) => row.accountId === where.accountId && row.status === 'completed' && row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt)) },
      userWord: { findMany: jest.fn(({ where }: any) => rows.userWord.filter((row) => row.accountId === where.accountId)) },
      $connect: jest.fn(), $disconnect: jest.fn(),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuthService).useValue({ getCurrentUser: jest.fn(async (token: string) => ({ id: token })) })
      .compile();
    app = module.createNestApplication(); await app.init();
  });
  afterEach(async () => app.close());

  it('aggregates daily plan, completion, focus, review, and sentence counts using the local day boundary', async () => {
    const response = await request(app.getHttpServer()).get('/v1/analytics/daily?date=2026-11-13')
      .set('Authorization', 'Bearer user-a').set('x-time-zone', 'Asia/Shanghai').expect(200);
    expect(response.body).toMatchObject({ date: '2026-11-13', plannedTasks: 2, completedTasks: 1, effectiveMinutes: 30, vocabularyReviews: 1, sentenceAnalyses: 1 });
    expect(prisma.task.findMany).toHaveBeenCalledWith({ where: { accountId: 'user-a', plannedDate: { gte: new Date('2026-11-13T00:00:00.000Z'), lt: new Date('2026-11-14T00:00:00.000Z') } } });
    expect(prisma.wordReview.findMany).toHaveBeenCalledWith({ where: { accountId: 'user-a', reviewedAt: { gte: new Date('2026-11-12T16:00:00.000Z'), lt: new Date('2026-11-13T16:00:00.000Z') } } });
    expect(prisma.task.findMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'user-b' }) }));
  });

  it('counts UTC-midnight planned dates in negative-offset local days', async () => {
    const response = await request(app.getHttpServer()).get('/v1/analytics/daily?date=2026-11-13')
      .set('Authorization', 'Bearer user-a').set('x-time-zone', 'America/Los_Angeles').expect(200);
    expect(response.body).toMatchObject({ plannedTasks: 2, completedTasks: 1 });
    expect(prisma.task.findMany).toHaveBeenCalledWith({ where: { accountId: 'user-a', plannedDate: { gte: new Date('2026-11-13T00:00:00.000Z'), lt: new Date('2026-11-14T00:00:00.000Z') } } });
    expect(prisma.wordReview.findMany).toHaveBeenCalledWith({ where: { accountId: 'user-a', reviewedAt: { gte: new Date('2026-11-13T08:00:00.000Z'), lt: new Date('2026-11-14T08:00:00.000Z') } } });
  });

  it('returns zero-filled buckets for empty days and a Monday-to-Sunday week', async () => {
    prisma.task.findMany.mockResolvedValue([]); prisma.pomodoroSession.findMany.mockResolvedValue([]);
    prisma.wordReview.findMany.mockResolvedValue([]); prisma.sentenceAnalysis.findMany.mockResolvedValue([]);
    prisma.userWord.findMany.mockResolvedValue([]);
    const daily = await request(app.getHttpServer()).get('/v1/analytics/daily?date=2026-11-13').set('Authorization', 'Bearer user-a').expect(200);
    expect(daily.body).toMatchObject({ plannedTasks: 0, completedTasks: 0, effectiveMinutes: 0, vocabularyReviews: 0, sentenceAnalyses: 0, vocabularyFamiliarityChange: 0 });
    const weekly = await request(app.getHttpServer()).get('/v1/analytics/weekly?date=2026-11-12').set('Authorization', 'Bearer user-a').expect(200);
    expect(weekly.body.days).toHaveLength(7);
    expect(weekly.body.days.map((day: any) => day.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(weekly.body.days.every((day: any) => day.effectiveMinutes === 0)).toBe(true);
  });
});
