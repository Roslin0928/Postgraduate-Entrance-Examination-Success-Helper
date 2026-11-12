import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth.service';
import { PrismaService } from '../src/prisma.service';

describe('tasks API', () => {
  let app: INestApplication;
  let prisma: any;
  const tasks = new Map<string, any>();
  const sessions = new Map<string, any>();
  const events = new Map<string, any>();
  let id = 0;

  beforeEach(async () => {
    tasks.clear(); sessions.clear(); events.clear(); id = 0;
    prisma = {
      task: {
        create: jest.fn(({ data }: any) => { const task = { id: `task-${++id}`, completedMinutes: 0, sourceTaskId: null, status: 'planned', createdAt: new Date(), ...data }; tasks.set(task.id, task); return task; }),
        findMany: jest.fn(({ where }: any) => [...tasks.values()].filter((task) => task.accountId === where.accountId && task.plannedDate >= where.plannedDate.gte && task.plannedDate < where.plannedDate.lt)),
        findFirst: jest.fn(({ where }: any) => { const task = tasks.get(where.id); return task?.accountId === where.accountId ? task : null; }),
        update: jest.fn(({ where, data }: any) => { const task = { ...tasks.get(where.id), ...data }; tasks.set(where.id, task); return task; }),
      },
      pomodoroSession: {
        findFirst: jest.fn(({ where }: any) => [...sessions.values()].filter((session) => session.taskId === where.taskId && where.status.in.includes(session.status)).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null),
        create: jest.fn(({ data }: any) => { const session = { id: `session-${++id}`, accumulatedSeconds: 0, ...data }; sessions.set(session.id, session); return session; }),
        update: jest.fn(({ where, data }: any) => { const session = { ...sessions.get(where.id), ...data }; sessions.set(where.id, session); return session; }),
      },
      pomodoroEvent: {
        findUnique: jest.fn(({ where }: any) => events.get(`${where.sessionId_eventId.sessionId}:${where.sessionId_eventId.eventId}`) ?? null),
        create: jest.fn(({ data }: any) => { const event = { id: `event-${++id}`, ...data }; events.set(`${data.sessionId}:${data.eventId}`, event); return event; }),
      },
      $transaction: jest.fn((input: any) => typeof input === 'function' ? input(prisma) : Promise.all(input)),
      $connect: jest.fn(), $disconnect: jest.fn(),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuthService).useValue({ getCurrentUser: jest.fn(async (token: string) => ({ id: token })) })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('ignores a client supplied accountId and only lists the authenticated user tasks', async () => {
    await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', 'Bearer user-a').send({
      title: 'Vocabulary', type: 'vocabulary', plannedMinutes: 25, plannedDate: '2026-11-12', priority: 2, accountId: 'user-b',
    }).expect(400);
    await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', 'Bearer user-a').send({
      title: 'Vocabulary', type: 'vocabulary', plannedMinutes: 25, plannedDate: '2026-11-12', priority: 2,
    }).expect(201);
    await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', 'Bearer user-b').send({
      title: 'Grammar', type: 'sentence', plannedMinutes: 30, plannedDate: '2026-11-12', priority: 1,
    }).expect(201);
    const result = await request(app.getHttpServer()).get('/v1/tasks?date=2026-11-12').set('Authorization', 'Bearer user-a').expect(200);
    expect(result.body).toHaveLength(1);
    expect(result.body[0].title).toBe('Vocabulary');
    expect([...tasks.values()].every((task) => task.accountId !== 'user-b' || task.title === 'Grammar')).toBe(true);
  });

  it('deduplicates eventIds and counts only running intervals', async () => {
    const created = await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', 'Bearer user-a').send({
      title: 'Reading', type: 'custom', plannedMinutes: 25, plannedDate: '2026-11-12', priority: 1,
    }).expect(201);
    const url = `/v1/tasks/${created.body.id}/pomodoro-events`;
    const start = await request(app.getHttpServer()).post(url).set('Authorization', 'Bearer user-a').send({ eventId: 'start-1', action: 'start' }).expect(201);
    const replay = await request(app.getHttpServer()).post(url).set('Authorization', 'Bearer user-a').send({ eventId: 'start-1', action: 'start' }).expect(201);
    expect(replay.body.sessionId).toBe(start.body.sessionId);
    expect(events.size).toBe(1);
    await request(app.getHttpServer()).post(url).set('Authorization', 'Bearer user-a').send({ eventId: 'pause-1', action: 'pause' }).expect(201);
    const task = tasks.get(created.body.id);
    expect(task.status).toBe('planned');
    const restored = await request(app.getHttpServer()).post(url).set('Authorization', 'Bearer user-a').send({ eventId: 'restore-1', action: 'sync' }).expect(201);
    expect(restored.body.status).toBe('paused');
    expect(events.size).toBe(2);
  });

  it('creates a next day copy with its source task id when rescheduled', async () => {
    const created = await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', 'Bearer user-a').send({
      title: 'Review', type: 'custom', plannedMinutes: 20, plannedDate: '2026-11-12', priority: 1,
    }).expect(201);
    const response = await request(app.getHttpServer()).patch(`/v1/tasks/${created.body.id}`).set('Authorization', 'Bearer user-a').send({ action: 'reschedule' }).expect(200);
    expect(response.body).toMatchObject({ plannedDate: '2026-11-13', sourceTaskId: created.body.id });
    expect(tasks.get(created.body.id).status).toBe('rescheduled');
  });
});
