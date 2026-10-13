# 环境变量、密钥与模型

配置来源以代码为准：`server/stylist.ts`、`server/storage.ts`、`server/amazon-pay.ts`、`server/mcp/auth.ts`、`server/index.ts`、`server/chatgpt.ts`、`scripts/chatgpt-connect.mjs`。本文件不包含实际凭据。

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
| `AMAZON_PAY_MERCHANT_ID` | 沙盒付款必需 | Amazon Pay 美国区商家 ID |
| `AMAZON_PAY_STORE_ID` | 沙盒付款必需 | Integration Central 对应的 Store ID |
| `AMAZON_PAY_PUBLIC_KEY_ID` | 沙盒付款必需 | 必须以 `SANDBOX-` 开头；此接入拒绝 Live 或无环境前缀的旧 Key |
| `AMAZON_PAY_PRIVATE_KEY_PATH` | 与 inline Key 二选一 | 本地下载的 RSA PEM 私钥文件路径；不要放进 Git |
| `AMAZON_PAY_PRIVATE_KEY` | 与文件路径二选一 | 部署环境中的 RSA PEM 私钥，支持实际换行或 `\n`；存在时优先于文件路径 |
| `AMAZON_PAY_BASE_URL` | 沙盒付款必需 | 付款返回的本站 origin，必须为 HTTPS 或 `http://localhost:端口`，不能带路径、query、hash 或用户名密码 |
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

## Amazon Pay 沙盒演示

当前接入固定为美国区、USD、`PayOnly` 单次 `AuthorizeWithCapture`，使用官方 SDK 与付款按钮，金额始终来自服务器报价快照。所有交易在 Sandbox 中完成，不真实扣款或发货；真实实物交易需要另行实现 `PayAndShip` 地址和履约流程。本轮不扩展 MCP 卡片付款，卡片原有测试订单流程仍可使用。

1. 从[美国区仅沙盒开发者注册入口](https://payments.amazon.com/register?isSandbox=true&locale=en_US&source=APDW)登录或申请 Amazon Pay Sandbox。正确登录返回路径包含 `/mario/amazon-pay/sandbox-registration/`；Seller Central 域名本身是正常的。此演示不需要开 Amazon 店铺或订阅 Professional 卖家计划。仅创建 Amazon 登录账号或看到申请已提交，并不能证明沙盒已经可用。
2. 打开 [Integration Central](https://sellercentral.amazon.com/gp/pyop/seller/integrationcentral/)。账号／市场选择器可能默认选择 **Amazon.com**，继而导向卖家开店、问卷或订阅页面；不要沿该流程继续。点击 **Pick a different merchant or marketplace**，展开对应账号并选择 **Amazon Pay (Sandbox View)**。以 Integration Central 显示 **You are in sandbox view** 为进入沙盒控制台的依据。
3. 选择 **Self-developed** 与 **One-time Payments, Single Authorization** 并获取指引。首次配置可能要求先 **Add Store ID**，才能继续创建 API keys。填写应用／店铺名称（例如 `LOOP Sandbox`）、沙盒演示描述、Privacy policy URL、Allowed JavaScript origins 和实际可收信的 Customer support email；不要为客服邮箱编造账号。此处创建的是 Amazon Pay 应用 Store ID，不是 Amazon 零售店铺。
4. Store ID 创建后记录 Merchant ID 和 Store ID，再在 **API keys → Create keys** 使用 **Generate API credentials**，保存 Public Key ID 和自动下载的私钥 `.pem`。确认仍在 Sandbox View；沙盒 Public Key ID 应以 `SANDBOX-` 开头。私钥只保存到本机配置或部署环境。
5. 在 **Integration → Test Accounts** 创建沙盒买家账号，使用虚拟支付方式。商家登录账号与测试买家用途不同。
6. 在已有 `.env` 中补充以下变量，重启 `pnpm dev`。`AMAZON_PAY_BASE_URL` 使用本次实际结账的站点 origin；改域名后同步更新 Store 配置与此变量。部署到 Vercel 时用服务端环境变量设置 inline PEM；本机文件路径不能代替部署环境中的私钥。

### Store 控制台的 HTTPS 验证

CV2 沙盒与本项目后端允许 `http://localhost:端口` 用于本地测试，但这不代表 **Add Store ID** 表单会接受它。当前控制台保存 Store ID 时会校验 HTTPS，并拒绝 HTTP localhost 的 JavaScript origin 和 return URL。不要将未配置 HTTPS 的 localhost 改写为 `https://localhost` 冒充可访问的站点；使用实际部署并可访问的 HTTPS 地址。

例如部署站点为 `https://loop-charm-studio.vercel.app/` 时，使用以下地址：

| Store 字段 | 地址 |
| --- | --- |
| Allowed JavaScript origins | `https://loop-charm-studio.vercel.app` |
| Allowed return URLs（可选） | `https://loop-charm-studio.vercel.app/` |
| Privacy policy URL | `https://loop-charm-studio.vercel.app/privacy.html` |

隐私说明源码为 `public/privacy.html`，构建后应在本站 `/privacy.html` 直接显示 **Privacy notice — LOOP Sandbox**。填写前先核对线上已经部署对应版本：隐私 URL 必须返回真实隐私说明，而不是 SPA fallback 的工作室首页；`/api/payments/amazon-pay/status` 必须返回 HTTP 200 和 JSON（环境为 `sandbox`），而不是 404 或 HTML。未设置密钥时 `configured:false` 正常；这一步只确认最新页面和服务端支付路由已上线，不能证明实际支付完成。确认这些地址可用后再保存 Store 配置并继续生成密钥。

```dotenv
AMAZON_PAY_MERCHANT_ID=你的商家ID
AMAZON_PAY_STORE_ID=你的StoreID
AMAZON_PAY_PUBLIC_KEY_ID=SANDBOX-你的公钥ID
AMAZON_PAY_PRIVATE_KEY_PATH=/绝对路径/你的私钥.pem
AMAZON_PAY_BASE_URL=https://loop-charm-studio.vercel.app
```

已有 Supabase 项目需要应用 `supabase/migrations/20261013173649_loop_amazon_pay_sandbox.sql`；全新项目使用完整 `supabase/schema.sql`。迁移兼容旧测试订单，仅允许服务端更新支付状态和支付字段。SQLite 自动兼容。

访问 `/api/payments/amazon-pay/status` 可查看 `{configured:true,environment:"sandbox"}`。`configured` 只证明本地配置与 RSA Key 格式有效，账号/API 授权要以实际沙盒结账验证。未配置时网站仍能编辑、保存和创建普通测试订单。

演示路径：设计挂件 → 确认配件和美元明细 → 选择 Amazon Pay 沙盒 → 点击官方按钮 → 用测试买家登录并付款 → 返回 LOOP。后端重新读取 Amazon 会话和 Charge，校验订单关联、美元金额、Sandbox 环境及 `Captured` 状态后才显示沙盒支付成功。关闭付款页、取消、拒绝、处理中或网络错误不会被当作已支付；已绑定的待核验订单可在订单历史中重新核验，不会重建付款。

沙盒测试至少包括成功支付、取消/拒绝、返回后刷新、重复点击和付款成功后连接中断再核验。单元/API 测试使用可注入 provider；SDK 本地签名测试不能代替真实 Amazon 买家结账。

官方依据：[注册与 API Key](https://developer.amazon.com/docs/amazon-pay-checkout/get-set-up-for-integration.html)、[End of Checkout](https://developer.amazon.com/docs/amazon-pay-checkout/end-of-checkout.html)、[核验并完成结账](https://developer.amazon.com/docs/amazon-pay-checkout/verify-and-complete-checkout.html)、[沙盒买家](https://developer.amazon.com/docs/amazon-pay-checkout/amazon-pay-sandbox-accounts.html)。

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
