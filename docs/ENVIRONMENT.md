# 环境变量、密钥与模型

配置来源以代码为准：`server/stylist.ts`、`server/storage.ts`、`server/mcp/auth.ts`、`server/index.ts`、`server/chatgpt.ts`、`scripts/chatgpt-connect.mjs`。本文件不包含实际凭据。

## 配置规则

在仓库根目录创建 `.env`，参考 `.env.example`。服务从当前工作目录读取它，因此请始终在项目根目录执行 pnpm 命令。已有 `.env` 时只补缺项，不覆盖。系统 / shell 中已导出的同名环境变量优先于 dotenv 文件；排错时留意旧终端中残留的覆盖值。

修改后重启相关进程。密钥只存在服务端，禁止加 `VITE_` 前缀，也不放到前端源码、截图、日志、Issue、聊天或 Git 提交中。用 `pnpm setup:check` 检查配置是否存在，不要用 `cat .env` 把整个文件打印给 AI。

## 完整变量表

| 变量 | 默认 / 是否必需 | 用途与注意事项 |
| --- | --- | --- |
| `PORT` | 普通网站 `3000` | `pnpm dev` / `pnpm start` 端口；MCP helper 用 `CHATGPT_PORT` 覆盖子进程端口 |
| `HOST` | `127.0.0.1` | 普通网站监听地址；局域网测试可显式改 `0.0.0.0` 并配置防火墙；ChatGPT 专用入口固定 loopback，不读取此项 |
| `OPENAI_API_KEY` | 可空 | 独立网站 AI、普通服务器上的 `loop_suggest_design` 所需；手动工作室和 ChatGPT 读目录生成方案无需此 Key |
| `OPENAI_MODEL` | 未设置时 `gpt-4.1-mini` | 独立服务器 AI 模型；不要设成空字符串；不控制 ChatGPT 的模型 |
| `SUPABASE_URL` | 可不设置 | 项目的 HTTPS API URL，须与服务端 Key 来自同一项目 |
| `SUPABASE_SECRET_KEY` | 可不设置 | Supabase 服务端 Secret Key 或 legacy service_role Key；必须与 URL 同时存在 |
| `SQLITE_PATH` | `.data/charm-studio.sqlite` | 没有 Supabase 时使用；目录自动创建；相对路径以项目根目录为基准 |
| `CHATGPT_PORT` | `3004` | `pnpm chatgpt:connect` 的专用本地端口；可在 `.env` 或 shell 设置，范围 1024–65535 |
| `CLOUDFLARED_BIN` | PATH 中 `cloudflared` | 可设绝对路径；未设置时也查找 `.data/bin/cloudflared`（Windows 为 `cloudflared.exe`） |
| `MCP_PUBLIC_URL` | 普通本地模式不设置 | 固定部署时的完整 `https://域名/mcp`；不能含用户名、密码、query 或 fragment |
| `MCP_TOKEN_SECRET` | 普通本地自动生成 | 固定部署时与公网 URL 配套，至少 32 个随机字符；不能使用示例占位文本 |
| `MCP_OAUTH_STORAGE` | 本地 `sqlite`，Vercel `supabase` | 显式 `supabase` 时须配置 Supabase 与固定 MCP 地址；Vercel 不允许 SQLite 授权存储 |
| `MCP_HTTP_STREAMING` | 本地关闭，Vercel 自动开启 | 本地设 `true` 可检查大资源流式传输；Vercel 始终使用流式响应 |
| `ENABLE_EXPERIMENTAL_COREPACK` | Vercel 设 `1` | 使用 `package.json` 固定的 pnpm 版本，详见 [Vercel 部署](VERCEL_DEPLOY.md) |
| `COOKIE_SECURE` | 未设置 | HTTPS 部署设 `true`；普通 HTTP 本地测试保持未设置；helper 仅对子进程设为 true |
| `NODE_ENV` | 启动命令管理 | `pnpm start` / ChatGPT helper 使用 production；不要为开发路径全局固定为 production |
| `PLAYWRIGHT_MODULE` | 可选测试专用 | 浏览器回归所用 Playwright ESM 路径；只做常规部署无需设置 |
| `LOOP_UI_DEV` | 可选测试专用 | `scripts/language-browser-check.mjs` 设为 `1` 时使用 Vite 开发模式；正常部署无需设置 |

`CHATGPT_PORT` 与 `CLOUDFLARED_BIN` 由 helper 启动时读取 `.env`。helper 使用自己的临时域名和 `.data/mcp-token-secret`，并覆盖子进程的 `MCP_PUBLIC_URL` / `MCP_TOKEN_SECRET` / `COOKIE_SECURE`。不要把它当作固定域名启动器。

没有 `DATABASE_URL`、`OPENAI_BASE_URL`、`ANTHROPIC_API_KEY`、AWS Key 或 Alexa Client ID 的内置配置支持；不要让部署 AI 凭空添加这些变量并声称接入完成。

## 三份配置示例

### A. 无密钥，本地手动工作室 + ChatGPT MCP

```dotenv
PORT=3000
HOST=127.0.0.1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
# Supabase 和固定 MCP 公网变量保持未设置。
```

网站可以手动设计、保存、报价和测试下单。接入 ChatGPT 时额外准备自己的 ChatGPT 账号和 cloudflared，不需要为了 MCP 协议申请 OpenAI API Key。

### B. 本地 SQLite + 独立网页 AI

```dotenv
PORT=3000
HOST=127.0.0.1
OPENAI_API_KEY=在此填入你自己的真实密钥
OPENAI_MODEL=gpt-4.1-mini
```

Key 在 [OpenAI API Keys](https://platform.openai.com/api-keys) 创建，需项目支持 API 调用并有可用额度。API 调用与 ChatGPT 产品使用分别配置。服务器固定请求 `https://api.openai.com/v1/responses`。

### C. Supabase + 独立网页 AI

在 B 的基础上添加以下两项，并先执行 `supabase/schema.sql`：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=在此填入该项目的服务端密钥
```

[Supabase 官方 Key 说明](https://supabase.com/docs/guides/getting-started/api-keys)区分客户端 publishable / anon 与服务端 secret / service_role。本项目需要后者，但绝不把它发送到浏览器。API 的访客隔离由项目后端完成，当前没有 Supabase Auth 用户登录。

## 默认模型是什么，能否换模型

| 路径 | 由谁推理 | 模型配置 |
| --- | --- | --- |
| `/#/search` 网页 AI | 项目后端调用 OpenAI Responses API | `OPENAI_MODEL`；默认 `gpt-4.1-mini` |
| 普通服务器 `loop_suggest_design` | 同一个后端 stylist | 同上，使用项目 API Key |
| ChatGPT → 目录 → 预览工具 | ChatGPT 当前对话模型 | 在 ChatGPT 的可用模型中选择；与 `.env` 无关 |
| `chatgpt:connect` 上的 `loop_suggest_design` | 专用入口关闭此 fallback | 会提示改用目录与预览；不是 Key 丢失 |
| 手动 3D / 目录示例 | 确定性目录和业务逻辑 | 不调用模型 |

**本次交接的代码默认值和作者本机生效的默认值都是 `gpt-4.1-mini`。** 这是项目选择，不是在声称它是 OpenAI 最新模型。官方页面确认它支持 [Responses 与 Structured Outputs](https://developers.openai.com/api/docs/models/gpt-4.1-mini)。

换模型只需修改自己的 `OPENAI_MODEL` 并重启，但要逐项确认：

1. 使用真实 API model ID，不是 ChatGPT UI 的显示名称，并确认你的 API 项目可调用。
2. 支持 `/v1/responses` 和 `text.format.type=json_schema`、`strict:true`；参考 [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)。
3. 当前代码给每次 API 请求 45 秒超时、`max_output_tokens:2200`、`store:false`，不做流式输出；英文模式检测到中文时最多自动重试一次，可能产生第二次 API 调用和更长总等待；推理型模型可能需要另外调整输出预算 / reasoning 参数，不能保证只改名字就稳定。
4. 实测中文 / 英文首稿、连续修改、锁定配件、预算内报价与错误提示。自动化测试使用 mock，不证明每种真实模型兼容。

若改用非 OpenAI 服务或自建兼容网关，需要修改 `server/stylist.ts` 的 provider、endpoint、认证与结构化输出处理并验证；目前仅设置一个不同厂商的模型名不会接通。

服务端把模型输出重新通过目录规则验证，价格重新计算。模型不会直接写入数据库、支付或创建订单。每位访客的服务端 AI 限制为每分钟 6 次，全局同时 4 次；此限制是单进程的，不是多服务器共享配额。

## MCP 的三个私密状态

| 文件 / 值 | 用途 | 新电脑怎么处理 |
| --- | --- | --- |
| `.data/mcp-token-secret` | 本地签名密钥 | 首次运行自动生成，不复制作者的值 |
| `.data/mcp-oauth.sqlite` | OAuth 客户端、授权、刷新凭据 | 本机生成；固定域名重启需保留 |
| 浏览器 `loop_guest` Cookie | 标识访客草稿和订单的归属 | 浏览器自行产生，不通过 Git 或聊天传递 |

`.data/chatgpt-connection.json` 只记录当前连接地址和进程信息，不是插件安装文件；里面的旧地址不能保证还有效。不要把 `.data` 放进仓库。

固定域名部署使用自己生成的稳定 `MCP_TOKEN_SECRET`，保存为服务端 secret。临时连接由 helper 自动处理，不需要用户手动生成或提供 OAuth Client ID / Client Secret。

Vercel 使用 Supabase 保存设计、订单和共享 OAuth 记录，不使用本地 `.data`。先按 [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) 执行授权表迁移，再配置服务端环境变量。上表中的本地 OAuth 文件仅适用于 SQLite 模式。

## 不泄密的核查

```bash
pnpm setup:check
pnpm setup:check --url http://localhost:3000
```

脚本只报告变量是否存在、格式是否合理、资源是否齐全；可选读取公开健康 / 目录 / AI 状态接口。它不输出 Key，不发起模型请求，不保存设计或订单。`/api/health` 检查存储可读性，写入能力还需测试草稿验证。

| 错误 | 常见原因 |
| --- | --- |
| AI 未启用 / configured false | 普通网站没读到 Key；或你访问的是有意关闭 AI 的 ChatGPT 专用入口 |
| OpenAI 401 | Key 无效、撤销或来自错误配置 |
| OpenAI 429 | API 额度、项目限制或频率限制；也可能先触发本项目限流 |
| OpenAI 404 / 模型不可用 | 模型 ID 或项目访问权限不匹配 |
| AI 超时 / 结果无效 | 网络、模型延迟、输出预算或结构化输出不符合目录；原设计不应被覆盖 |
| 启动提示 MCP_TOKEN_SECRET | 手动设了 MCP_PUBLIC_URL 却缺少配套密钥；普通本地开发可移除这组固定部署变量 |

交接实际 Key 时使用团队认可的私密渠道或密钥管理器。README、GitHub 链接和部署 AI 提示词只传变量名，不传实际值。
