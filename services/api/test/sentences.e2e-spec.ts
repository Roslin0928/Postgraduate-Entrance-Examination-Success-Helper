import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth.service';
import { PrismaService } from '../src/prisma.service';
import { SENTENCE_ANALYSIS_PROVIDER } from '../src/modules/sentences/analysis-provider';

describe('sentence analysis API', () => {
  let app: INestApplication;
  const records = new Map<string, any>();
  let id = 0;
  let prisma: any;
  let provider: { analyze: jest.Mock };

  beforeEach(async () => {
    records.clear(); id = 0;
    prisma = {
      sentenceAnalysis: {
        create: jest.fn(({ data }: any) => { const row = { id: `sentence-${++id}`, createdAt: new Date(), ...data }; records.set(row.id, row); return row; }),
        update: jest.fn(({ where, data }: any) => { const row = records.get(where.id); Object.assign(row, data); return row; }),
        findMany: jest.fn(({ where }: any) => [...records.values()].filter((row) => row.accountId === where.accountId).sort((a, b) => b.createdAt - a.createdAt)),
        findFirst: jest.fn(({ where }: any) => { const row = records.get(where.id); return row?.accountId === where.accountId ? row : null; }),
      },
      $connect: jest.fn(), $disconnect: jest.fn(),
    };
    provider = { analyze: jest.fn(async (input: string) => ({ original: input, chunks: [{ text: input, role: 'other' }], mainClause: input, grammarPoints: ['clause'], literalTranslation: '直译', naturalTranslation: '意译' })) };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuthService).useValue({ getCurrentUser: jest.fn(async (token: string) => ({ id: token })) })
      .overrideProvider(SENTENCE_ANALYSIS_PROVIDER).useValue(provider)
      .compile();
    app = module.createNestApplication(); await app.init();
  });
  afterEach(async () => app.close());

  it('persists successful analyses and isolates history by authenticated account', async () => {
    const a = await request(app.getHttpServer()).post('/v1/sentence-analyses').set('Authorization', 'Bearer user-a').send({ sentence: 'A sentence.', mode: 'detailed' }).expect(201);
    await request(app.getHttpServer()).post('/v1/sentence-analyses').set('Authorization', 'Bearer user-b').send({ sentence: 'Other sentence.' }).expect(201);
    expect(a.body).toMatchObject({ status: 'completed', original: 'A sentence.', understandingStatus: 'needs_review' });
    expect((await request(app.getHttpServer()).get('/v1/sentence-analyses').set('Authorization', 'Bearer user-a').expect(200)).body).toHaveLength(1);
    await request(app.getHttpServer()).get('/v1/sentence-analyses').expect(401);
  });

  it('rejects sentences over 2,000 characters without calling the provider', async () => {
    await request(app.getHttpServer()).post('/v1/sentence-analyses').set('Authorization', 'Bearer user-a').send({ sentence: 'x'.repeat(2001) }).expect(400);
    expect(provider.analyze).not.toHaveBeenCalled();
    expect(records.size).toBe(0);
  });

  it('stores a retryable draft when the provider fails and allows retry', async () => {
    provider.analyze.mockRejectedValueOnce(new Error('timeout'));
    const failed = await request(app.getHttpServer()).post('/v1/sentence-analyses').set('Authorization', 'Bearer user-a').send({ sentence: 'Keep this sentence.', mode: 'brief' }).expect(201);
    expect(failed.body).toMatchObject({ original: 'Keep this sentence.', status: 'retryable', errorMessage: expect.any(String) });
    const retried = await request(app.getHttpServer()).post(`/v1/sentence-analyses/${failed.body.id}/retry`).set('Authorization', 'Bearer user-a').expect(201);
    expect(retried.body.status).toBe('completed');
    expect(provider.analyze).toHaveBeenCalledTimes(2);
  });

  it('lets only the owner update understanding status', async () => {
    const record = await request(app.getHttpServer()).post('/v1/sentence-analyses').set('Authorization', 'Bearer user-a').send({ sentence: 'Ownership matters.' }).expect(201);
    await request(app.getHttpServer()).patch(`/v1/sentence-analyses/${record.body.id}/status`).set('Authorization', 'Bearer user-b').send({ status: 'understood' }).expect(404);
    await request(app.getHttpServer()).patch(`/v1/sentence-analyses/${record.body.id}/status`).set('Authorization', 'Bearer user-a').send({ status: 'understood' }).expect(200).then(({ body }) => expect(body.understandingStatus).toBe('understood'));
  });
});
