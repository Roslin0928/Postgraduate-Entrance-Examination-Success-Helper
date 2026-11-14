# Task 1 完成报告：项目骨架与账号/考研档案

## 交付内容

- 建立 pnpm workspace、根级 `test` / `lint` / `dev:api` / `format` 脚本，以及 API、domain、小程序的 TypeScript 配置。
- API 提供 `GET /health`、`POST /v1/auth/wechat-login`、`GET /v1/me` 和 `GET/PATCH /v1/exam-profile`。
- 微信身份交换由 `WechatIdentityProvider` 抽象；本地默认 fake provider，生产环境必须显式配置真实 provider。会话 token 仅以 SHA-256 摘要写入 `AuthSession`。
- Prisma schema 包含 `Account`、`ExamProfile`、`AuthSession`；微信 open id 唯一，账号至多一个档案，考试日期和目标院校允许为空。
- 档案 PATCH 限制为指定字段并检查字段类型；允许空目标院校及跳过择校。
- 小程序增加登录页及“我”页，登录后缓存 access token，并显示账户、考试日期、目标院校、每日目标和手机号绑定入口。
- 增加 README、`.env.example` 和 `.gitignore`，说明本地数据库、fake/真实微信 provider、API 地址以及密钥管理。
- 增加健康检查、账号登录、当前用户和考研档案端到端控制器测试；测试用 Prisma mock，因此无需预置数据库。

## 验证结果

- `pnpm test`：通过，3 个测试套件、5 个测试。
- `pnpm lint`：通过，API、domain、小程序 TypeScript 检查均通过。
- `DATABASE_URL=file:./dev.db pnpm --filter api exec prisma validate --schema ../../prisma/schema.prisma`：Prisma schema 有效。
- `git diff --check`：通过。

## 须知

- 当前 schema 使用 SQLite，定位为本地开发数据库；README 提醒部署前切换 Prisma datasource 并配置正式数据库连接。
- fake provider 仅在非 production 环境可用；production 必须设置 `WECHAT_PROVIDER=wechat`，并通过环境变量注入微信凭证。仓库未包含真实凭证。
- 手机号绑定按钮目前只展示“即将开放”提示，手机号绑定流程不在 Task 1 接口范围内。
- API 集成测试覆盖路由和行为，但使用 mock，没有验证真实 SQLite 持久化；本地 API 首次运行需按 README 执行 `prisma db push`。
