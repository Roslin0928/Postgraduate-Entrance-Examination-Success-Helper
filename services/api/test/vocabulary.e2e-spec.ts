import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth.service';
import { PrismaService } from '../src/prisma.service';

describe('vocabulary API', () => {
  let app: INestApplication;
  const words = new Map<string, any>();
  const userWords = new Map<string, any>();
  const reviews: any[] = [];
  const tasks = new Map<string, any>();
  const imports: any[] = [];
  let prisma: any;
  let id = 0;

  beforeEach(async () => {
    words.clear(); userWords.clear(); reviews.length = 0; tasks.clear(); imports.length = 0; id = 0;
    prisma = {
      task: {
        findFirst: jest.fn(({ where }: any) => [...tasks.values()].find((task) => task.id === where.id ? task.accountId === where.accountId && task.type === where.type :
          task.accountId === where.accountId && task.type === where.type && task.plannedDate.getTime() === where.plannedDate.getTime()) ?? null),
        create: jest.fn(({ data }: any) => { const task = { id: `task-${++id}`, status: 'planned', completedMinutes: 0, ...data }; tasks.set(task.id, task); return task; }),
      },
      word: {
        findFirst: jest.fn(({ where }: any) => [...words.values()].find((word) =>
          (where.id ? word.id === where.id : word.source === where.source && word.normalizedWord === where.normalizedWord && word.ownerAccountId === where.ownerAccountId) &&
          (word.source === 'builtin_exam' || word.ownerAccountId === where.OR?.[1]?.ownerAccountId)) ?? null),
        create: jest.fn(({ data }: any) => { const word = { id: `word-${++id}`, ...data }; words.set(word.id, word); return word; }),
        upsert: jest.fn(({ where, create, update }: any) => {
          const key = `${where.ownerAccountId_normalizedWord.ownerAccountId}:${where.ownerAccountId_normalizedWord.normalizedWord}`;
          const existing = [...words.values()].find((word) => `${word.ownerAccountId}:${word.normalizedWord}` === key);
          if (existing) { Object.assign(existing, update); return existing; }
          const word = { id: `word-${++id}`, ...create }; words.set(word.id, word); return word;
        }),
      },
      userWord: {
        findUnique: jest.fn(({ where }: any) => userWords.get(`${where.accountId_wordId.accountId}:${where.accountId_wordId.wordId}`) ?? null),
        findMany: jest.fn(({ where }: any) => [...userWords.values()].filter((entry) => entry.accountId === where.accountId && entry.nextReviewAt <= where.nextReviewAt.lte &&
          ['builtin_exam', 'custom', 'imported'].includes(words.get(entry.wordId)?.source) &&
          (words.get(entry.wordId)?.source === 'builtin_exam' || words.get(entry.wordId)?.ownerAccountId === where.word.OR?.[1]?.ownerAccountId))
          .sort((a, b) => a.nextReviewAt - b.nextReviewAt || a.id.localeCompare(b.id)).map((entry) => ({ ...entry, word: words.get(entry.wordId) }))),
        upsert: jest.fn(({ where, create, update }: any) => {
          const key = `${where.accountId_wordId.accountId}:${where.accountId_wordId.wordId}`;
          const existing = userWords.get(key);
          if (existing) { Object.assign(existing, update); return existing; }
          const row = { id: `user-word-${++id}`, consecutiveKnown: 0, ...create }; userWords.set(key, row); return row;
        }),
      },
      wordReview: { create: jest.fn(({ data }: any) => { const row = { id: `review-${++id}`, ...data }; reviews.push(row); return row; }) },
      vocabularyImport: { create: jest.fn(({ data }: any) => { const row = { id: `import-${++id}`, ...data }; imports.push(row); return row; }) },
      $transaction: jest.fn((callback: any) => callback(prisma)),
      $connect: jest.fn(), $disconnect: jest.fn(),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuthService).useValue({ getCurrentUser: jest.fn(async (token: string) => ({ id: token })) })
      .compile();
    app = module.createNestApplication(); await app.init();
  });
  afterEach(async () => app.close());

  it('isolates custom words and due queues by authenticated account', async () => {
    const a = await request(app.getHttpServer()).post('/v1/vocabulary/custom').set('Authorization', 'Bearer user-a').send({ word: 'apple', meaning: '苹果' }).expect(201);
    const b = await request(app.getHttpServer()).post('/v1/vocabulary/custom').set('Authorization', 'Bearer user-b').send({ word: 'book', meaning: '书' }).expect(201);
    const dueA = await request(app.getHttpServer()).get('/v1/vocabulary/due').set('Authorization', 'Bearer user-a').set('x-time-zone', 'Asia/Shanghai').expect(200);
    expect(dueA.body.items.map((item: any) => item.id)).toContain(a.body[0].id);
    expect(dueA.body.items.map((item: any) => item.id)).not.toContain(b.body[0].id);
    expect(dueA.body.items.filter((item: any) => item.source === 'builtin_exam')).toHaveLength(5);
    expect(dueA.body.count).toBe(6);
    expect([...tasks.values()].find((task) => task.accountId === 'user-a')?.type).toBe('vocabulary');
    await request(app.getHttpServer()).get('/v1/vocabulary/due').set('Authorization', 'Bearer user-a').set('x-time-zone', 'bad-zone').expect(400);
  });

  it('records same-task and free reviews and rejects words owned by another account', async () => {
    const a = await request(app.getHttpServer()).post('/v1/vocabulary/custom').set('Authorization', 'Bearer user-a').send({ word: 'apple', meaning: '苹果' }).expect(201);
    await request(app.getHttpServer()).post('/v1/vocabulary/custom').set('Authorization', 'Bearer user-b').send({ word: 'book', meaning: '书' }).expect(201);
    const task = await request(app.getHttpServer()).get('/v1/vocabulary/due').set('Authorization', 'Bearer user-a').expect(200);
    const taskId = task.body.taskId;
    await request(app.getHttpServer()).post(`/v1/vocabulary/${a.body[0].id}/reviews`).set('Authorization', 'Bearer user-a').send({ feedback: 'known', taskId }).expect(201);
    await request(app.getHttpServer()).post(`/v1/vocabulary/${a.body[0].id}/reviews`).set('Authorization', 'Bearer user-a').send({ feedback: 'fuzzy' }).expect(201);
    const otherId = [...words.values()].find((word) => word.ownerAccountId === 'user-b').id;
    await request(app.getHttpServer()).post(`/v1/vocabulary/${otherId}/reviews`).set('Authorization', 'Bearer user-a').send({ feedback: 'known' }).expect(404);
    expect(reviews.map((review) => review.taskId)).toEqual([taskId, null]);
    expect(reviews.every((review) => review.accountId === 'user-a')).toBe(true);
  });

  it('requires authentication and rejects reviews associated with non-vocabulary tasks', async () => {
    await request(app.getHttpServer()).get('/v1/vocabulary/due').expect(401);
    await request(app.getHttpServer()).post('/v1/vocabulary/custom').send({ word: 'apple', meaning: '苹果' }).expect(401);
    const word = await request(app.getHttpServer()).post('/v1/vocabulary/custom').set('Authorization', 'Bearer user-a')
      .send({ word: 'apple', meaning: '苹果' }).expect(201);
    tasks.set('task-custom', { id: 'task-custom', accountId: 'user-a', type: 'custom' });
    await request(app.getHttpServer()).post(`/v1/vocabulary/${word.body[0].id}/reviews`)
      .set('Authorization', 'Bearer user-a').send({ feedback: 'known', taskId: 'task-custom' }).expect(404);
    expect(reviews).toHaveLength(0);
  });

  it('imports valid rows and stores filename, counts, and line errors', async () => {
    const response = await request(app.getHttpServer()).post('/v1/vocabulary/import').set('Authorization', 'Bearer user-a')
      .send({ fileName: 'words.tsv', content: 'word\tmeaning\napple\t苹果\n\t缺词\napple\t重复' }).expect(201);
    expect(response.body).toMatchObject({ totalRows: 3, successCount: 1, errors: [{ line: 3, reason: 'missing_word' }, { line: 4, reason: 'duplicate' }] });
    expect(imports[0]).toMatchObject({ accountId: 'user-a', fileName: 'words.tsv', totalRows: 3, successCount: 1 });
  });
});
