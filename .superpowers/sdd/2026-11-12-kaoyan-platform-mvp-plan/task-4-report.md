# Task 4 实现报告：长难句粘贴分析

## 完成内容

- 新增 `SentenceAnalysis` Prisma 模型和领域类型，保存原句、分析模式、结构化结果、分析状态、理解状态、错误信息、时间和账号关联。
- 新增 SentenceAnalysisProvider contract、可通过 `SENTENCE_ANALYSIS_URL` / `SENTENCE_ANALYSIS_API_KEY` 配置的 HTTP provider，以及供本地和测试使用的 fake provider。
- 新增 `POST /v1/sentence-analyses`、`GET /v1/sentence-analyses`、`PATCH /v1/sentence-analyses/:id/status`，另提供 `POST /v1/sentence-analyses/:id/retry` 以支持页面重试。
- API 验证原句非空且不超过 2,000 字符；先落库为 pending，再调用 provider，成功保存 completed 结果，异常时保存 retryable 和错误信息，原句草稿保留。
- 所有历史、重试和状态更新均按认证账号限定；越权记录按未找到处理。
- 新增小程序长难句页，支持输入、简版/详细版切换、提交、加载提示、重试、历史选择、已理解/需要复习标记。详细版展示主干、分层、语法点和翻译；简版收起分层和语法解释。
- 更新 `.env.example`，添加 provider 配置说明。

## 验证

- `pnpm --filter api test -- sentences.e2e-spec.ts sentence-provider.test.ts`：2 个测试套件、6 项通过。
- `pnpm test`：workspace 全量 10 个测试套件、34 项通过。
- `pnpm lint`：domain、miniprogram、api 的 TypeScript 检查全部通过。

## 注意事项

- 生产环境需提供满足 `SentenceAnalysisResult` 结构的 HTTP 服务，并设置 `SENTENCE_ANALYSIS_PROVIDER=http`、`SENTENCE_ANALYSIS_URL`；`SENTENCE_ANALYSIS_API_KEY` 可选。
- `FakeAnalysisProvider` 仅用于开发和测试，提供确定性的示例分析，不适合作为真实语言分析服务。
- Prisma schema 已更新；部署到已有数据库前需按部署流程生成并应用数据库迁移。

## 复核修复

- provider 返回值按模式校验：所有模式都要求非空主干和自然译文，grammarPoints 必须是字符串数组；详细模式还要求至少一个有效 chunk、至少一个非空语法点和非空直译。
- 缺失或空字段、grammarPoints 含非字符串等结构错误会进入 retryable，仍保留原句草稿。
- 新增 detailed 和 brief 结构错误回归覆盖。
- 修复后验证：专项 API/provider 测试 8 项通过，`pnpm test` 全量 36 项通过，`pnpm lint` 通过。
