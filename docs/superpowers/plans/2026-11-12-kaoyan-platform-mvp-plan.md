# 工科考研备考执行平台 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个微信小程序 MVP：用户微信登录后设置考研档案，在“今日任务”中执行自定义任务、单词复习和长难句分析，并使用番茄钟与基础统计；择校查询作为次要入口接入。

**Architecture:** 使用 TypeScript 单体仓库，前端为 Taro + React 微信小程序，后端为 NestJS + Prisma，PostgreSQL 保存账号、计划和学习记录。共享领域包定义任务、单词复习、统计和择校结果的类型；长难句分析与择校检索通过后端适配器隔离外部 AI/搜索服务，服务不可用时保留输入并返回可重试状态。

**Tech Stack:** Taro 4, React 18, TypeScript, NestJS, Prisma, PostgreSQL, Vitest, Supertest, ESLint, Prettier。

**Spec:** `docs/superpowers/specs/2026-11-12-kaoyan-execution-platform-design.md`

## Global Constraints

- 微信一键登录是首版唯一默认登录方式，手机号只能由用户主动绑定。
- “今日任务”是主入口；英语学习是独立入口；择校资料是次要入口；“我（User）”负责账号和考研档案。
- 首版英语只包含单词复习和粘贴式长难句分析，不包含完整真题库、作文批改或社群排名。
- 所有学习记录必须与账号关联，并能跨设备恢复。
- 外部内容必须展示来源和更新时间，不绕过登录、反爬或访问限制。
- AI/搜索服务失败时不得丢失用户输入，客户端必须提供重试或查看缓存结果的路径。
- 任务、番茄钟、单词反馈和长难句记录都必须能生成每日/周统计。

---

## 1. 文件结构与边界

先建立以下边界，后续任务只通过接口协作，不跨模块直接读取内部表结构：

```text
apps/miniprogram/
  src/pages/tasks/          # 今日任务与番茄钟页面
  src/pages/english/        # 单词与长难句页面
  src/pages/schools/        # 次要的择校资料页面
  src/pages/me/             # 账号、考研档案与设置
  src/services/             # API client、登录态和缓存
  src/components/           # 跨页面 UI 组件
services/api/
  src/modules/auth/         # 微信登录、会话、账号
  src/modules/profile/      # ExamProfile 与 User 设置
  src/modules/tasks/        # Task 与 PomodoroSession
  src/modules/vocabulary/   # 词库、导入、复习调度
  src/modules/sentences/    # 长难句分析适配器与历史
  src/modules/schools/      # 查询标准化、来源适配器、缓存
  src/modules/analytics/    # 只读统计
packages/domain/
  src/                      # 跨端类型、复习策略、状态枚举
prisma/schema.prisma        # 数据库模型
tests/                      # 领域单测、API 集成测试
```

共享接口的最小约定：

```ts
export type TaskStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'skipped' | 'rescheduled';
export type WordFeedback = 'known' | 'fuzzy' | 'unknown';

export interface TaskSummary {
  id: string;
  title: string;
  type: 'custom' | 'vocabulary' | 'sentence' | 'school_search';
  plannedMinutes: number;
  status: TaskStatus;
}

export interface StudySummary {
  date: string;
  completedTaskCount: number;
  plannedTaskCount: number;
  focusedMinutes: number;
  vocabularyReviews: number;
  sentenceAnalyses: number;
}
```

## 2. Task 1：项目骨架与账号/考研档案

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `apps/miniprogram/project.config.json`, `apps/miniprogram/src/app.config.ts`, `apps/miniprogram/src/app.tsx`
- Create: `services/api/src/main.ts`, `services/api/src/app.module.ts`
- Create: `packages/domain/src/index.ts`
- Create: `prisma/schema.prisma`
- Test: `services/api/test/health.e2e-spec.ts`, `packages/domain/test/types.test.ts`

**Interfaces:**
- Produces `POST /v1/auth/wechat-login`、`GET /v1/me`、`GET/PATCH /v1/exam-profile`。
- Produces `Account`、`ExamProfile`、`AuthSession` 数据模型。

```ts
export interface AccountView {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  phoneBound: boolean;
  examProfile: ExamProfileView | null;
}

export interface ExamProfileView {
  targetExamDate: string | null;
  major: string | null;
  targetSchoolId: string | null;
  dailyGoalMinutes: number;
  defaultPomodoroMinutes: number;
}
```

- [ ] **Step 1: 建立 workspace 与最小健康检查**

在 `package.json` 中固定脚本：

```json
{
  "scripts": {
    "dev:api": "pnpm --filter api start:dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "prettier --write ."
  }
}
```

在 `services/api/src/app.module.ts` 注册 `GET /health`，返回 `{ "ok": true }`。

- [ ] **Step 2: 写健康检查集成测试并确认初始失败**

`services/api/test/health.e2e-spec.ts` 断言 HTTP 200 和响应体 `{ ok: true }`，运行 `pnpm --filter api test -- health.e2e-spec.ts`，确认测试在模块未完成时失败。

- [ ] **Step 3: 建立 Prisma 账号与档案模型**

在 `prisma/schema.prisma` 定义 `Account`、`ExamProfile`、`AuthSession`，关键约束如下：微信身份标识唯一；一个账号最多一份当前考试档案；档案中的 `targetExamDate` 可为空；`targetSchoolId` 可为空，支持用户跳过择校。

- [ ] **Step 4: 实现微信登录与会话接口**

定义服务接口：

```ts
interface AuthService {
  loginByWechat(code: string): Promise<{ accessToken: string; isNewUser: boolean }>;
  getCurrentUser(accessToken: string): Promise<AccountView>;
}
```

微信 `code` 换取身份标识的调用放在 `WechatIdentityProvider` 中；本地开发使用 fake provider，生产环境通过配置注入真实 provider。禁止把微信密钥写入仓库。

- [ ] **Step 5: 实现 ExamProfile 查询与更新**

`PATCH /v1/exam-profile` 只接受明确字段：`targetExamDate`、`major`、`targetSchoolId`、`availableWindows`、`dailyGoalMinutes`、`defaultPomodoroMinutes`。目标院校为空时返回成功，不强制用户先择校。

- [ ] **Step 6: 建立小程序登录页与“我”页**

`apps/miniprogram/src/pages/me/login.tsx` 调用登录接口并缓存 access token；`pages/me/index.tsx` 展示昵称、账号状态、考研时间、目标院校、每日目标和绑定手机号入口。未登录时仅显示介绍和登录按钮。

- [ ] **Step 7: 运行验证并提交**

运行：`pnpm test`、`pnpm lint`。通过后提交：

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json apps services packages prisma tests
git commit -m "feat: add account and exam profile foundation"
```

## 3. Task 2：今日任务与番茄钟

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `services/api/src/modules/tasks/tasks.controller.ts`
- Create: `services/api/src/modules/tasks/tasks.service.ts`
- Create: `services/api/src/modules/tasks/pomodoro.service.ts`
- Create: `packages/domain/src/task.ts`, `packages/domain/src/pomodoro.ts`
- Create: `apps/miniprogram/src/pages/tasks/index.tsx`, `apps/miniprogram/src/pages/tasks/pomodoro.tsx`
- Create: `apps/miniprogram/src/components/TaskCard.tsx`, `apps/miniprogram/src/components/TaskEditor.tsx`
- Test: `services/api/test/tasks.e2e-spec.ts`, `packages/domain/test/pomodoro.test.ts`

**Interfaces:**
- Consumes `AuthSession` and `ExamProfile` from Task 1。
- Produces `POST /v1/tasks`、`GET /v1/tasks?date=YYYY-MM-DD`、`PATCH /v1/tasks/:id`、`POST /v1/tasks/:id/pomodoro-events`。

```ts
export interface CreateTaskInput {
  title: string;
  type: 'custom' | 'vocabulary' | 'sentence' | 'school_search';
  plannedMinutes: number;
  plannedDate: string;
  priority: number;
}

export type TaskAction = 'start' | 'pause' | 'complete' | 'skip' | 'reschedule';
```

- [ ] **Step 1: 为 Task 与 PomodoroSession 写领域测试**

覆盖：任务从 `planned` 开始后变为 `in_progress`；暂停不增加有效时长；恢复后只累计真实运行区间；完成任务不能再次累计番茄时长；顺延会生成下一日期的任务副本并保留来源 ID。

- [ ] **Step 2: 添加任务和计时数据模型**

`Task` 保存用户、类型、标题、计划日期、预计分钟、优先级和状态；`PomodoroSession` 保存任务 ID、开始/结束时间、暂停片段和累计有效分钟。所有写入以用户 ID 做过滤，不能通过客户端传入任意用户 ID。

- [ ] **Step 3: 实现任务 CRUD 与恢复动作**

`TasksService` 暴露：

```ts
createTask(userId: string, input: CreateTaskInput): Promise<TaskSummary>;
listByDate(userId: string, date: string): Promise<TaskSummary[]>;
updateStatus(userId: string, taskId: string, action: TaskAction): Promise<TaskSummary>;
```

`TaskAction` 仅允许 `start | pause | complete | skip | reschedule`，服务端校验状态迁移。

- [ ] **Step 4: 实现幂等番茄钟事件**

客户端每次事件携带唯一 `eventId`；服务端按 `(sessionId, eventId)` 去重。小程序关闭后重新进入，客户端发送当前状态，服务端以已保存的事件序列重建有效时长，避免重复累计。

- [ ] **Step 5: 实现今日任务页与番茄钟页**

今日任务页显示预计总时长、已完成时长、完成率和恢复建议；每张卡片提供开始、暂停、完成、顺延。番茄钟页显示倒计时、暂停/继续和退出确认，退出不会默认完成任务。

- [ ] **Step 6: 验证任务流程并提交**

运行 `pnpm --filter api test -- tasks.e2e-spec.ts` 与 `pnpm test`，手动验证退出小程序后重新进入不会重复累计。提交：`git commit -m "feat: add daily tasks and pomodoro tracking"`。

## 4. Task 3：单词复习

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `services/api/src/modules/vocabulary/vocabulary.controller.ts`
- Create: `services/api/src/modules/vocabulary/vocabulary.service.ts`
- Create: `services/api/src/modules/vocabulary/review-scheduler.ts`
- Create: `services/api/src/modules/vocabulary/import-parser.ts`
- Create: `packages/domain/src/vocabulary.ts`
- Create: `apps/miniprogram/src/pages/english/vocabulary.tsx`
- Create: `apps/miniprogram/src/components/WordReviewCard.tsx`, `apps/miniprogram/src/components/ImportResult.tsx`
- Test: `services/api/test/vocabulary.e2e-spec.ts`, `services/api/test/import-parser.test.ts`, `packages/domain/test/review-scheduler.test.ts`

**Interfaces:**
- Consumes任务创建接口，生成 `type: 'vocabulary'` 的今日任务。
- Produces `GET /v1/vocabulary/due`、`POST /v1/vocabulary/:id/reviews`、`POST /v1/vocabulary/custom`、`POST /v1/vocabulary/import`。

```ts
export interface NewWord {
  word: string;
  meaning: string;
  source: 'builtin_exam' | 'custom' | 'imported';
}

export interface ImportError {
  line: number;
  reason: 'missing_word' | 'missing_meaning' | 'too_many_columns' | 'duplicate';
}
```

- [ ] **Step 1: 写复习调度测试**

给定当前时间和反馈，断言：`unknown` 在本轮再次出现并安排次日；`fuzzy` 安排次日；`known` 安排 3 天后，连续熟悉后安排 7 天后。测试还要覆盖跨时区按用户本地日期计算。

- [ ] **Step 2: 建立词库与复习记录模型**

建立 `Word`、`UserWord`、`WordReview`、`VocabularyImport`。内置词库通过 `source='builtin_exam'` 标记；用户词通过 `source='custom'` 标记；导入记录保存原文件名、总行数、成功数和错误行。

- [ ] **Step 3: 实现 CSV/TSV 导入解析**

`parseVocabularyImport(input: string): { words: NewWord[]; errors: ImportError[] }` 支持 `word,meaning` 两列，忽略空行，重复词合并并报告，错误行返回行号和原因；不接受超过配置大小的文件。

- [ ] **Step 4: 实现待复习队列与反馈接口**

`VocabularyService.getDueWords(userId, now)` 按 `nextReviewAt <= now` 排序；`reviewWord(userId, wordId, feedback, taskId?)` 写入复习记录并更新下一次复习时间。接口必须校验词属于内置词库或当前用户。

- [ ] **Step 5: 实现英语词汇页**

页面提供今日待复习数量、单词卡、认识/模糊/不认识按钮、进度和导入入口。用户从今日任务进入时传递 `taskId`，自由复习时 `taskId` 为空；两种入口都写入同一套复习记录。

- [ ] **Step 6: 验证并提交**

运行 `pnpm --filter api test -- vocabulary.e2e-spec.ts import-parser.test.ts` 和 `pnpm test`。提交：`git commit -m "feat: add vocabulary review module"`。

## 5. Task 4：长难句粘贴分析

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `services/api/src/modules/sentences/sentences.controller.ts`
- Create: `services/api/src/modules/sentences/sentences.service.ts`
- Create: `services/api/src/modules/sentences/analysis-provider.ts`
- Create: `services/api/src/modules/sentences/fake-analysis-provider.ts`
- Create: `packages/domain/src/sentence.ts`
- Create: `apps/miniprogram/src/pages/english/sentence.tsx`
- Create: `apps/miniprogram/src/components/SentenceResult.tsx`
- Test: `services/api/test/sentences.e2e-spec.ts`, `services/api/test/sentence-provider.test.ts`

**Interfaces:**
- Produces `POST /v1/sentence-analyses`、`GET /v1/sentence-analyses`、`PATCH /v1/sentence-analyses/:id/status`。

```ts
export interface SentenceAnalysisProvider {
  analyze(input: string, mode: 'detailed' | 'brief'): Promise<SentenceAnalysisResult>;
}

export interface SentenceAnalysisResult {
  original: string;
  chunks: Array<{ text: string; role: 'subject' | 'verb' | 'object' | 'clause' | 'modifier' | 'other' }>;
  mainClause: string;
  grammarPoints: string[];
  literalTranslation: string;
  naturalTranslation: string;
}
```

- [ ] **Step 1: 写 provider contract 与失败测试**

测试详细模式必须包含主干、分层、语法点和两种翻译；provider 超时时，服务层返回可重试错误并保存原句草稿。

- [ ] **Step 2: 建立分析记录模型**

`SentenceAnalysis` 保存原句、结构化结果、模式、理解状态、错误信息、创建时间和用户 ID。原句长度限制为 2,000 个字符；超限请求返回 400，不调用外部服务。

- [ ] **Step 3: 实现 provider 适配与服务层**

生产 provider 通过环境变量配置；测试和本地开发使用 `FakeAnalysisProvider`。服务层先保存 `pending` 记录，再调用 provider；成功更新为 `completed`，失败更新为 `retryable`，不丢失原句。

- [ ] **Step 4: 实现粘贴分析页**

页面支持输入、简版/详细版切换、提交、加载状态、重试和保存历史。详细版默认展示主干、从句/修饰成分、语法解释和翻译；用户可以标记“已理解/需要复习”。

- [ ] **Step 5: 验证并提交**

运行 `pnpm --filter api test -- sentences.e2e-spec.ts sentence-provider.test.ts` 和 `pnpm test`。提交：`git commit -m "feat: add sentence analysis module"`。

## 6. Task 5：统计与择校资料次要入口

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `services/api/src/modules/analytics/analytics.controller.ts`
- Create: `services/api/src/modules/analytics/analytics.service.ts`
- Create: `services/api/src/modules/schools/schools.controller.ts`
- Create: `services/api/src/modules/schools/schools.service.ts`
- Create: `services/api/src/modules/schools/search-provider.ts`
- Create: `services/api/src/modules/schools/fake-search-provider.ts`
- Create: `packages/domain/src/school.ts`
- Create: `apps/miniprogram/src/pages/schools/index.tsx`, `apps/miniprogram/src/pages/schools/result.tsx`
- Create: `apps/miniprogram/src/pages/analytics/index.tsx`
- Test: `services/api/test/analytics.e2e-spec.ts`, `services/api/test/schools.e2e-spec.ts`

**Interfaces:**
- Produces `GET /v1/analytics/daily`、`GET /v1/analytics/weekly`。
- Produces `POST /v1/school-queries`、`GET /v1/school-queries/:id`。

- [ ] **Step 1: 写统计聚合测试**

给定任务、番茄钟、单词复习和长难句记录，断言每日统计返回计划任务数、完成任务数、有效分钟、词汇复习次数和长难句分析次数；无数据日返回全零而不是 404。

- [ ] **Step 2: 实现只读统计服务**

统计服务只能聚合原始记录，不修改任务或复习状态。按用户本地日期边界查询，周统计按周一到周日返回 7 个日桶。

- [ ] **Step 3: 实现择校指令标准化与搜索适配器**

定义：

```ts
interface SchoolSearchProvider {
  search(query: NormalizedSchoolQuery): Promise<SchoolSearchResult>;
}

interface SchoolSearchResult {
  items: Array<{
    schoolName: string;
    majorName: string | null;
    fields: Record<string, string | number | null>;
    sourceUrl: string;
    sourceName: string;
    updatedAt: string;
  }>;
  searchedAt: string;
}

interface NormalizedSchoolQuery {
  year?: number;
  major?: string;
  region?: string;
  schoolType?: string;
  constraints: string[];
}
```

首版使用 `FakeSearchProvider` 和人工配置样例验证页面流程；真实公开搜索或授权数据源接入时必须返回 `sourceUrl`、`sourceName`、`updatedAt`。provider 不得绕过登录或反爬限制。

- [ ] **Step 4: 实现择校页面与降级提示**

页面位于次要入口，允许输入自然语言指令，展示解析条件、院校卡片、来源和更新时间。无结果、超时或数据过期时显示原因和重试/修改条件按钮，不阻塞今日任务。

- [ ] **Step 5: 接入统计页并验证**

在“我”或今日任务页提供统计入口，展示今日完成率、有效学习时长、词汇熟悉度变化和长难句分析次数。运行 `pnpm test`、`pnpm lint`，提交：`git commit -m "feat: add analytics and school search entry"`。

## 7. Task 6：跨模块验收与发布前检查

**Files:**
- Create: `tests/e2e/account-to-study-flow.spec.ts`
- Create: `tests/e2e/recovery-flow.spec.ts`
- Modify: `README.md`, `.env.example`

- [ ] **Step 1: 编写账号到学习的端到端场景**

场景：微信 fake login → 设置考研时间和目标院校 → 创建今日任务 → 启动番茄钟 → 完成单词反馈 → 粘贴句子并保存 → 查看今日统计。断言每一步都使用同一用户 ID。

- [ ] **Step 2: 编写中断恢复场景**

场景：开始番茄钟 → 发送暂停事件 → 模拟小程序关闭 → 重新登录 → 恢复计时 → 顺延任务。断言有效分钟只累计一次，任务状态为 `rescheduled`，原任务仍可追溯。

- [ ] **Step 3: 完成环境与安全检查**

`.env.example` 只列出变量名：数据库连接、微信 provider、AI provider、搜索 provider 和会话签名密钥；运行时缺少生产密钥时启动失败，测试环境使用 fake provider。检查日志不得输出 access token、微信身份标识或用户粘贴的完整句子。

- [ ] **Step 4: 运行全量验证**

运行：`pnpm lint`、`pnpm test`、`pnpm build`。确认数据库迁移可从空库执行，确认未登录请求均返回 401，跨用户读取任务/单词/句子/统计均返回 404 或 403。

- [ ] **Step 5: 提交发布候选版本**

```bash
git add .
git commit -m "chore: verify kaoyan platform mvp"
```

发布前只启用已配置的数据 provider；未配置的择校搜索和 AI 分析必须明确显示“服务暂不可用/可重试”，不能返回伪造数据。

## 8. 计划自检

- 账号持久化、微信登录、考研时间和目标院校：Task 1、Task 6。
- 今日任务、To-do、番茄钟、中断恢复：Task 2、Task 6。
- 内置/自定义/导入词库与三级反馈：Task 3。
- 粘贴式长难句、详细结构分析、保存与重试：Task 4。
- 每日/周统计：Task 5、Task 6。
- 择校次要入口、来源和更新时间、可替换 provider：Task 5。
- 隐私、来源、失败降级与跨用户隔离：Global Constraints、Task 1、Task 4、Task 5、Task 6。

计划中没有使用 TBD、TODO 或未定义的方法名；后续任务依赖的接口均在前置任务中给出。
