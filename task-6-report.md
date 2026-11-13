# Task 6 验收报告

## 已通过

- `pnpm --filter api exec jest --config jest.e2e.config.js --runInBand tests/e2e/account-to-study-flow.spec.ts`：通过，1 个端到端用例。覆盖 fake 微信登录、档案、任务、番茄钟、单词反馈、句子分析及今日统计，并验证归属同一用户。
- `pnpm --filter api exec jest --config jest.e2e.config.js --runInBand tests/e2e/recovery-flow.spec.ts`：通过，1 个端到端用例。覆盖暂停后重新登录恢复、只累计一次以及顺延保留原任务关联。
- `pnpm build`：通过；domain、API 编译和小程序 TypeScript 检查均成功。

## 未运行 / 未验证

- `pnpm lint`、`pnpm test`：未运行全量命令，避免已知会卡住的全量流程；本次仅运行上述两个定向 e2e。
- 空数据库迁移执行与生产环境真实 provider 启动：未验证，本地验收使用测试状态/fake 环境。

## 发布配置与隐私检查

- `.env.example` 仅保留配置项名称和值为空或安全默认值；生产必须配置 `SESSION_SIGNING_SECRET`，AI/择校默认不可用且可重试，fake provider 不允许在 production 使用。
- 登录 code、access token、微信身份标识和完整句子不写入 API 日志。
