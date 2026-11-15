# 考研执行平台 MVP

## 本地运行

需要 Node.js 20+ 和 pnpm 9.15.4。安装依赖后复制 `.env.example` 为 `.env`，再启动 API：

```sh
pnpm install
pnpm --filter api exec prisma db push --schema ../../prisma/schema.prisma
pnpm dev:api
```

当前 Prisma schema 使用 SQLite，供本地开发和自动化测试使用；默认数据库文件为仓库根目录的 `dev.db`，不会提交到 Git。上线前应按部署环境将 Prisma datasource provider 和连接配置切换到正式数据库，并配置独立的 `DATABASE_URL`。

本地默认使用 fake 微信身份 provider：相同的登录 code 会映射到同一测试身份。真实微信登录需设置 `WECHAT_PROVIDER=wechat`、`WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`。密钥仅保存在本机或部署平台的环境变量中，禁止提交到仓库。小程序请求地址可通过 `TARO_APP_API_BASE_URL` 配置，未设置时为 `http://localhost:3000`。

部署到生产环境时，必须设置 `SESSION_SIGNING_SECRET`。微信 provider 使用 `wechat` 并要求 App ID 与 App Secret；句子分析 provider 使用 `http` 并要求分析服务 URL，或设为 `unavailable` 以返回可重试状态；尚未接入的择校搜索服务设为 `unavailable`，不会生成演示院校数据。Fake provider 仅适用于本地开发和测试。`.env.example` 将 AI 分析和择校搜索设为 `unavailable`；需要本地假数据时，可在测试环境显式设为 `fake`。

API 不记录登录 code、access token、微信身份标识或用户提交的句子。新增日志时应继续避免记录这些字段或完整请求体。

## 微信小程序预览

先在一个终端启动 API：

```powershell
pnpm.cmd dev:api
```

再在另一个终端启动微信端监听构建：

```powershell
pnpm.cmd --filter miniprogram dev:weapp
```

在微信开发者工具中导入仓库的 `apps/miniprogram` 目录；项目配置会将小程序根目录指向自动生成的 `dist/`。本地 API 默认使用 `http://localhost:3000`，需要其他地址时先设置 `TARO_APP_API_BASE_URL`。

生产构建使用：

```powershell
pnpm.cmd --filter miniprogram build:weapp
```

## 验证

```sh
pnpm test
pnpm lint
pnpm build
```

API 集成测试使用 Prisma mock，不要求预先创建 SQLite 数据库；跨模块端到端场景也会验证 fake 登录到学习统计的用户归属和中断恢复。`pnpm build` 编译 domain 和 API，并检查小程序 TypeScript。
