# 在 ChatGPT 中安装与使用 LOOP MCP

目标体验是：在 ChatGPT 对话里选中 LOOP，用自然语言设计、修改包挂，结果直接显示为可交互卡片。无需重新搭建一个聊天网页。项目另有 `/mcp-demo.html` 用于调试协议，两者共用业务规则。

第一次接手先完成 [SETUP.md](SETUP.md)；变量说明见 [ENVIRONMENT.md](ENVIRONMENT.md)。本次交接已在作者的真实 ChatGPT 网页账号完成连接与交互验证，队友需要在自己的账号重新安装和授权。

## 1. 账号与软件要求

- GitHub 访问权限、Node.js 24、pnpm 11.25.0、已安装的项目依赖。
- ChatGPT 目标账号 / 工作区有创建自定义 MCP 服务器的权限。可先确认插件页面能看到该入口；权限因账号或工作区而异，作者能用不代表队友自动能用。
- 本机安装 cloudflared，并允许它访问网络。临时 Quick Tunnel 不需要 Cloudflare 账号或自有域名。
- 不需要 Alexa+ 合作伙伴权限，也不需要为了这一条路径创建 OpenAI API Key。

ChatGPT 中的个人测试连接不等于公开上架插件。官方入口说明：[Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)。

## 2. 安装 cloudflared

使用 [Cloudflare 官方下载页](https://developers.cloudflare.com/tunnel/downloads/)，选择与操作系统、CPU 架构一致的程序。

macOS 已有 Homebrew 时：

```bash
brew install cloudflared
cloudflared --version
```

Windows：下载官方 Windows 程序，重命名为 `cloudflared.exe`。可以放入仓库 `.data/bin/cloudflared.exe`，或例如 `C:/tools/cloudflared.exe` 并在 `.env` 中设置：

```dotenv
CLOUDFLARED_BIN=C:/tools/cloudflared.exe
```

macOS / Linux 也可下载官方二进制，授予执行权限，放入 `.data/bin/cloudflared`，或将其绝对路径填到 `CLOUDFLARED_BIN`。不要下载来源不明的同名程序。项目使用以下优先级：显式 `CLOUDFLARED_BIN` → `.data/bin/` 对应文件 → PATH 中的 `cloudflared`。

**cloudflared 本体不在 Git 仓库里。** 作者机器上有，不代表新电脑已经安装。完成后执行 `pnpm setup:check`，应显示 cloudflared available。

## 3. 构建并开启 MCP

在仓库根目录：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm chatgpt:connect
```

helper 会：

1. 读取 `.env`，检查本地 3004 端口未被占用，检查网站与 MCP UI 构建存在。
2. 启动 Cloudflare Quick Tunnel，取得本次生成的 HTTPS 域名。
3. 启动 `server/chatgpt.ts`，绑定 `127.0.0.1:3004`，配置该域名的 OAuth / MCP。
4. 读取或生成私有签名密钥，使用现有存储配置；没配置 Supabase 就用 SQLite。
5. 验证公网 MCP discovery 返回正确 resource，最后打印可以填进 ChatGPT 的地址。

终端输出类似：

```text
ChatGPT → Plugins → Add custom MCP server
Name: LOOP
Server URL: https://YOUR-GENERATED-HOST.trycloudflare.com/mcp
Authentication: OAuth (dynamic client registration; leave client ID/secret empty)
```

这里的域名只是占位示意，**实际使用你这次终端打印的地址**。`pnpm chatgpt:connect` 自己运行专用服务器，不需要先启动 `pnpm dev` 或 `pnpm start`。它与 3000 网站可同时存在。

如果 3004 被占用，在 `.env` 中加 `CHATGPT_PORT=3005` 再运行 helper。不要为了腾端口停止其他人的开发服务。保留终端和网络连接，电脑休眠可能中断隧道。

## 4. 在自己的 ChatGPT 中安装

建议先用浏览器打开 ChatGPT，界面名称可能因语言 / 版本不同而略有变化。

| 字段 | 填写内容 |
| --- | --- |
| 操作入口 | Plugins / 插件 → Add / 添加 → Add custom MCP server |
| Name | `LOOP` |
| Description | `Design and preview custom bag charms, save drafts and confirm test orders.` |
| Connection | Server URL |
| Server URL | 本次终端打印的完整 `https://…/mcp` |
| Authentication | **OAuth** |
| OAuth Client ID | **留空** |
| OAuth Client Secret | **留空** |

创建插件后点击 Continue to LOOP，在 LOOP 页面点击「授权连接」，等待浏览器自动返回 ChatGPT。确认连接完成，再点击 Try in chat 或从对话中选择 `@LOOP`。

Client ID 和 Client Secret 留空是因为服务器支持动态客户端注册，不是少了某个 API Key。不要将 `OPENAI_API_KEY`、`MCP_TOKEN_SECRET` 或 Supabase Key 填到这些输入框里。OAuth 页面会解释所授权的访客工作台以及测试订单性质。

2026-10-08 实测 ChatGPT 网页的 Try in chat 可以直接进入对话并显示卡片。若你所在工作区要求 Work / 开发者模式，遵循目标账号显示的设置；不要仅凭 Codex 里的插件入口就认定 ChatGPT 已有权限。

## 5. 最小对话验收

发送：

> 给我的棕色包搭配一款复古包挂，预算 15 美元。读取 LOOP 目录，直接在对话里展示可交互设计预览，先不要保存或下单。

应看到真实工具调用、设计名称、USD 报价、默认加载的 3D 预览、配件锁定、保存和测试订单入口。可以直接切换 On a bag / 挂包效果。3D 加载失败时显示设计插画，并提供 View 3D / 查看 3D 重试入口。卡片有独立语言选择。

发送「主挂饰还能换成什么？」时，助手应调用 `loop_preview_design`，保留当前完整配置并传入 `selectionSlot: "main"`；询问辅助挂饰则传入 `selectionSlot: "accent"`（上述 ID 用于 hero 样式，其他样式用其目录中的 slot ID）。卡片展开配件插画、名称、材质和单件价格，点击后更新搭配、总价和模型上下文。也可以直接点击卡片里的 Change / 更换打开选择器。锁定位置须先解锁；合法的可选位置可以留空。选择配件不会自动保存或创建订单。

卡片可以直接点选 3D 配件、搜索替换项、改名和撤销上一步。选择器使用与网站一致的模型缩略图，并显示替换后的搭配总价；保存后显示已保存状态，进一步编辑会显示未保存修改。报价过期时先刷新，再重新确认。

在卡片里锁定一个配件，再发送：

> 五金换成银色，保留我刚才锁定的配件，其他配件不变。展示更新后的预览，先不保存或下单。

新预览应保持该配件及锁定状态。卡片点击产生的配置通过 MCP Apps 的 model context 传回对话，不是单纯的截图。

如要验收写入，再明确要求保存一个测试草稿；保存修改应继续使用同一个 draft ID。测试结算分两步：先准备报价，再在显示明细后明确确认。取消不创建订单。所有订单都不会扣款、预留库存、制造或发货。

当前目录的新报价采用 USD，界面默认 English；需要中文时显式切换语言。首次只验证预览也足以确认 MCP / OAuth / 卡片接入。不要把助手口头说“已连接”当作成功，应看到真实卡片与交互结果。

## 6. 模型和数据身份

ChatGPT 标准路径是 `loop_get_catalog` → 宿主模型生成配置 → `loop_preview_design`。它不调用本项目的 OpenAI API；模型由 ChatGPT 选择，`.env` 的 `OPENAI_MODEL` 不改变它。

专用 `server/chatgpt.ts` 明确关闭 `loop_suggest_design` 和网页 AI 的服务器端推理入口。因此在 3004 的 `/api/ai/status` 看到 `configured:false` 是预期行为，即使普通 3000 网站已配置 Key。需要网页 AI 时使用 `pnpm dev` / `pnpm start` 的普通入口。

OAuth 绑定的是授权浏览器在当前 HTTPS 域名下的 `loop_guest` Cookie。它不是邮箱登录、不是 ChatGPT 账号与 LOOP 用户的一对一注册，也不是 Supabase Auth：

- `localhost` 的旧草稿不会自动成为新 HTTPS 域名访客的草稿。
- 在同一授权浏览器打开隧道根地址的 `/#/saved`，可以查看 ChatGPT 保存到这个访客名下的设计。
- 换浏览器、清 Cookie、换域名会成为另一位访客；共用数据库不等于共用身份。
- 队友自己部署并授权会获得自己的访客工作台；不要复制作者 Cookie 来共享数据。

## 7. 停止、重启和更新

Ctrl+C 停止 helper，会停止其 Node 子进程和隧道。运行元信息在 `.data/chatgpt-connection.json`，隧道日志在 `.data/chatgpt-tunnel.log`。这些文件被 Git 忽略，旧元信息不代表连接仍在线。

重新运行通常会获得新域名。把新 `/mcp` 地址重新配置到插件并授权；如果 ChatGPT 当前界面不提供编辑 URL，可删除你自己创建的失效开发插件，再用新地址创建，别误删别人的正式连接。

代码更新后：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm chatgpt:connect
```

先停止上一份 helper 再重启，避免端口冲突。只改卡片时可单独 `pnpm build:mcp-ui`，但既有 ChatGPT 卡片可能缓存旧资源；在 ChatGPT 刷新插件工具 / 连接并生成新预览。不要继续把旧临时域名发给队友作为永久部署地址。

helper 内的 Node watch 进程会在后端源码变更时重载服务，保持当前隧道地址与已有 OAuth 注册。更新卡片后仍需刷新工具，并在新对话验证。不要手动终止 helper 或其隧道来重载后端，否则临时域名会失效。

[Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)用于测试，无稳定运行保证，也不支持 SSE。LOOP 使用 stateless Streamable HTTP 的 JSON 响应，不依赖独立 SSE 长连接。

## 8. 排错顺序

| 现象 | 检查和恢复 |
| --- | --- |
| `Run pnpm build before connecting ChatGPT` | 在根目录完整构建，确认 `dist/index.html`、`dist-mcp/loop-widget.js` / `.css` 存在 |
| `Install cloudflared first` | 检查二进制路径、系统架构、执行权限；Windows 路径用实际 exe |
| `EADDRINUSE` | 当前 CHATGPT_PORT 已有进程；停止你自己的旧 helper 或换端口 |
| 公网 endpoint verification 失败 | 看隧道日志是否连接成功；检查网络、DNS、代理、企业防火墙；不要关闭 TLS 验证 |
| 域名无法解析 | 临时域名可能尚未可解析或已经失效；先检查 helper 当前 URL 和日志，再重试；不要自动修改系统 DNS |
| Cloudflare 显示隧道不存在 / 502 / 休眠后掉线 | 当前隧道或本地进程失效，重新启动并更新 ChatGPT 地址 |
| 创建后一直显示未连接 | 回到插件继续 OAuth；确认授权页能开，点击授权后返回 ChatGPT |
| 授权请求过期 | 授权页面有效期 5 分钟；回 ChatGPT 发起新授权，不反复提交旧表单 |
| `/mcp` 打开 401 | 未授权的协议请求是预期；不要改成 No authentication 规避 OAuth |
| OAuth 提示 resource / audience 不匹配 | 检查是否混用了旧域名、漏掉 `/mcp`，或固定部署代理 Host 不正确 |
| 连接后没工具 / 卡片 | 刷新工具列表，确认 10 个设计工具及卡片专用的素材工具；新对话明确选择 LOOP；检查构建和 v2 UI 资源 |
| 有卡片，3D 加载失败 | 检查同一 HTTPS 域名 `/assets/` 可访问、CORS / CSP 和 WebGL；卡片可回退到 SVG |
| `loop_suggest_design` 提示不可用 | 专用入口有意关闭；让 ChatGPT 读目录并调用 `loop_preview_design` |
| 保存后另一个域名看不到 | 访客 Cookie 和域名不同；先按第 6 节确认身份，不要清库 |

只调用健康检查或 `tools/list` 不能证明 UI 能渲染；真实对话预览与点击验证单独进行。

## 9. 固定域名 / 长期开启

临时 helper 用于队友本机验证。稳定服务需要一个长期运行的 Node 进程、HTTPS 反向代理 / 固定隧道、固定域名及持久化私有数据目录。仓库目前没有一键云托管脚本，也没有自动发布到商店。

固定部署不要运行 `chatgpt:connect`（它会生成并覆盖临时地址）。在服务器私密环境中设置：

```dotenv
PORT=3004
MCP_PUBLIC_URL=https://your-domain.example/mcp
MCP_TOKEN_SECRET=你自己生成并妥善保存的至少32字符随机值
COOKIE_SECURE=true
```

准备依赖和构建后运行：

```bash
node --import tsx server/chatgpt.ts
```

该入口固定绑定 `127.0.0.1`。反向代理与应用同机时可直接转发；容器部署需要明确调整绑定和网络，不能只设 `HOST=0.0.0.0` 就声称可用。保留浏览器访问的公网 Host，转发整个 origin 的 `/mcp`、OAuth discovery / authorize / token / register / revoke、`/oauth/`、`/assets/` 等路由，不能只暴露 `/mcp`。

持久化 `.data/mcp-oauth.sqlite` 和稳定签名凭据；SQLite 业务模式还需业务数据库。该 OAuth 存储适用于单 Node 进程，不是多副本分布式架构。配置进程守护、重启、备份及网络保护，再在目标 ChatGPT 账号重复验收。服务端端口不是 HTTPS 本身，需要代理提供 TLS。

[OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)是另一种平台接入方式，当前仓库 helper 没有实现它；不要将 ChatGPT 表单中的 Tunnel 选项与本流程的 Cloudflare Server URL 混用。

## 10. 实现与验证记录

- MCP 协议：2025-11-25，官方 SDK，10 个设计工具及 1 个仅供卡片调用的素材工具；英文协议说明见 [MCP.md](MCP.md)。
- UI 资源：`ui://loop/design-v5.html`，`text/html;profile=mcp-app`，官方 MCP Apps bridge；v1 / v2 / v3 / v4 URI 仍可读取。
- 对话模型保存并打开同一草稿时，卡片会重新读取持久化基准，自动核对“已保存”状态；后台核对只更新保存基准，不覆盖用户继续编辑的名称或配件。工具描述也要求保存结束后再打开预览。
- 保存比对使用固定字段顺序，兼容 Supabase JSONB 对顶层配置及配件字段的重排，相同配置重新读取后仍显示已保存。
- UI 工具调用经宿主转发，iframe 不持有 OAuth Token；3D 资产通过仅供卡片调用的 `loop_get_preview_asset` 读取，固定文件白名单与单条消息大小限制。选择器缩略图内嵌，素材不依赖外部 fetch。首次挂件预览只读取灯光与皮革的 7 个素材，点选挂包效果后才读取当前包模型。宿主仍在传输素材时保留加载状态，素材到齐后自动显示 3D；25 秒渲染超时从素材准备完成后开始。
- OAuth：DCR、显式访客授权、S256 PKCE、一次性 code、1 小时 access token、轮换 refresh token、30 天 grant、撤销。
- 真实 Chrome 回归覆盖表单 Origin 和跨站 303 回调；授权页 CSP 只额外允许已登记客户端的 callback origin。
- 2026-10-08 作者账号实测：OAuth 安装、目录、此前人民币版本的 ¥96 樱桃 / 木珠 / 珍珠卡片、3D / 挂包、锁定中央樱桃后对话改银色。该账号测试未保存或下单；当前美元版本还需在目标账号重新验收。
- 实测 ChatGPT 开发卡片当时显示 CSP off；启用 CSP 的隔离 iframe 验证在本地官方 AppBridge harness 完成，不能把两种环境混为同一次验证。

可选浏览器回归需要 Playwright 模块和 Chrome，详见 [AI_HANDOFF.md](AI_HANDOFF.md)；普通队友部署不依赖这套浏览器测试工具。
