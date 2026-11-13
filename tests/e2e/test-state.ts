import { createHash } from 'node:crypto';

export function createE2ePrisma() {
  let sequence = 0;
  const id = (prefix: string) => `${prefix}-${++sequence}`;
  const accounts = new Map<string, any>();
  const sessions = new Map<string, any>();
  const profiles = new Map<string, any>();
  const tasks = new Map<string, any>();
  const pomodoros = new Map<string, any>();
  const events = new Map<string, any>();
  const words = new Map<string, any>();
  const userWords = new Map<string, any>();
  const reviews: any[] = [];
  const sentenceAnalyses = new Map<string, any>();

  const accountForTokenHash = (tokenHash: string) => {
    const session = sessions.get(tokenHash);
    if (!session) return null;
    return { ...session, account: { ...accounts.get(session.accountId), examProfile: profiles.get(session.accountId) ?? null } };
  };
  const prisma: any = {
    account: {
      findUnique: jest.fn(({ where }: any) => [...accounts.values()].find((account) => account.wechatOpenId === where.wechatOpenId) ?? null),
      create: jest.fn(({ data }: any) => { const account = { id: id('account'), nickname: null, avatarUrl: null, phoneBound: false, ...data }; accounts.set(account.id, account); return account; }),
    },
    authSession: {
      create: jest.fn(({ data }: any) => { const row = { id: id('auth'), ...data }; sessions.set(row.tokenHash, row); return row; }),
      findUnique: jest.fn(({ where }: any) => accountForTokenHash(where.tokenHash)),
    },
    examProfile: {
      findUnique: jest.fn(({ where }: any) => profiles.get(where.accountId) ?? null),
      upsert: jest.fn(({ where, create, update }: any) => { const row = { id: id('profile'), ...profiles.get(where.accountId), ...create, ...update }; profiles.set(where.accountId, row); return row; }),
    },
    task: {
      create: jest.fn(({ data }: any) => { const row = { id: id('task'), status: 'planned', completedMinutes: 0, sourceTaskId: null, createdAt: new Date(), ...data }; tasks.set(row.id, row); return row; }),
      findMany: jest.fn(({ where }: any) => [...tasks.values()].filter((row) => row.accountId === (where.accountId ?? where.task?.accountId) && (!where.plannedDate || (row.plannedDate >= where.plannedDate.gte && row.plannedDate < where.plannedDate.lt)))),
      findFirst: jest.fn(({ where }: any) => [...tasks.values()].find((row) => row.id === where.id ? row.accountId === where.accountId : row.accountId === where.accountId && row.type === where.type && (!where.plannedDate || row.plannedDate.getTime() === where.plannedDate.getTime())) ?? null),
      update: jest.fn(({ where, data }: any) => { const row = { ...tasks.get(where.id), ...data }; tasks.set(row.id, row); return row; }),
    },
    pomodoroSession: {
      findFirst: jest.fn(({ where }: any) => [...pomodoros.values()].filter((row) => row.taskId === where.taskId && where.status.in.includes(row.status)).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null),
      findMany: jest.fn(({ where }: any) => [...pomodoros.values()].filter((row) => ['completed', 'paused'].includes(row.status) && row.startedAt >= where.startedAt.gte && row.startedAt < where.startedAt.lt && tasks.get(row.taskId)?.accountId === where.task.accountId)),
      create: jest.fn(({ data }: any) => { const row = { id: id('pomodoro'), accumulatedSeconds: 0, pauseSegments: '[]', ...data }; pomodoros.set(row.id, row); return row; }),
      update: jest.fn(({ where, data }: any) => { const row = { ...pomodoros.get(where.id), ...data }; pomodoros.set(row.id, row); return row; }),
    },
    pomodoroEvent: {
      findUnique: jest.fn(({ where, include }: any) => { const event = events.get(`${where.taskId_eventId.taskId}:${where.taskId_eventId.eventId}`); return event && include?.session ? { ...event, session: pomodoros.get(event.sessionId) } : event ?? null; }),
      create: jest.fn(({ data }: any) => { const row = { id: id('event'), ...data }; events.set(`${row.taskId}:${row.eventId}`, row); return row; }),
    },
    word: {
      findFirst: jest.fn(({ where }: any) => [...words.values()].find((row) => where.id ? row.id === where.id && (row.source === 'builtin_exam' || row.ownerAccountId === where.OR?.[1]?.ownerAccountId) : row.source === where.source && row.normalizedWord === where.normalizedWord && row.ownerAccountId === where.ownerAccountId) ?? null),
      create: jest.fn(({ data }: any) => { const row = { id: id('word'), ...data }; words.set(row.id, row); return row; }),
      upsert: jest.fn(({ where, create, update }: any) => { const key = where.ownerAccountId_normalizedWord; const prior = [...words.values()].find((row) => row.ownerAccountId === key.ownerAccountId && row.normalizedWord === key.normalizedWord); if (prior) return Object.assign(prior, update); const row = { id: id('word'), ...create }; words.set(row.id, row); return row; }),
    },
    userWord: {
      findUnique: jest.fn(({ where }: any) => userWords.get(`${where.accountId_wordId.accountId}:${where.accountId_wordId.wordId}`) ?? null),
      findMany: jest.fn(({ where }: any) => [...userWords.values()].filter((row) => row.accountId === where.accountId && row.nextReviewAt <= where.nextReviewAt.lte).map((row) => ({ ...row, word: words.get(row.wordId) }))),
      upsert: jest.fn(({ where, create, update }: any) => { const key = `${where.accountId_wordId.accountId}:${where.accountId_wordId.wordId}`; const prior = userWords.get(key); if (prior) return Object.assign(prior, update); const row = { id: id('user-word'), consecutiveKnown: 0, ...create }; userWords.set(key, row); return row; }),
    },
    wordReview: {
      create: jest.fn(({ data }: any) => { const row = { id: id('review'), ...data }; reviews.push(row); return row; }),
      findMany: jest.fn(({ where }: any) => reviews.filter((row) => row.accountId === where.accountId && row.reviewedAt >= where.reviewedAt.gte && row.reviewedAt < where.reviewedAt.lt)),
    },
    sentenceAnalysis: {
      create: jest.fn(({ data }: any) => { const row = { id: id('sentence'), createdAt: new Date(), chunks: '[]', grammarPoints: '[]', mainClause: '', literalTranslation: '', naturalTranslation: '', ...data }; sentenceAnalyses.set(row.id, row); return row; }),
      update: jest.fn(({ where, data }: any) => { const row = { ...sentenceAnalyses.get(where.id), ...data }; sentenceAnalyses.set(row.id, row); return row; }),
      findMany: jest.fn(({ where }: any) => [...sentenceAnalyses.values()].filter((row) => row.accountId === where.accountId && (!where.status || row.status === where.status) && (!where.createdAt || row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt))),
      findFirst: jest.fn(({ where }: any) => { const row = sentenceAnalyses.get(where.id); return row?.accountId === where.accountId ? row : null; }),
    },
    $transaction: jest.fn((input: any) => typeof input === 'function' ? input(prisma) : Promise.all(input)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return {
    prisma,
    state: { accounts, sessions, profiles, tasks, pomodoros, events, words, userWords, reviews, sentenceAnalyses },
    identityForCode: (code: string) => `fake-openid:${createHash('sha256').update(code).digest('hex')}`,
  };
}
