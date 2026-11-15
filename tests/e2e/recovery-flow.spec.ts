import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../services/api/src/app.module';
import { PrismaService } from '../../services/api/src/prisma.service';
import { createE2ePrisma } from './test-state';

describe('recovery flow e2e', () => {
  let app: INestApplication;
  const fixture = createE2ePrisma();
  const today = new Date().toISOString().slice(0, 10);
  const login = async () => request(app.getHttpServer()).post('/v1/auth/wechat-login').send({ code: 'recover-user-code' }).expect(201);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.WECHAT_PROVIDER = 'fake';
    process.env.SENTENCE_ANALYSIS_PROVIDER = 'fake';
    process.env.SCHOOL_SEARCH_PROVIDER = 'fake';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(fixture.prisma).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('restores a paused session once after relogin and reschedules the traceable task', async () => {
    const firstLogin = await login();
    const firstToken = firstLogin.body.accessToken;
    const accountId = [...fixture.state.sessions.values()][0].accountId;
    const created = await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', `Bearer ${firstToken}`)
      .send({ title: '背单词', type: 'vocabulary', plannedMinutes: 20, plannedDate: today, priority: 1 }).expect(201);
    const url = `/v1/tasks/${created.body.id}/pomodoro-events`;
    const start = await request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${firstToken}`)
      .send({ eventId: 'recovery-start', action: 'start' }).expect(201);

    const active = fixture.state.pomodoros.get(start.body.sessionId);
    active.runningSince = new Date(Date.now() - 125_000);
    await request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${firstToken}`)
      .send({ eventId: 'recovery-pause', action: 'pause' }).expect(201);
    const afterPause = fixture.state.pomodoros.get(start.body.sessionId).accumulatedSeconds;
    expect(afterPause).toBeGreaterThanOrEqual(120);
    expect(fixture.state.tasks.get(created.body.id).accountId).toBe(accountId);

    // Simulate the mini program being closed: discard the in-memory client token, then log in again.
    const secondLogin = await login();
    const restoredToken = secondLogin.body.accessToken;
    expect(restoredToken).not.toBe(firstToken);
    expect([...fixture.state.sessions.values()].at(-1).accountId).toBe(accountId);
    const restored = await request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${restoredToken}`)
      .send({ eventId: 'recovery-sync', action: 'sync' }).expect(201);
    expect(restored.body).toMatchObject({ sessionId: start.body.sessionId, status: 'paused' });
    expect(restored.body.effectiveSeconds).toBe(afterPause);

    const rescheduled = await request(app.getHttpServer()).patch(`/v1/tasks/${created.body.id}`).set('Authorization', `Bearer ${restoredToken}`)
      .send({ action: 'reschedule' }).expect(200);
    expect(rescheduled.body).toMatchObject({ plannedDate: new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 86400000).toISOString().slice(0, 10), sourceTaskId: created.body.id });
    expect(fixture.state.tasks.get(created.body.id)).toMatchObject({ status: 'rescheduled', accountId });
    expect(fixture.state.tasks.get(rescheduled.body.id)).toMatchObject({ accountId, sourceTaskId: created.body.id });
    expect(fixture.state.pomodoros.get(start.body.sessionId).accumulatedSeconds).toBe(afterPause);
    expect(fixture.state.events.size).toBe(2);
  });
});
