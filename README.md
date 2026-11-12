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

## 验证

```sh
pnpm test
pnpm lint
```

API 集成测试使用 Prisma mock，不要求预先创建 SQLite 数据库。
