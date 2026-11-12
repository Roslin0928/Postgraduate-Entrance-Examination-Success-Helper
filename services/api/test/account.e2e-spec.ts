import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('account and exam profile API', () => {
  let app: INestApplication;
  let account: any;
  let session: any;
  let profile: any;

  beforeEach(async () => {
    account = null;
    session = null;
    profile = null;
    const prisma = {
      account: {
        findUnique: jest.fn(({ where }: any) =>
          where.wechatOpenId ? account : session?.account ?? null,
        ),
        create: jest.fn(({ data }: any) => {
          account = {
            id: 'account-1',
            nickname: null,
            avatarUrl: null,
            phoneBound: false,
            ...data,
          };
          return account;
        }),
      },
      authSession: {
        create: jest.fn(({ data }: any) => {
          session = {
            ...data,
            account: { ...account, examProfile: profile },
          };
          return session;
        }),
        findUnique: jest.fn(() => session && { ...session, account: { ...account, examProfile: profile } }),
      },
      examProfile: {
        findUnique: jest.fn(() => profile),
        upsert: jest.fn(({ create, update }: any) => {
          profile = { id: 'profile-1', ...create, ...update };
          return profile;
        }),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('logs in with a WeChat code and returns the current account', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/wechat-login')
      .send({ code: 'local-test-code' })
      .expect(201);

    expect(login.body).toMatchObject({ isNewUser: true });
    expect(typeof login.body.accessToken).toBe('string');

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ id: 'account-1', phoneBound: false, examProfile: null });
  });

  it('allows saving an exam profile without choosing a target school', async () => {
    const { body: login } = await request(app.getHttpServer())
      .post('/v1/auth/wechat-login')
      .send({ code: 'profile-test-code' })
      .expect(201);

    const saved = await request(app.getHttpServer())
      .patch('/v1/exam-profile')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ targetExamDate: '2027-12-25', targetSchoolId: null, dailyGoalMinutes: 200 })
      .expect(200);

    expect(saved.body).toMatchObject({
      targetExamDate: '2027-12-25',
      targetSchoolId: null,
      dailyGoalMinutes: 200,
    });
    await request(app.getHttpServer())
      .patch('/v1/exam-profile')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ unsupported: true })
      .expect(400);
  });
});
