# 给部署 AI 的交接指令

这是给队友的 AI 编程助手使用的执行说明。目标是在队友自己的电脑上部署当前 LOOP 版本并真实验证可用，不是重新设计技术栈或仅复述 README。

## 可直接复制的任务

```text
请部署 https://github.com/Evan0571/charm-studio 当前 master 分支。
先阅读 README.md、docs/SETUP.md、docs/ENVIRONMENT.md、docs/CHATGPT.md 和 docs/STATUS.md。
检查操作系统、GitHub 权限、Node 与 pnpm 版本。使用 Node 24、pnpm 11.25.0 和 frozen lockfile。
先跑通本地 SQLite、手动 3D 工作室及 MCP smoke 检查，再处理可选的 OpenAI API、Supabase、ChatGPT 授权。
不要覆盖已有 .env，不要打印或提交密钥，不要复制原作者的临时 MCP 域名、Cookie、.data 或本机工具路径。
安装过程遇到缺少 API Key，不要停止所有工作：手动路径和 ChatGPT 的目录/预览路径不需要项目 API Key。
执行验收步骤并报告实际结果，不把配置存在、模型口头描述或模拟测试当成真实外部服务成功。
需要我提供 Key 或完成账号登录时，只说明变量名/用途和本机填写位置，不让我把凭据贴进聊天。
完成后告诉我本地地址、当前 MCP 地址、必须保留的进程、停止方法，以及哪些可选功能尚未验证。
```

## 执行顺序

### A. 只读检查

1. 确认根目录存在 `package.json`，检查 `git status`；不要覆盖队友已有改动。
2. 读取 `package.json` 的 `engines`、`packageManager` 和 scripts。运行 `node --version`、`pnpm --version`、`git --version`。
3. 私有仓库 404 时处理仓库邀请 / Git 登录，不自动改远程 URL 为含 Token 的形式。
4. `.env` 已存在则保留，不打印整个文件；新安装使用 `.env.example` 创建。

### B. 最小无密钥部署

```bash
pnpm install --frozen-lockfile
node -e "const fs=require('node:fs'); if(!fs.existsSync('.env')) fs.copyFileSync('.env.example','.env');"
pnpm setup:check
pnpm test
pnpm build
pnpm mcp:smoke
```

`pnpm setup:check` 是项目命令；`pnpm doctor` 是 pnpm 自己的命令，两者不同。构建与安装需要网络 / 时间，不要因 bundle 大小警告就更换框架。

在持续运行的终端启动 `pnpm dev`，另一个终端运行：

```bash
pnpm setup:check --url http://localhost:3000
```

如果需要验证生产模式，先停止占用同端口的开发服务，再运行 `pnpm start`。不能让两个进程同时占用同一端口。

### C. 浏览器验证

- `/#/studio`：能切换配置、出现 3D、报价正确更新。
- 保存测试草稿，刷新后在 `/#/saved` 重开；始终使用同一 hostname 和访客。
- 核对测试订单确认 / 取消行为。需要创建测试记录时明确标记为测试。
- 切换语言，确认配置仍保留。
- `/mcp-demo.html`：真实连接、目录发现、可选的确定性目录示例。没有 API Key 时不要声称自然语言 AI 已通过。

无浏览器自动化能力时，明确列出未检查项，给人类简单的验收步骤，不能编造视觉测试结果。

### D. 可选外部服务

| 用户选择 | 所需信息 | 操作 |
| --- | --- | --- |
| 独立网页 AI | 自己的 `OPENAI_API_KEY`，默认模型即可 | 由用户在本机填写，重启普通服务，发一次真实搭配请求 |
| Supabase | 目标项目 URL + 服务端 Secret / service_role Key | 确认项目后执行完整 schema.sql，健康检查、测试草稿写入验证 |
| ChatGPT 插件 | 账号可创建自定义 MCP，cloudflared 可用 | 构建、启动 helper、填当前 URL、OAuth 授权、真实对话预览 |

不应为了部署自行购买套餐、创建收费资源、公开仓库、批量发邀请或把测试数据库迁移进团队已有生产库。缺少可选服务的权限时完成其余步骤并说明缺项。

### E. ChatGPT 实测

安装 cloudflared 后运行 `pnpm chatgpt:connect`。读取**本次**终端生成的 `/mcp` 地址，认证 OAuth，Client ID / Secret 留空。创建并安装个人插件，用户完成需要本人操作的登录验证或 OAuth 授权。

对话里选择 LOOP：先读目录生成预算 15 美元的预览，再锁定一个配件并用对话换银色。确认返回新卡片、锁定保留、价格由服务端给出。先不保存 / 下单就可以验证连接。

只有当前账号完成真实授权和调用才能标记 ChatGPT 实测通过。`pnpm mcp:smoke` 通过只证明协议 / 业务流程，不证明 ChatGPT 安装或公网可达。

## 可选的自动浏览器回归

普通部署不必额外安装浏览器测试依赖。需要重跑 UI 时，准备 Playwright 的 Node 模块以及系统 Chrome。脚本使用 `channel: 'chrome'`，仅有 Playwright 的默认 Chromium 下载不等于已经安装 Chrome。

可以在仓库外建立独立工具目录，避免为了跑测试修改项目 lockfile：

```bash
mkdir loop-browser-tools
cd loop-browser-tools
npm init -y
npm install playwright
```

回到项目根目录，将 `PLAYWRIGHT_MODULE` 设为这个工具目录的 `node_modules/playwright/index.mjs` 绝对路径。macOS / Linux 示例：

```bash
export PLAYWRIGHT_MODULE=/absolute/path/loop-browser-tools/node_modules/playwright/index.mjs
pnpm chatgpt:ui-check
node --import tsx scripts/language-browser-check.mjs
```

Windows PowerShell 示例：

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///C:/absolute/path/loop-browser-tools/node_modules/playwright/index.mjs'
pnpm chatgpt:ui-check
node --import tsx scripts/language-browser-check.mjs
```

上述目录是示意，换成实际路径；Windows 动态 import 使用 `file:///C:/...` 文件 URL。不要照抄原作者 `/Users/.../.cache/codex-runtimes` 路径。回归使用独立数据库，截图输出到被忽略的 `tmp/`。本地 AppBridge 的结果仍不能替代真实 ChatGPT 账号测试。

## 交付报告必须包含

| 项目 | 报告内容 |
| --- | --- |
| 版本 | 仓库 URL、分支、`git rev-parse --short HEAD` |
| 环境 | OS、Node、pnpm，是否安装 cloudflared |
| 网站 | 实际监听地址和端口、开发 / 生产模式、对应进程或终端 |
| 数据 | local / supabase，草稿刷新重开是否通过；不要报告密钥 |
| AI | 普通网站模型名称、是否真实调用通过，或未配置原因 |
| MCP | smoke 结果、当前临时 URL、ChatGPT 是否真正安装 / 授权 / 渲染 |
| 验证 | 测试 / 构建退出状态、人工交互结果、未验证项 |
| 生命周期 | 哪些终端保持运行、Ctrl+C 停止、临时 URL 会变化、私有数据需保留 |

## 对后续开发 AI 的代码定位

- `server/stylist.ts`：固定 OpenAI Responses endpoint、默认模型、严格 schema、45 秒超时、锁定保护。
- `shared/domain.ts` / `shared/catalog.ts`：配置校验和确定性计价；不要让前端或模型提供最终总价。
- `server/studio-service.ts`：REST / MCP 共用保存、下单和 AI 限流。
- `server/storage.ts`：SQLite / Supabase 切换；不能只配一个 Supabase 变量。
- `server/mcp/http.ts` / `oauth.ts`：Host / Origin、OAuth、协议；不要为排错删除鉴权。
- `server/mcp/server.ts` / `widget.ts`：工具与 UI 资源 metadata。
- `src/chatgpt/main.tsx`：对话卡片、模型上下文、保存和测试确认。
- `src/three/`：3D 几何与物理；部署任务不应顺手重构正在打磨的模型。
- `scripts/chatgpt-connect.mjs`：临时隧道及子进程，不是固定云托管部署器。
