# Task 6 验收报告

## 已通过

- `pnpm --filter api exec jest --config jest.e2e.config.js --runInBand tests/e2e/account-to-study-flow.spec.ts`：通过，1 个端到端用例。覆盖 fake 微信登录、档案、任务、番茄钟、单词反馈、句子分析及今日统计，并验证归属同一用户。
- `pnpm --filter api exec jest --config jest.e2e.config.js --runInBand tests/e2e/recovery-flow.spec.ts`：通过，1 个端到端用例。覆盖暂停后重新登录恢复、只累计一次以及顺延保留原任务关联。
- `pnpm build`：通过；domain、API 编译和小程序 TypeScript 检查均成功。

## 未运行 / 未验证

- 空数据库迁移执行与生产环境真实 provider 启动：未验证，本地验收使用测试状态/fake 环境。

## 发布配置与隐私检查

- `.env.example` 仅保留配置项名称和值为空或安全默认值；生产必须配置 `SESSION_SIGNING_SECRET`，AI/择校默认不可用且可重试，fake provider 不允许在 production 使用。
- 登录 code、access token、微信身份标识和完整句子不写入 API 日志。

## 最终修复波次

- 计划任务按 `plannedDate` 的 UTC 自然日桶查询，避免 `America/Los_Angeles` 等负时区将 UTC 午夜排除；番茄钟、单词复习和长难句仍按用户本地日的真实时间边界查询。
- 新增 `America/Los_Angeles` 回归用例，并覆盖计划任务 UTC 桶和复习本地边界。
- 任务页英语学习卡片提供“单词复习”和“长难句分析”两个入口；长难句按钮导航到 `/pages/english/sentence`。
- `pnpm build`、`pnpm lint`、`pnpm test`：均通过。全量测试 14 个套件、43 个用例通过；分析专项测试 3 个用例通过。
- 空数据库迁移执行与生产环境真实 provider 启动仍未验证。
