# 验收记录

最新验证日期：2026 年 10 月 13 日；下方各节保留对应版本的验收范围。

## 2026-10-13 — 线上沙盒付款与 MCP 分享检查

- 网站与 MCP 固定域名为 `https://loop-charm-studio.vercel.app/`。生产版本 `89fdcef` 已部署；`/api/health` 返回 HTTP 200 / `storage:supabase`，Amazon Pay 状态为已配置的 Sandbox。
- 真实 Amazon Pay 测试买家已完成 US$15.00 沙盒交易。Amazon 返回 `Captured`，服务端按会话、订单、单次授权、Sandbox 环境及金额核验后保存 `sandbox_paid`，网站重新核验显示付款成功。结账会话在网站发起，首次完成由修复后的本地服务连接同一生产数据库和 Amazon 沙盒 API 执行；修复随后部署，线上回执读取同一笔已核验交易。没有手工改为已支付，也没有使用 mock provider；没有真实扣款或发货。
- 已修复官方响应省略 `checkoutMode` 时被错误拒绝，以及已绑定的 Completed 会话省略元数据后的重试；明确冲突的模式、环境、金额、授权或交易仍拒绝。`pnpm test`：**173 / 173 通过**。
- 付款证据和测试买家密码仅保存在被 Git 忽略的本机 `.data/amazon-pay/`，API 私钥仅在本机私密配置及 Vercel 服务端环境中；未提交到仓库。
- 公网只读分享检查：`/.well-known/oauth-protected-resource/mcp` 与 `/.well-known/oauth-authorization-server` 均 HTTP 200，canonical resource 为 `https://loop-charm-studio.vercel.app/mcp`，支持动态客户端注册与 S256 PKCE。匿名 `/mcp` 返回 HTTP 401 及正确 OAuth discovery 地址。无需 Vercel 登录即可访问发现接口。
- 最新主工作区完整构建、Vercel 云入口离线装载和桌面 stdio 检查通过。新增构建后 `scripts/mcp-streaming-check.mjs` 并接入 CI：完整卡片和 GLB 的真实 HTTP SSE 响应均超过 4.5 MiB、无 Content-Length，内容完整；官方 SDK 可解析同一完整卡片。使用内存存储，仅允许本机 HTTP 请求，不调用外部模型、Amazon 或真实数据库。
- 这些检查确认公网入口和授权配置可达，未代替第二个真实 ChatGPT 账号的安装、OAuth 与卡片点击验收。个人自定义连接不等于公开插件目录上架。MCP 卡片仍只创建体验订单，Amazon Pay 沙盒付款在网站完成。

## 2026-10-13 — Amazon Pay 美国区沙盒接入初版（历史记录）

- 网页提供官方 Amazon Pay 按钮与 `PayOnly` 单次结账，固定 USD/Sandbox。服务端签名绑定订单和报价，回跳后核验会话、单次授权、环境、订单关联、Charge 与实际 Captured 金额，再保存 `sandbox_paid`。
- `pnpm test`：146 / 146 通过，其中支付 provider/API/storage/回跳单测 54 项。覆盖跨访客隔离、并发会话竞争、幂等、金额与环境篡改、付款后读库/落库失败恢复、拒绝/取消原因和待核验状态。官方 SDK 的本地 PSS V2 签名验签通过；测试没有向 Amazon 发起付款请求。
- `scripts/amazon-pay-browser-check.mjs`：8 组检查通过，页面错误 0；使用明确的 mock provider/SDK 与临时 SQLite。覆盖未配置时体验订单、SDK 加载与错误重试、准备报价同步、待核验后重试、失败/取消、刷新恢复和缺少返回参数；390px 弹窗可滚动。截图在 `tmp/amazon-pay-ui/`，其中已支付截图属于测试替身。
- 已向 `charm-studio` Supabase 应用 `loop_amazon_pay_sandbox` 迁移。服务端仅可更新 status/payment，不可修改 quote；anon/authenticated 无表读取权限，RLS 保持开启。使用 service_role 事务验证空会话绑定、竞争会话不覆盖、付款状态保存及 paid 不降级；验证事务已回滚，没有残留测试订单。实际 Supabase 适配器健康与新增字段读取通过。
- 本地配置检查通过；Amazon Pay 仍为 `configured:false`。实际沙盒商户凭据、测试买家及 Amazon 托管结账端到端验收待完成。当前仅接网页付款，MCP 卡片仍使用原有体验下单流程。
- TypeScript、最终网页生产构建与 MCP UI 构建通过。已有 3000 端口的服务器仍提供旧接口，本任务在 `http://localhost:3075` 启动当前源码的生产预览；健康、目录、AI 状态和 Amazon Pay 沙盒状态接口检查通过。使用真实 Supabase 的未配置结账页已截图验证，没有创建订单或调用 Amazon。实际结账时 `AMAZON_PAY_BASE_URL` 必须与使用的端口/origin 一致。
- 部署分支已整合到最新 `master` 基线 `2e4aa86`，保留 `api/index.mjs`、`build:server`、Vercel 路由及共享 OAuth 实现。独立 worktree 的 frozen-lockfile 安装、146 项测试、完整构建（含 `dist-server/app.mjs`）、无网络云入口装载与离线 MCP 桌面检查全部通过。另用内存生成的测试 RSA key 验证构建后的支付 status 为 HTTP 200/Sandbox、外部 Amazon SDK 可装载，且 `dist/privacy.html` 与源码完全一致；没有访问 Amazon API，也不代表真实商户授权或支付验收通过。

官方与配置依据见 [环境变量说明](ENVIRONMENT.md#amazon-pay-沙盒演示)。下方记录均为先前版本，不代表本次支付状态。

## 当前交接版 — 全新副本部署验证

本节对应 README / SETUP / AI_HANDOFF 描述的交接流程。下方 0.2.1、0.2、0.1 均为历史记录，其中人民币报价、测试数量和「暂无 MCP」等描述不代表当前能力。

- 环境：macOS / Apple Silicon，Node 24.19.0，pnpm 11.25.0。从待提交源码和资源创建独立副本，未复制作者 `.env`、`.data`、`node_modules` 或构建产物；以 `.env.example` 创建无 Key 配置。安装复用了本机 pnpm 下载缓存，并非全空网络缓存的实体新电脑。
- `pnpm install --frozen-lockfile`：成功，建立独立依赖目录。
- `pnpm setup:check`：通过；确认 SQLite、本地素材和依赖可用、OpenAI Key 未配置。缺少 cloudflared / 构建时作为可选步骤提示。
- `pnpm test`：**54 / 54 通过**，包含本次追加的原单价 ÷ 7 取整回归，覆盖业务、接口、MCP、OAuth、本地化、几何和物理；不消耗真实模型额度。
- `pnpm build`：TypeScript 检查、网站和 MCP 卡片构建成功。仍有 3D chunk 大小及第三方注释移除警告，无构建错误。
- `pnpm start`：新生产入口成功启动独立端口；`setup:check --url` 的健康、目录、AI 状态检查通过。首页、MCP 调试页及 GLB 资源均 HTTP 200，AI 正确显示未配置。
- `pnpm mcp:smoke`：通过；官方 SDK 发现 10 个工具，真实调用目录 / 保存 / 报价 / 确认，REST 能读到同一设计，重复确认只产生一条测试订单。数据仅在内存数据库。
- `pnpm chatgpt:ui-check`：通过；Chrome + 官方 AppBridge 验证浏览器 OAuth / PKCE、CSP iframe、工具调用、锁定上下文、更新同一草稿、取消与确认、USD 报价、3D / 挂包及窄屏，无页面异常。
- `scripts/language-browser-check.mjs`：通过；中文浏览器环境默认英文、语言记忆、320 / 390 / 768 px 布局、搜索、切换语言保留配置、保存和 USD 测试结算、AI 语言偏好、MCP 调试流程、存储失败提示。AI 为确定性 stub，不算真实模型测试。
- `pnpm chatgpt:connect`：在副本 `.env` 设置独立 `CHATGPT_PORT` 和已有 cloudflared 的绝对路径，成功启动专用服务器并校验公网 OAuth discovery。由此验证 helper 确实读取 `.env`；此次未在 ChatGPT 安装这个临时测试地址。

独立副本测试服务在验收后停止。原作者的数据库、正在使用的插件连接和开发服务不作为新副本的依赖。Windows / Linux 未在实体机器重跑，真实 ChatGPT 账号的历史验收范围见 [CHATGPT.md](CHATGPT.md)。队友仍应在自己的账号、网络与数据库上按 [AI_HANDOFF.md](AI_HANDOFF.md) 验收。

## 0.2.1 — 连接与初始摆动修复

- 已复现原问题：React Strict Mode 重放初始化 effect 时施加了扭矩，而 Rapier 尚未更新 `setMass` 后的质量和惯性；缩小的点缀挂件会因此出现高速翻转。
- 改为物理步之后同步质量属性并设置有限速度，使用 ±0.18 rad 的铰链转角限制，移除与关节约束冲突的刚体轴锁。
- `pnpm test`：18 项测试全部通过；`pnpm build` 的类型检查与生产构建通过。新增测试包括小链条与承托环的连接几何、重复初始化、微小碰撞体、连续 24 次换件、空配件、全部模板和连接件在独立及三种挂包场景下的启动与重建。
- 完整组合的连续 720 步与重建后 360 步测试中，初始摆动小于 0.07 rad（约 4°）；没有完整翻转或异常高速。
- 浏览器检查主挂件与点缀链均穿过连接环，检查托特包与肩包的新 GLB、迷你包固定带与 D 环，以及金属和皮革两种连接方式。
- 浏览器实际切换三种模板、三种包型和动态开关；迷你包长串的初始位置与地面分离。材质和灯光保持上一版设置。

## 0.2 — 3D 预览

- `pnpm test`：原有 10 项业务和接口测试全部通过；`pnpm build`：TypeScript 与生产构建通过。
- 实际在浏览器中拖动模型到侧面，验证旋转、复位、缩放、自动旋转、暂停与恢复动态效果。
- 三种结构和三种包型均已显示；验证皮革托特、奶油肩包、迷你包之间切换，以及挂饰视图与挂包视图切换。
- 检查金属、皮革、水晶和珐琅部件，修正过黑的平面金属反射、过强的换件冲量及不更新的接触阴影。
- 14 张配件缩略图与 3 张结构缩略图由网页中相同的三维模型渲染导出。保存弹窗实际显示对应配置的 3D 快照。
- 保存「3D 验证 · 奶油蛋糕」，重新加载页面后从云端重开，确认主挂件仍为蛋糕、总价 ¥88。测试订单 `51240412-1033-42c2-ab2d-b1ccc8184c6b` 已收到回执；没有真实支付。
- 390 × 844 视口只读检查：页面无横向溢出，339 px 宽的三维画布完整显示托特包和挂件；测试后恢复默认视口。这是桌面浏览器的窄屏检查，尚未在实体手机上测量帧率。
- `/api/health` 返回 `status: ok`、`storage: supabase`。

3D 模块按需加载，生产 JS 压缩后约 1.14 MB（gzip）；构建仍提示其大于 500 kB。模型和材质按实际使用加载，首次加载比 2D 版更重。暂停动态且关闭自动旋转时按需绘制，不持续刷新静止场景。

碰撞使用近似形状，每条悬挂组件为一个刚体；没有逐链节模拟、软皮革形变、真实尺寸或色彩校准。WebGL 加载失败的明确回退和重试已实现，但此次没有模拟显卡上下文丢失。素材来源、Blender 源文件和重建步骤见 `ASSETS.md`。

## 0.1 — 原始功能版

### 已完成

- `pnpm test`：10 项测试全部通过，覆盖兼容性、服务端价格、访客隔离、保存与重开、解锁修改后重新锁定、并发幂等下单、跨站请求拒绝、数据库持久化与健康检查。
- `pnpm build`：TypeScript 检查和生产构建成功。
- 浏览器实际操作三种模板，验证改色、金属色、换配件、按名称搜索、锁定、保存、刷新重开、结算和订单回执。
- 390 × 844 手机视口：无横向溢出，配件网格和结算弹窗可操作，Escape 可关闭弹窗。测试后已恢复默认桌面视口。
- 独立 Supabase 项目 `charm-studio` 已接入，`/api/health` 确认云数据库可访问。
- 从网页保存「香蕉假日 · 云端样例」并提交测试订单，直接查询云端确认设计与订单各一条记录。
- 无 Cookie 的另一个访客读取设计列表为空；数据库公开角色无法读取设计与订单，服务端订单权限仅允许查询和插入。
- `.env` 已排除出 Git，文件权限为仅当前用户读写。前端构建不包含服务端密钥。

### 已知边界

价格与配件为体验样例；订单不会支付或发货。草稿归属于浏览器访客，暂不支持账号登录和跨设备恢复。2D 示意用于检查组合与配色，不保证实际材质或制造效果。暂无 MCP、实时 AI 生图和自然语言搭配。

Supabase 安全检查剩余两条「RLS Enabled No Policy」信息提示，这是本版本服务端专用表的预期设置：客户端已被撤销表权限，且没有放行策略。自动 RLS 触发器函数的公开执行权限已撤销。参见 [Supabase 检查说明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)。

依赖审计未发现生产依赖漏洞；开发依赖仍有一条 esbuild 在 Windows 开发服务器场景下的低等级公告，本次在 macOS 上运行，生产服务不使用该开发服务器。
