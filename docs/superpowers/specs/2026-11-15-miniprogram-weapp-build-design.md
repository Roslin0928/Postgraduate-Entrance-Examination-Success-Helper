# 小程序微信端构建链设计

## 背景

仓库已经包含基于 Taro 4、React 和 TypeScript 的小程序页面源码，后端 API 已可在本地 `http://localhost:3000` 启动。当前 `apps/miniprogram/package.json` 只有 TypeScript 类型检查脚本，没有 Taro CLI、微信端构建配置或可供微信开发者工具打开的产物目录。

## 目标

为 `apps/miniprogram` 增加最小可用的微信小程序构建链，使开发者能够：

1. 使用 `pnpm --filter miniprogram dev:weapp` 生成可持续监听的微信端开发产物；
2. 使用 `pnpm --filter miniprogram build:weapp` 生成可导入微信开发者工具的生产产物；
3. 在构建时通过 `TARO_APP_API_BASE_URL` 配置 API 地址，未配置时继续使用 `http://localhost:3000`；
4. 继续通过现有的 TypeScript 检查和 API 测试验证代码质量。

## 非目标

- 不改动现有页面、接口、数据库 schema 或登录流程；
- 不接入真实微信 AppID、AppSecret 或生产域名；
- 不在本次工作中新增设计稿、视觉组件或业务功能。

## 技术方案

- 在 `apps/miniprogram` 增加 Taro 4 的 CLI 开发依赖，并与已有 `@tarojs/taro`、`@tarojs/components` 版本保持兼容；
- 新增 Taro 配置入口，目标平台固定为 `weapp`，输出目录固定为 `dist`；
- 增加 `dev:weapp` 和 `build:weapp` 两个脚本；
- 保留现有 `build`/`lint` 的 `tsc --noEmit` 行为，作为快速类型检查；
- 保留 `project.config.json` 作为微信开发者工具项目元数据，构建产物目录作为导入目录；
- 使用 Taro 的环境变量注入能力支持 `TARO_APP_API_BASE_URL`，不把本地地址或密钥写死到构建配置中。

## 验收标准

- `pnpm.cmd --filter miniprogram build` 通过；
- `pnpm.cmd --filter miniprogram build:weapp` 通过并生成 `apps/miniprogram/dist`；
- `apps/miniprogram/dist/app.js`、页面脚本和微信项目所需配置文件存在；
- `pnpm.cmd test` 通过；
- README 明确说明开发启动、生产构建、API 地址和微信开发者工具导入步骤。

## 风险与处理

- 如果 Taro CLI 与当前依赖的次版本不兼容，统一将 CLI 固定到 `4.1.5`，避免自动升级造成不可复现构建；
- 微信开发者工具真机请求仍需配置合法业务域名，本地开发继续使用关闭 URL 校验的项目配置；
- 构建产物属于生成文件，不提交 `dist` 和本地数据库文件。
