import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth.service';
import { PrismaService } from '../src/prisma.service';
import { SCHOOL_SEARCH_PROVIDER } from '../src/modules/schools/search-provider';

describe('school query API', () => {
  let app: INestApplication;
  const records = new Map<string, any>();
  let prisma: any;
  let provider: { search: jest.Mock };
  let id = 0;

  beforeEach(async () => {
    records.clear(); id = 0;
    prisma = {
      schoolQuery: {
        create: jest.fn(({ data }: any) => { const row = { id: `query-${++id}`, createdAt: new Date(), updatedAt: new Date(), ...data }; records.set(row.id, row); return row; }),
        findFirst: jest.fn(({ where }: any) => { const row = records.get(where.id); return row?.accountId === where.accountId ? row : null; }),
        update: jest.fn(({ where, data }: any) => { const row = { ...records.get(where.id), ...data, updatedAt: new Date() }; records.set(where.id, row); return row; }),
      },
      $connect: jest.fn(), $disconnect: jest.fn(),
    };
    provider = { search: jest.fn(async () => ({ items: [{ schoolName: '示例大学', majorName: '计算机', fields: { city: '北京' }, sourceUrl: 'https://example.edu/admission', sourceName: '示例大学招生网', updatedAt: '2026-11-01T00:00:00.000Z' }], searchedAt: '2026-11-12T00:00:00.000Z' })) };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuthService).useValue({ getCurrentUser: jest.fn(async (token: string) => ({ id: token })) })
      .overrideProvider(SCHOOL_SEARCH_PROVIDER).useValue(provider)
      .compile();
    app = module.createNestApplication(); await app.init();
  });
  afterEach(async () => app.close());

  it('normalizes a natural language query and persists provider provenance', async () => {
    const response = await request(app.getHttpServer()).post('/v1/school-queries').set('Authorization', 'Bearer user-a')
      .send({ instruction: '2027年想在北京读计算机，优先双一流' }).expect(201);
    expect(provider.search).toHaveBeenCalledWith({ year: 2027, major: '计算机', region: '北京', schoolType: '双一流', constraints: ['双一流'] });
    expect(response.body).toMatchObject({ query: { year: 2027, major: '计算机', region: '北京', constraints: ['双一流'] }, results: [{ schoolName: '示例大学', sourceUrl: 'https://example.edu/admission', sourceName: '示例大学招生网', updatedAt: '2026-11-01T00:00:00.000Z' }] });
    expect((await request(app.getHttpServer()).get(`/v1/school-queries/${response.body.id}`).set('Authorization', 'Bearer user-a').expect(200)).body.results[0].sourceUrl).toBe('https://example.edu/admission');
    await request(app.getHttpServer()).get(`/v1/school-queries/${response.body.id}`).set('Authorization', 'Bearer user-b').expect(404);
  });

  it('stores empty and timed out searches as retryable results with a reason', async () => {
    provider.search.mockResolvedValueOnce({ items: [], searchedAt: '2026-11-12T00:00:00.000Z' });
    const empty = await request(app.getHttpServer()).post('/v1/school-queries').set('Authorization', 'Bearer user-a').send({ instruction: '找计算机专业' }).expect(201);
    expect(empty.body).toMatchObject({ status: 'no_results', reason: expect.any(String), results: [] });
    provider.search.mockImplementationOnce(() => new Promise(() => undefined));
    const timeout = await request(app.getHttpServer()).post('/v1/school-queries').set('Authorization', 'Bearer user-a').send({ instruction: '找北京大学' }).expect(201);
    expect(timeout.body).toMatchObject({ status: 'retryable', reason: '搜索超时，请稍后重试或修改条件。', results: [] });
  }, 10000);
});
