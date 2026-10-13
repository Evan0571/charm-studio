# LOOP · 包挂定制工作室

LOOP 把「我想给这个包配一个什么样的挂件」变成可继续修改的设计：AI 从真实目录选择配件，用户查看 3D、锁定喜欢的部分、调整组合、保存草稿，并在明确确认后创建测试订单。

**当前交接版本：2026-10-08。** 已有独立网站和可安装到 ChatGPT 的 MCP 插件；界面默认英文，新报价采用美元（USD），按原人民币单价 ÷ 7 四舍五入为整数美元，再按明细加总。ChatGPT 是对话入口，设计卡片直接显示在对话内；`/mcp-demo.html` 是额外的协议调试页面。所有订单都是模拟订单，不扣款、不发货。

仓库：[Evan0571/charm-studio](https://github.com/Evan0571/charm-studio)，默认分支 `master`。仓库目前为私有，队友须先取得访问权限。代码链接不等于在线部署地址。

**固定地址部署：[Vercel 部署步骤](docs/VERCEL_DEPLOY.md)**。本版包含同域后端路由、Supabase 共享授权存储和大资源流式传输。按文档配置数据库与环境变量后，从 `master` 部署完整网站和 LOOP 连接。

## 给第一次接手的队友

建议按这个顺序使用文档：

1. **[新电脑安装与部署](docs/SETUP.md)**：macOS、Windows、Linux，从克隆到本地验收。
2. **[环境变量、密钥与模型](docs/ENVIRONMENT.md)**：哪些必填、从哪里获取、默认模型和如何切换。
3. **[ChatGPT / MCP 接入](docs/CHATGPT.md)**：开启公网连接、安装插件、授权、对话内验证与重启。
4. **[给部署 AI 的交接指令](docs/AI_HANDOFF.md)**：可直接交给 Codex / Claude Code / Cursor 等执行。
5. **[当前进度与已知限制](docs/STATUS.md)**：哪些已实现、哪些有实测、哪些尚未完成。

可以直接把下面这段连同仓库链接发给队友的 AI：

> 请克隆并部署这个仓库。先阅读 README.md、docs/AI_HANDOFF.md、docs/SETUP.md 和 docs/ENVIRONMENT.md，按验收清单执行。先使用本地 SQLite 跑通网站和 MCP 检查，再接入 ChatGPT。不要覆盖已有 .env，也不要把密钥输出到对话或提交到 Git。缺少 OpenAI API Key 时继续完成手动工作室和 ChatGPT MCP 路径；只有独立网页 AI 功能需要该 Key。报告实际通过的检查、访问地址、仍在运行的进程及必须由我完成的账号授权。

## 当前能做什么

- 首页 → AI 灵感对话 → 3D 工作室 → 收藏 → 测试订单，支持中英文界面。
- 三种结构：绳结串珠、金属垂链、主题挂坠；14 款配件、5 种绳带颜色、金色 / 银色五金。
- 实时 3D 旋转、缩放、挂包预览和有限动态效果；模型与材质随仓库提供。
- 服务端校验组合、重新计算 USD 报价、按访客隔离保存与订单，并处理重复下单请求。
- 本地 SQLite 持久化；可选 Supabase 云存储。
- 可选 Amazon Pay 美国区沙盒：网页官方付款按钮、服务端金额与交易核验、沙盒订单状态及失败后重试。需自己的沙盒账号与密钥；[配置与演示步骤](docs/ENVIRONMENT.md#amazon-pay-沙盒演示)。
- MCP 2025-11-25 / Streamable HTTP、10 个工具、OAuth + PKCE、对话内 MCP Apps 卡片。
- ChatGPT 内读取目录、生成设计、查看 3D、锁定配件后继续对话修改；卡片提供保存和测试结算操作。

当前没有真实支付、物流、库存、用户注册或跨设备账号恢复，也不连接真实 Alexa+ 设备。预算理解由模型完成，最终以服务端明细报价为准。比赛技术路径和英文说明见 [MCP.md](docs/MCP.md)。

## 先选运行方式

| 使用目标 | OpenAI API Key | Supabase | cloudflared | ChatGPT 账号 |
| --- | --- | --- | --- | --- |
| 本地手动 3D、保存、测试订单 | 不需要 | 可选，默认 SQLite | 不需要 | 不需要 |
| 独立网页 AI 灵感对话 | **需要** | 可选 | 不需要 | 不需要 |
| 本地 MCP 调试页的目录示例 | 不需要 | 可选 | 不需要 | 不需要 |
| 本地 MCP 调试页的自然语言 AI | **需要** | 可选 | 不需要 | 不需要 |
| ChatGPT 中安装 LOOP、对话生成预览 | **不需要项目 API Key** | 可选 | 临时接入需要 | **需要自定义 MCP 权限** |

ChatGPT 路径使用宿主模型和账号额度。独立网页路径由后端调用 OpenAI API，使用 API 项目的计费与权限。两者的模型设置互不替代。

## 最快本地启动

先安装 Git 和 **Node.js 24**（代码最低要求 22.13），再安装固定版本 pnpm。`.nvmrc` 为 `24`，不要求安装 Docker、Python、Blender 或 SQLite 命令行。

```bash
git clone https://github.com/Evan0571/charm-studio.git
cd charm-studio
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
```

只在没有 `.env` 时创建配置。跨平台命令如下，不会覆盖已有文件：

```bash
node -e "const fs=require('node:fs'); if(!fs.existsSync('.env')) fs.copyFileSync('.env.example','.env');"
pnpm setup:check
pnpm dev
```

保留终端运行，打开 [http://localhost:3000](http://localhost:3000)。前端与 API 在同一个 Express 服务中，无需再单独启动 Vite。

| 页面 / 接口 | 地址 |
| --- | --- |
| 宣传首页 | `/` |
| AI 灵感对话 | `/#/search` |
| 手动 3D 工作室 | `/#/studio` |
| 已保存设计 | `/#/saved` |
| MCP 调试客户端 | `/mcp-demo.html` |
| 健康检查 | `/api/health` |
| AI 配置状态 | `/api/ai/status` |
| MCP 协议端点 | `/mcp`，需要授权，不是网页 |

macOS 也可双击 `start.command`，它会安装依赖并打开浏览器；已有 Node.js 即可，不要求安装 Codex。Windows / Linux 使用上面的命令。详见 [安装说明](docs/SETUP.md)。

## 开启独立网页 AI 与切换模型

在自己的 `.env` 中填写：

```dotenv
OPENAI_API_KEY=填写你自己的OpenAI_API密钥
OPENAI_MODEL=gpt-4.1-mini
```

重启 `pnpm dev`，再进入 `/#/search`。Key 从 [OpenAI API 控制台](https://platform.openai.com/api-keys) 创建；需要 API 调用权限与可用额度。不要把 ChatGPT 密码或浏览器 Cookie 当作 Key。

**当前代码默认模型及本次交接电脑实际配置均为 `gpt-4.1-mini`。** 可以修改 `OPENAI_MODEL`，但新模型必须支持 Responses API 和严格 JSON Schema 结构化输出，并对你的 API 项目可用。模型参数、超时及验证步骤见 [环境与模型说明](docs/ENVIRONMENT.md)。官方功能说明：[GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)。

## 开启 ChatGPT MCP 插件

安装 [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) 后，在项目根目录执行：

```bash
pnpm build
pnpm chatgpt:connect
```

这会启动独立的本地 `3004` 端口和临时 HTTPS 地址，不需要先运行 `pnpm dev`。保留该终端，然后在自己的 ChatGPT 中操作：

1. 打开 **Plugins / 插件 → Add / 添加 → Add custom MCP server / 创建自定义 MCP 服务器**。
2. 名称填 `LOOP`，Server URL 填终端刚打印的 **HTTPS 地址，包含 `/mcp`**。
3. 认证选 **OAuth**；高级设置的 Client ID 和 Client Secret 留空。
4. 创建插件，点击 Continue to LOOP，在 LOOP 页面点击「授权连接」。
5. 点击 Try in chat，或在对话里选择 `@LOOP`，输入「给棕色包搭配复古包挂，预算 15 美元，展示交互预览」。

**不要复制别人旧的 `trycloudflare.com` 地址。** 每台电脑单独启动并授权；临时地址在进程停止、休眠断连或重新启动后可能失效。完整安装、故障排查及固定域名部署条件见 [CHATGPT.md](docs/CHATGPT.md)。

本次已在真实 ChatGPT 账号完成 OAuth 授权、目录读取、当时人民币版本的 ¥96 设计预览、3D / 挂包切换，以及「卡片锁定樱桃 → 对话换银色 → 锁定仍保留」验证。

## 数据库与私密配置

默认无需任何数据库账号。Node 内置 SQLite 自动创建 `.data/charm-studio.sqlite`。

要用 Supabase，在**目标项目** SQL Editor 执行 [supabase/schema.sql](supabase/schema.sql)，然后同时设置 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEY`。后者是服务端 Secret Key 或兼容的 legacy `service_role` Key，不能用 `anon` / publishable Key 代替。详情和健康检查见 [SETUP.md](docs/SETUP.md)。

`.env`、`.data/`、`node_modules/`、`dist/`、`dist-mcp/` 和临时文件不上传 GitHub。Git 克隆不会带走作者的 Key、数据库、登录会话或 ChatGPT 插件安装状态。即使使用同一个 Supabase，当前访客身份也不等于团队共享账号；不同浏览器或域名不会自动看到同一批草稿。

## 常用命令与验收

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 网站开发服务，默认 3000 |
| `pnpm setup:check` | 检查环境与配置是否齐全，不输出密钥、不调用 AI |
| `pnpm setup:check --url http://localhost:3000` | 额外读取健康、目录、AI 状态接口 |
| `pnpm test` | 业务、几何、接口、MCP、OAuth 等自动化测试 |
| `pnpm mcp:smoke` | 隔离数据库中的真实 MCP 全流程，不消耗 AI 额度 |
| `pnpm build` | TypeScript 检查、网站与 MCP UI 生产构建 |
| `pnpm start` | 启动构建后的普通网站，支持各平台 shell |
| `pnpm build:mcp-ui` | 单独构建对话卡片 |
| `pnpm chatgpt:connect` | ChatGPT 临时公网连接，默认 3004 |
| `pnpm chatgpt:ui-check` | 可选浏览器回归；需另备 Playwright 与 Chrome |

```bash
pnpm test
pnpm mcp:smoke
pnpm build
```

测试使用隔离数据和模拟 AI，不需要真实 API Key；`pnpm setup:check` 只检查 Key 是否配置，不能证明它有效。真正的网页 AI 和 ChatGPT 连接需分别按 [交接验收](docs/AI_HANDOFF.md) 实测。

## 项目结构

```text
src/                    网站、语言切换、AI 对话、3D 工作室
  three/                几何、材质、包型、挂点和物理
  chatgpt/              ChatGPT 内的 MCP Apps 卡片
  mcp/                  独立网页 MCP 调试客户端
shared/                 目录、配置类型、验证、计价、本地化
server/                 Express API、访客身份、AI、存储
  mcp/                  MCP 工具、OAuth、签名凭证、UI 资源
public/assets/          随仓库提供的模型、纹理、HDRI、缩略图
assets-source/          可选的 Blender 编辑源文件
scripts/                启动、诊断、构建辅助、端到端检查
supabase/schema.sql     可选云数据库初始化 SQL
tests/                  自动化测试
docs/                   安装、配置、MCP、验收、素材说明
```

网站 REST 和 MCP 工具复用 `server/studio-service.ts` 及 `shared/` 的业务规则。ChatGPT 专用入口 `server/chatgpt.ts` 关闭额外的服务端 AI 调用，由 ChatGPT 自身读目录并设计。

## 协作、素材与后续工作

队友拉取更新前先保存自己的改动，再执行 `git pull --ff-only`、`pnpm install --frozen-lockfile`；使用生产服务 / MCP 时重新 `pnpm build` 并重启。不要覆盖 `.env`，不要自动删除 `.data`，不要无故升级依赖或改写锁文件。

包模型与配件主要由项目自建，皮革纹理和灯光使用 Poly Haven CC0 资源。来源、许可和可选重建方式见 [ASSETS.md](docs/ASSETS.md)。运行项目不需要重新下载模型，也不需要 Blender。项目尚未统一声明开源许可证；不要把素材 CC0 误认为整个项目已开源授权。

下一阶段需要稳定公网地址、账号与跨设备身份、正式部署运维，以及比赛视频和提交材料。详见 [当前进度](docs/STATUS.md)、[产品说明](docs/PRD.md) 和 [历史验收记录](docs/VALIDATION.md)。
