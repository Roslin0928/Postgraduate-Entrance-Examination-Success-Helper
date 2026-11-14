import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../services/api/src/app.module';
import { PrismaService } from '../../services/api/src/prisma.service';
import { createE2ePrisma } from './test-state';

describe('account to study e2e', () => {
  let app: INestApplication;
  const fixture = createE2ePrisma();
  const today = new Date().toISOString().slice(0, 10);
  let token: string;
  let accountId: string;

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

  it('keeps login, profile, task, timer, vocabulary, sentence, and analytics on one account', async () => {
    const login = await request(app.getHttpServer()).post('/v1/auth/wechat-login').send({ code: 'flow-user-code' }).expect(201);
    token = login.body.accessToken;
    expect(typeof token).toBe('string');
    const session = [...fixture.state.sessions.values()][0];
    accountId = session.accountId;

    const profile = await request(app.getHttpServer()).patch('/v1/exam-profile').set('Authorization', `Bearer ${token}`)
      .send({ targetExamDate: '2027-12-25', targetSchoolId: 'school-123', major: '计算机', dailyGoalMinutes: 240 }).expect(200);
    expect(profile.body).toMatchObject({ targetExamDate: '2027-12-25', targetSchoolId: 'school-123', major: '计算机', dailyGoalMinutes: 240 });
    expect(fixture.state.profiles.get(accountId).accountId).toBe(accountId);

    const task = await request(app.getHttpServer()).post('/v1/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: '阅读真题', type: 'custom', plannedMinutes: 25, plannedDate: today, priority: 2 }).expect(201);
    expect(fixture.state.tasks.get(task.body.id).accountId).toBe(accountId);

    const started = await request(app.getHttpServer()).post(`/v1/tasks/${task.body.id}/pomodoro-events`)
      .set('Authorization', `Bearer ${token}`).send({ eventId: 'flow-start', action: 'start' }).expect(201);
    const completed = await request(app.getHttpServer()).post(`/v1/tasks/${task.body.id}/pomodoro-events`)
      .set('Authorization', `Bearer ${token}`).send({ eventId: 'flow-complete', action: 'complete' }).expect(201);
    expect(started.body.sessionId).toBe(completed.body.sessionId);
    expect(fixture.state.tasks.get(task.body.id).accountId).toBe(accountId);
    expect(fixture.state.pomodoros.get(started.body.sessionId).taskId).toBe(task.body.id);

    const due = await request(app.getHttpServer()).get('/v1/vocabulary/due').set('Authorization', `Bearer ${token}`).expect(200);
    const wordId = due.body.items[0].id;
    const review = await request(app.getHttpServer()).post(`/v1/vocabulary/${wordId}/reviews`).set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'known', taskId: due.body.taskId }).expect(201);
    expect(review.body.wordId).toBe(wordId);
    expect(fixture.state.tasks.get(due.body.taskId).accountId).toBe(accountId);
    expect(fixture.state.reviews.at(-1)).toMatchObject({ accountId, taskId: due.body.taskId, feedback: 'known' });

    const privateSentence = 'Although the experiment was brief, the result was useful.';
    const sentence = await request(app.getHttpServer()).post('/v1/sentence-analyses').set('Authorization', `Bearer ${token}`)
      .send({ sentence: privateSentence }).expect(201);
    expect(sentence.body.status).toBe('completed');
    expect(fixture.state.sentenceAnalyses.get(sentence.body.id)).toMatchObject({ accountId, original: privateSentence });

    const analytics = await request(app.getHttpServer()).get(`/v1/analytics/daily?date=${today}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(analytics.body).toMatchObject({ date: today, plannedTasks: 2, completedTasks: 1, vocabularyReviews: 1, sentenceAnalyses: 1 });
    expect(analytics.body.effectiveMinutes).toBeGreaterThanOrEqual(0);
    expect([...fixture.state.tasks.values()].every((row) => row.accountId === accountId)).toBe(true);
    expect([...fixture.state.words.values()].every((row) => row.source === 'builtin_exam' || row.ownerAccountId === accountId)).toBe(true);
    expect([...fixture.state.userWords.values()].every((row) => row.accountId === accountId)).toBe(true);
    expect(fixture.state.reviews.every((row) => row.accountId === accountId)).toBe(true);
    expect([...fixture.state.sentenceAnalyses.values()].every((row) => row.accountId === accountId)).toBe(true);

    await request(app.getHttpServer()).get(`/v1/tasks?date=${today}`).expect(401);
    await request(app.getHttpServer()).get('/v1/vocabulary/due').expect(401);
    await request(app.getHttpServer()).get('/v1/sentence-analyses').expect(401);
    await request(app.getHttpServer()).get(`/v1/analytics/daily?date=${today}`).expect(401);

    const otherLogin = await request(app.getHttpServer()).post('/v1/auth/wechat-login').send({ code: 'other-account-code' }).expect(201);
    const otherToken = otherLogin.body.accessToken;
    const otherCustomWord = await request(app.getHttpServer()).post('/v1/vocabulary/custom').set('Authorization', `Bearer ${otherToken}`)
      .send({ word: 'isolate', meaning: '隔离' }).expect(201);
    await request(app.getHttpServer()).patch(`/v1/tasks/${task.body.id}`).set('Authorization', `Bearer ${otherToken}`)
      .send({ action: 'complete' }).expect(404);
    await request(app.getHttpServer()).post(`/v1/vocabulary/${otherCustomWord.body[0].id}/reviews`).set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'known' }).expect(404);
    await request(app.getHttpServer()).patch(`/v1/sentence-analyses/${sentence.body.id}/status`).set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'understood' }).expect(404);
    const otherAnalytics = await request(app.getHttpServer()).get(`/v1/analytics/daily?date=${today}`)
      .set('Authorization', `Bearer ${otherToken}`).expect(200);
    expect(otherAnalytics.body).toMatchObject({ plannedTasks: 0, vocabularyReviews: 0, sentenceAnalyses: 0, effectiveMinutes: 0 });
  });
});
