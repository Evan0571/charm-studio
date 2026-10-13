# 新电脑安装与部署

本文面向第一次拿到仓库的队友，也可交给部署 AI 执行。配置清单见 [ENVIRONMENT.md](ENVIRONMENT.md)，ChatGPT 安装见 [CHATGPT.md](CHATGPT.md)。先跑通不需要密钥的本地路径，再添加云端服务。

如果要部署固定公网地址，直接按 [Vercel 部署步骤](VERCEL_DEPLOY.md) 操作；该路径需要 Supabase，不需要本机临时隧道。

## 1. 你需要准备什么

| 项目 | 必需性 | 说明 |
| --- | --- | --- |
| GitHub 仓库访问权限 | 必需 | 仓库私有，所有者需邀请队友，队友接受邀请后再克隆 |
| Git | 推荐 | 用于克隆、拉取和贡献；有权限也可下载 ZIP |
| Node.js 24 | 必需 | `.nvmrc` 为 24，最低 22.13；用 Node 内置 SQLite，无需另装数据库 |
| pnpm 11.25.0 | 必需 | 使用仓库固定版本和锁文件，不使用 `npm install` 安装项目依赖 |
| Chrome / Edge 等支持 WebGL 的浏览器 | 必需 | 3D 使用本地 GPU；不需要 CUDA 或本地大模型 |
| OpenAI API Key 与可用 API 额度 | 网页 AI 才需要 | 不影响手动设计，也不是 ChatGPT MCP 标准路径的前提 |
| Supabase 项目与服务端 Key | 可选 | 默认 SQLite 足够运行全部业务流程 |
| cloudflared | 临时接入 ChatGPT 才需要 | 每台电脑单独安装，与 OS / CPU 架构匹配 |
| 允许创建自定义 MCP 的 ChatGPT 账号 | 接入 ChatGPT 才需要 | 账号与工作区权限需在目标账号确认 |

不需要：Alexa+ 合作伙伴权限、AWS Key、Docker、Python、Blender、SQLite CLI、Codex 安装包。Blender 只用于修改原始素材，不是运行依赖。仓库已经包含 GLB、纹理、HDRI 和缩略图。

## 2. 安装基础工具

从 [Node.js 官网](https://nodejs.org/en/download) 安装 Node.js 24，从 [Git 官网](https://git-scm.com/downloads) 安装 Git。安装后重新打开终端：

```bash
node --version
npm --version
git --version
npm install --global pnpm@11.25.0
pnpm --version
```

预期 Node 为 `v24.x`，pnpm 为 `11.25.0`。已有 nvm 的 macOS / Linux 用户可在仓库中执行 `nvm install`、`nvm use`，读取 `.nvmrc`。不要混用系统旧 Node 和另一个终端里的新 pnpm。

Windows 使用 PowerShell / Windows Terminal。如果系统拦截 `pnpm.ps1`，可使用 `pnpm.cmd` 执行相同命令，无需为运行项目全局放开执行策略。macOS / Linux 全局 npm 安装遇到权限问题时，优先使用自己的 Node 版本管理器，不要反复对系统目录执行 sudo 安装。

## 3. 克隆与依赖安装

```bash
git clone https://github.com/Evan0571/charm-studio.git
cd charm-studio
git branch --show-current
pnpm install --frozen-lockfile
```

默认分支为 `master`。如果 GitHub 返回 404 / Repository not found，先确认账号已接受私有仓库邀请，并通过系统 Git 凭据管理器或 SSH 登录；不要把 GitHub Token 写进克隆 URL、README 或聊天记录。

ZIP 用户解压后进入包含 `package.json` 的目录。ZIP 不带 Git 历史，后续协作建议改用 clone。文件路径有空格时必须给路径加引号。所有下文命令都在项目根目录运行。

`--frozen-lockfile` 失败时，先确认 pnpm 版本和分支，不要删除锁文件或批量升级依赖。首次安装需要能访问 npm registry。

## 4. 创建最小配置

跨平台命令，已有 `.env` 时不做修改：

```bash
node -e "const fs=require('node:fs'); if(!fs.existsSync('.env')) fs.copyFileSync('.env.example','.env');"
```

最小配置实际上只需：

```dotenv
PORT=3000
HOST=127.0.0.1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

保持 Supabase、固定公网 URL 和 Secure Cookie 设置未启用。`.env` 是隐藏文件；macOS Finder 使用 `⌘⇧.` 显示，Windows 注意不要保存成 `.env.txt`。

```bash
pnpm setup:check
pnpm dev
```

看到 `LOOP Studio is ready at http://localhost:3000 (local storage)` 后保留终端。打开 `http://localhost:3000/#/studio`，可以立即手动搭配，无需先配置 Key。

在第二个终端执行：

```bash
pnpm setup:check --url http://localhost:3000
```

新电脑使用最小配置时，预期 `/api/health` 返回 `{"status":"ok","storage":"local"}`，`/api/ai/status` 返回 `{"configured":false}`。后者不是安装失败，只表示独立网页 AI 尚未启用。

## 5. 本地验收

先在浏览器操作，再执行自动化检查：

1. 工作室切换结构 / 配件 / 五金，确认 3D 出现且价格变化。
2. 保存一个明显标记为测试的设计，刷新后从「收藏」重开。
3. 打开测试订单确认页面；取消时不创建订单，明确确认后才生成测试记录。
4. 在界面切换 English / 简体中文，确认不影响配置。

同一轮操作固定用 `localhost`，不要中途改成 `127.0.0.1` 或无痕窗口，否则会获得另一位访客身份。

```bash
pnpm test
pnpm mcp:smoke
pnpm build
```

这些自动化测试不消耗真实 OpenAI API 额度，使用隔离数据库。构建包含大型 3D bundle，可能需要数分钟；chunk 大小警告不等于构建失败，以退出码为准。

macOS 一键方式：双击根目录 `start.command`。它会找到 Node、按固定 pnpm 版本安装依赖、等待健康检查并打开浏览器；关闭服务用 Control+C。ZIP 文件失去执行权限时执行 `chmod +x start.command`。这个启动器面向 macOS；Windows / Linux 使用命令行流程。

## 6. 按需开启网页 AI

在自己的 `.env` 填写真实 `OPENAI_API_KEY`，保持 `OPENAI_MODEL=gpt-4.1-mini`，手动停止并重新运行 `pnpm dev`。`.env` 修改不应仅依赖浏览器刷新或热更新。

打开 `/#/search`，输入「棕色包，复古风，预算 15 美元」，检查返回可编辑配置及服务端报价，再测试「锁定一个配件后换银色」。本步骤会调用你的 OpenAI API 项目并消耗额度。

`configured:true` 只证明非空 Key 已被读取，不证明 Key 有效、模型有权限或余额足够。切换模型的要求与故障说明见 [ENVIRONMENT.md](ENVIRONMENT.md)。

## 7. 可选：Supabase 云端存储

建议队友先使用自己创建的开发 Supabase 项目。如果团队决定共用已有项目，所有者通过私密渠道提供对应 URL 和服务端 Key，或授予适当项目访问权限；GitHub 不保存这些值。

1. 在目标 Supabase 项目打开 SQL Editor，检查项目身份后执行仓库的完整 `supabase/schema.sql`。
2. 确认 `public.charm_designs` 和 `public.charm_orders` 已存在。
3. 在 `.env` 同时填写：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

4. 重启服务，再执行 `pnpm setup:check --url http://localhost:3000`。
5. `/api/health` 应返回 `{"status":"ok","storage":"supabase"}`；实际保存测试草稿并刷新验证。

这是通过 `supabase-js` 访问 Data API，不使用 Postgres 连接字符串。Supabase 仪表盘的项目 API Keys 中取得服务端 Secret Key，或使用已有 legacy `service_role` Key。不要用 publishable / anon Key，也不需要 `DATABASE_URL`、数据库密码或 Supabase CLI 登录 Token。

SQL 已开启 RLS，并仅向 `service_role` 显式授予所需表权限。当前表设计是服务端按访客过滤，不能为排错随意关闭 RLS 或向 `anon` / `authenticated` 开放访问。新项目的 Data API 默认权限可能更严格，若出现表不可见 / `42501`，检查完整 SQL 中的 GRANT 已执行、Data API 开启且 `public` 为暴露 schema。参考 [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) 与 [新表显式授权变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)。

两个变量只填一个时服务会拒绝启动。Supabase 配置完整但故障时返回 503，不会悄悄切回 SQLite。切换数据库不会自动迁移旧数据。

## 8. 生产构建和 ChatGPT 是不同启动入口

普通网站生产模式：

```bash
pnpm build
pnpm start
```

仍默认使用 3000、现有 `.env`、可选网页 AI。`pnpm start` 的环境变量在 JS 启动器内设置，因此不依赖 shell 的 POSIX 赋值语法。

ChatGPT 演示模式：

```bash
pnpm build
pnpm chatgpt:connect
```

它自己启动 3004 上的专用服务器，不需要先 `pnpm start`。专用入口关闭服务器端 AI stylist，由 ChatGPT 模型完成推理。可以同时保留 3000 网站服务，但不要启动两份占用 3004 的 MCP helper。下一步按 [CHATGPT.md](CHATGPT.md) 安装和授权。

## 9. 更新、停止与保留数据

日常更新先保存自己的改动，确认工作区状态：

```bash
git status
git pull --ff-only
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

然后停止并重启受影响的服务；ChatGPT 临时隧道重启会换地址，需要重新配置插件。`pnpm dev` 可以热更新代码，但不自动重建 `dist-mcp`；卡片源码变化后至少重新 `pnpm build:mcp-ui`。

Ctrl+C 停止各自终端中的进程。不要为了腾端口批量杀死所有 Node 进程。不要删 `.data` 排错：其中可能有设计、订单及 OAuth 凭据。备份 SQLite 时先停止使用它的服务，再完整备份私有 `.data`，避免只拷贝主文件而遗漏 WAL。备份数据库并不会建立跨设备用户身份。

## 10. 常见问题

| 现象 | 处理 |
| --- | --- |
| `node:sqlite` 不存在 / 语法错误 | 换到 Node 24，重新打开终端，确认 `node --version` |
| `pnpm` 不存在或版本不符 | 安装 `pnpm@11.25.0`；Windows 可用 `pnpm.cmd` |
| 端口已占用 / `EADDRINUSE` | 停止你自己上一份服务，或在 `.env` 修改 `PORT` / `CHATGPT_PORT` |
| 页面能开但 AI 不可用 | 手动工作室仍可用；检查 Key、模型权限、API 额度，重启服务 |
| `/api/health` 返回 503 | 检查 Supabase 两个变量、表结构、Data API 与网络；不要自动清库 |
| `Set both SUPABASE...` | 同时填写两项，或同时移除以使用 SQLite |
| 3D 空白 / 首次加载慢 | 等待 GLB / HDRI 加载，检查浏览器 WebGL / 硬件加速和 Network 资源请求；可用回退图，不需重建 Blender 模型 |
| 刷新后草稿不见 | 确认同一 hostname、Cookie、访客、数据库模式；新域名不是原访客 |
| `dist` / `dist-mcp` 缺失 | 运行 `pnpm build`；这些产物不随 Git 上传 |
| MCP 地址浏览器打开提示 401 | `/mcp` 是授权协议端点，未带凭据时正常；用 ChatGPT OAuth 或网页调试客户端连接 |
| Windows 找不到 cloudflared | 参照 CHATGPT.md 安装 exe，设置 `CLOUDFLARED_BIN` 或放入 `.data/bin/cloudflared.exe` |
| 安装检查脚本报 dotenv 缺失 | 先运行 `pnpm install --frozen-lockfile` 再执行检查 |

当前实测平台与尚未验证事项见 [STATUS.md](STATUS.md)。不要把“命令跨平台”写成“所有平台均已实测”。
