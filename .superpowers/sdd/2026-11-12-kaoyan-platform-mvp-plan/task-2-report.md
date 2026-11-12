# Task 2 实现报告：今日任务与番茄钟

## 完成内容

- 新增 Task、PomodoroSession、PomodoroEvent 数据模型，番茄事件通过 `(sessionId, eventId)` 唯一约束去重。
- 新增任务领域类型和番茄钟状态函数，覆盖开始、暂停、恢复、完成、有效时长累计及顺延副本来源关系。
- 新增任务 API：`POST /v1/tasks`、`GET /v1/tasks?date=YYYY-MM-DD`、`PATCH /v1/tasks/:id`、`POST /v1/tasks/:id/pomodoro-events`。
- 所有任务读写先解析 Bearer token 得到 accountId，再按 accountId 过滤；任务创建拒绝客户端提供的未知字段（包括 accountId）。
- 番茄事件以服务端时间推进；`sync` 返回已保存 session 状态，页面重进不会重复提交开始事件。暂停片段与累计有效秒数保存在 session。
- 新增今日任务页、番茄钟页、TaskCard 和 TaskEditor；支持预计/完成时长、完成率、恢复建议、开始/暂停/完成/顺延和退出确认。
- 小程序依赖 `@kaoyan/domain`，并在 app 配置中注册新页面。

## 验证

- `pnpm --filter api test -- tasks.e2e-spec.ts`：通过，3 项。
- `pnpm test`：通过，domain 2 个 suite / 7 项，API 3 个 suite / 6 项。
- `pnpm lint`：通过，domain、miniprogram、api 均通过 TypeScript 检查。
- 恢复行为通过 API 集成测试验证：同步请求返回现有 paused session，重复 eventId 不创建重复事件。

## 边界与顾虑

- 未在真实微信小程序运行时手动关闭并重新打开页面；恢复路径由服务端集成测试覆盖，UI 仍需在目标设备验证导航与计时显示。
- 沿用仓库文档中的 `prisma db push` 本地开发流程；未生成生产数据库迁移。
