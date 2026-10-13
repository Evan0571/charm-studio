# LOOP：Vercel 固定地址部署

适用于 GitHub 仓库 `Evan0571/charm-studio` 的最新 `master`。网站、REST API、OAuth 授权和 MCP 共用一个生产域名。部署成功后，无需保持开发者电脑或临时隧道运行。

## 1. 准备数据库

使用现有的 **charm-studio Supabase 项目**即可。2026-10-13 的共享 OAuth 迁移已经在该项目执行，不需要重新建库，也不需要复制本地 `.data` 文件。

如果使用新的 Supabase 项目，在 SQL Editor 中完整执行仓库的 [`supabase/schema.sql`](../supabase/schema.sql)。如果旧项目只有设计和订单两张表，执行 [`supabase/migrations/20261013172935_loop_shared_oauth.sql`](../supabase/migrations/20261013172935_loop_shared_oauth.sql)。这些语句可以重复执行，不删除既有设计或订单。

从所选项目的设置中取得 Project URL 和服务端 Secret Key（也兼容旧 `service_role` key）。不要使用浏览器 publishable/anon key，不要把服务端 key 发进公开聊天或提交进 Git。

## 2. 在 Vercel 导入仓库

1. 登录 Vercel，选择 **Add New → Project → Import Git Repository**。
2. 选择 `Evan0571/charm-studio`。看不到仓库时，给 Vercel 的 GitHub 集成授予这个私有仓库的访问权限。
3. Root Directory 使用仓库根目录；Framework Preset 选择 **Vite**。
4. Node.js Version 选择 **24.x**。
5. 使用仓库 `vercel.json` 中的配置：Install Command 为 `pnpm install --frozen-lockfile`，Build Command 为 `pnpm build`，Output Directory 为 `dist`。不要改成 `vite build`，否则不会生成 MCP 卡片资源。
6. 在 Project Settings → Git 中确认 **Production Branch 为 `master`**，不要保留默认的 `main`。

`api/index.mjs` 是完整 Express 后端入口，加载构建生成的 `dist-server/app.mjs`；`vercel.json` 已配置 REST、MCP 和 OAuth 路由。无需另外创建后端项目，也不使用 `pnpm start` 或 `pnpm chatgpt:connect` 作为 Vercel 启动命令。

## 3. 配置环境变量

首次部署前，把下面的值加入 Vercel 项目的 **Production** 环境：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | 使用仓库固定的 `pnpm@11.25.0` |
| `SUPABASE_URL` | 所选项目的 Project URL | 网站和授权记录使用同一个项目 |
| `SUPABASE_SECRET_KEY` | 服务端 Secret Key 或 `service_role` key | 只保存在 Vercel 环境变量中 |
| `MCP_TOKEN_SECRET` | 至少 32 字符的随机值 | 生成一次，后续部署保持不变 |
| `COOKIE_SECURE` | `true` | 生产环境使用 HTTPS Cookie |

可以在自己的终端生成一份新签名密钥，再复制到 Vercel，命令如下。不要把输出提交到仓库：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

以下变量按需添加：

| 变量 | 何时设置 |
| --- | --- |
| `MCP_PUBLIC_URL` | 推荐在确定生产域名后设置为 `https://你的生产域名/mcp`。必须 HTTPS，以 `/mcp` 结尾，不含查询参数。首次未设置时，代码会使用 Vercel 的 `VERCEL_PROJECT_PRODUCTION_URL`。绑定自定义域名后应明确设置，并重新部署。 |
| `OPENAI_API_KEY` | 独立网页的 AI 灵感对话需要。手动 3D 编辑、保存、测试订单和 ChatGPT 宿主模型的设计流程无需该 key。 |
| `OPENAI_MODEL` | 网页 AI 的模型可按原配置设置；不设置时保留项目默认值。 |

Vercel 中自动使用 **Supabase 授权存储**和 **MCP 流式响应**。不需要设置 `SQLITE_PATH`、`PORT`、`HOST`，也不要设置 `MCP_OAUTH_STORAGE=sqlite`。任何密钥都不要使用 `VITE_` 前缀。

如果也需要 Preview 部署，在 Preview 环境单独配置这些变量，最好使用独立的 Supabase 项目和签名密钥。不要把 Production 的 `MCP_PUBLIC_URL` 原样用于 Preview；未设置时 Preview 会使用自己的部署地址。授权记录按完整 MCP 地址隔离。

## 4. 部署并确认生产地址

点击 Deploy。首次完成后，在 Settings → Domains 或项目首页找到 **生产域名**，例如 `你的项目.vercel.app`。后续发布仍使用这个地址，不使用带每次部署哈希的预览地址。

确认 Production Branch 是 `master`，并确认本次部署的 Git commit 对应最新提交。若已经创建项目再修改环境变量，点击 Redeploy，让新变量生效。

无需购买域名。之后可绑定自定义域名；切换域名时，更新 `MCP_PUBLIC_URL` 并重新部署。浏览器访客身份依赖 Cookie，域名变化会产生新的浏览器工作台，不会自动把旧域名的访客设计迁移过去。

## 5. 部署后检查

打开生产域名上的这些地址：

| 地址 | 预期结果 |
| --- | --- |
| `/`、`/#/studio` | 网站和 3D 工作室正常打开 |
| `/api/health` | HTTP 200，JSON 中 `status` 为 `ok`、`storage` 为 `supabase`；也会检查授权表 |
| `/api/catalog` | JSON 配件目录，不能返回首页 HTML |
| `/.well-known/oauth-protected-resource/mcp` | `resource` 指向固定生产地址的 `/mcp` |
| `/.well-known/oauth-authorization-server` | 授权、注册、token 等地址使用同一生产域名 |
| `/mcp`（未带凭据直接打开） | HTTP 401 是正常结果，并应提供 OAuth 认证提示 |

在网站保存一份设计，刷新页面确认还在；测试订单必须经过明确确认，所有订单仍是模拟订单，不扣款、不发货。

如果要从终端检查基础接口：

```bash
pnpm setup:check --url https://你的生产域名
```

该命令只读取接口，不生成设计或订单。

## 6. 把 LOOP 连接切到固定地址

在支持自定义 MCP 应用的 ChatGPT 账号中，按 [`docs/CHATGPT.md`](CHATGPT.md) 的连接流程使用：

```text
名称：LOOP
服务器地址：https://你的生产域名/mcp
认证方式：OAuth
```

授权时，在同一浏览器先打开生产网站，再在 LOOP 页面选择“授权连接”。如果旧临时连接不能直接修改服务器地址，创建使用固定地址的新连接并完成授权，成功后移除旧临时连接。

验证一次“生成设计 → 自动 3D 预览 → 更换配件 → 保存 → 对话修改同一草稿 → 查看测试订单 → 明确确认”的流程。生产 MCP 使用每次 POST 内完成的 SSE 流，未登录的 GET 不是成功连接的判据。

生产域名必须允许 ChatGPT 访问。若它弹出 Vercel 登录页，在 Deployment Protection 中让这个生产域名公开可访问；Preview 可以继续保持保护。LOOP 自己的 OAuth 授权仍然保留。

## 7. 后续更新与排错

连接 GitHub 后，向 `master` 提交新版本即可触发生产部署；成功发布后固定域名指向新版本。无需重建 LOOP 连接，也不要每次换 `MCP_TOKEN_SECRET`。如果需要回退，可在 Vercel 恢复上一份已通过检查的生产部署。

| 问题 | 优先检查 |
| --- | --- |
| 首页能打开，API 返回 HTML | 是否部署了最新 `vercel.json` 和 `api/index.mjs`，是否选错分支或只执行了 `vite build` |
| `/api/health` 返回 503 | Supabase 环境变量、项目状态、OAuth 迁移和服务端 key 权限 |
| 数据库提示缺少 `charm_oauth_records` 或 RPC | 执行第 1 步对应 SQL，然后重试；不要改回本地 SQLite |
| 授权或浏览器 token 接口提示 Host/Origin 不允许 | `MCP_PUBLIC_URL` 是否与当前生产域名一致，是否误用了 Preview 地址 |
| 重发版后连接失效 | 签名密钥是否变化、是否用了错误数据库或域名 |
| 3D 资源返回 `FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE` | 是否运行本版流式 MCP 后端；不要关闭自动流式传输，也不要把 `/mcp` 放到会缓冲整份响应的代理后面 |
| MCP 卡片提示未构建 | Build Command 必须为完整 `pnpm build`；函数必须包含 `dist-mcp` 和 public 3D 素材 |
| 网页 AI 不可用，但手动编辑正常 | 检查可选的 `OPENAI_API_KEY` 和模型配置 |

## 已完成的部署适配与验收边界

- 网站静态资源由 Vercel CDN 提供；REST、MCP、OAuth 同域路由进入一个 Node 函数。
- OAuth 客户端、授权码、授权记录和刷新凭据存放在服务端专用 Supabase 表中。授权码、授权请求和刷新凭据由数据库原子消费，重启或多个实例不会重复接受同一凭据。
- 较大的内联 3D 卡片和模型通过标准 Streamable HTTP 的 SSE 响应传输，处理 Vercel 普通缓冲响应的 4.5 MB 限制。桌面 stdio 的离线素材读取继续可用。
- `.env`、本地 `.data`、文档和测试文件被排除在云函数打包之外。
- 本地验证和真实 Supabase 验证不等于已经在你的 Vercel 账号完成线上部署；首次线上检查按第 5、6 步进行。

开发者可在私有 `.env` 配置真实 Supabase 后运行：

```bash
pnpm build
node --import tsx scripts/vercel-flow-check.mjs
```

该脚本检查多实例授权、重启后的同草稿修改、大资源传输和明确确认后的幂等测试订单。临时授权和草稿会清理；一份隔离身份下的模拟订单会保留供数据库核对。没有扣款或发货。

技术依据：[Vercel 路由配置](https://vercel.com/docs/project-configuration/vercel-json)、[流式响应与 4.5 MB 限制](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)、[SQLite 持久化限制](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)、[固定 pnpm 版本](https://vercel.com/docs/builds/configure-a-build#corepack)。
