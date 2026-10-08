# LOOP · 包挂定制工作室

一个可运行的包挂定制原型：选择结构、组合配件、实时预览、保存设计、提交测试订单。

目前支持绳结串珠、金属垂链、主题挂坠三种结构，14 款预置配件与 5 种绳带颜色。主预览使用 Three.js 实时 3D 渲染，可旋转、缩放、更换配件，并比较不同包型上的搭配。材质与模型预先制作，换件时不调用生图服务。

> 所有订单均为测试订单，不会扣款或发货。当前不包含 MCP、Alexa+、AI 聊天或真实支付接入。

## 本地运行

需要 Node.js 22.13 或以上版本（建议 Node.js 24）以及 pnpm。

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000 。Express 同时提供业务 API 和 Vite 页面。

```bash
pnpm test       # 业务规则和接口测试
pnpm build     # TypeScript 检查与生产构建
pnpm start     # 运行已构建的网站
```

默认使用本地 SQLite，数据文件位于 `.data/`，不上传 GitHub。关闭并重新启动服务仍保留设计与订单。浏览器通过 HttpOnly Cookie 识别访客；使用同一主机名访问，`localhost` 与 `127.0.0.1` 的 Cookie 不互通。清除 Cookie 或换设备后不会自动恢复旧访客的数据。

## Supabase 云端存储

1. 创建独立的 Supabase 项目，在 SQL Editor 中执行 `supabase/schema.sql`。
2. 复制 `.env.example` 为 `.env`，设置服务端环境变量：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-secret-key
PORT=3000
```

3. 重启服务。`GET /api/health` 检查设计表与订单表的连通性并返回当前存储模式；连接失败返回 HTTP 503。

云端保存使用服务端 Secret Key（或兼容的 service_role key）。不要使用 publishable/anon key 代替，不要给变量增加 `VITE_` 前缀，不要把 `.env` 放入版本控制。表已启用 RLS，禁止浏览器直接访问；所有访问经过后端按访客归属过滤。云端故障不会自动切换 SQLite。

本地和云端是独立数据源，切换模式不会自动搬迁已经保存的草稿。该原型未提供注册、跨设备账号同步或生产运营管理；正式对外发布前需补充账号体系、流量限制、备份和真实商品履约规则。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `src/` | React 工作室、配置界面与 3D 预览 |
| `src/three/` | 可组合挂件模型、材质与包模型加载 |
| `public/assets/` | GLB 包模型、皮革贴图、HDRI 与 3D 渲染缩略图 |
| `assets-source/`、`scripts/build-bags.py` | Blender 源文件与可重建脚本 |
| `shared/` | 类型、模板目录、验证与计价规则 |
| `server/` | Express API、访客隔离和数据库适配 |
| `tests/` | 业务和接口测试 |
| `supabase/schema.sql` | 云端表结构与访问权限 |
| `docs/PRD.md` | 产品范围、流程与验收要求 |
| `DESIGN.md` | 用户指定的 Airbnb 设计参考 |

## 设计与素材说明

视觉参考来自 [getdesign.md 的 Airbnb 分析](https://getdesign.md/airbnb/design-md)：白色画布、珊瑚红主色、圆角与充足留白。LOOP 使用自己的名称和图形，不使用 Airbnb 标识或专有字体。

两款主要包模型由 Blender 为本项目制作；迷你包和配件使用可组合的三维网格。皮革扫描纹理和棚拍 HDRI 来自 Poly Haven 的 CC0 素材，来源、许可与重建说明见 `docs/ASSETS.md`。目录缩略图来自同一套三维模型，可在本地 `/asset-studio` 页面重新渲染并导出。

Rapier 为整条悬挂组件提供刚体摆动、球铰约束和简化碰撞；小链节是外观几何，未逐节模拟，包体也未做软体形变。原型包并非真实品牌商品的扫描件，尺寸与颜色尚未经过实物校准。浏览器需支持 WebGL；加载失败时会明确标注 2D 结构示意并提供重试。历史设计尚无本地 3D 快照时仍显示标注过的方案示意图。

## 协作

仓库：[Evan0571/charm-studio](https://github.com/Evan0571/charm-studio)。建议以功能分支提交修改，并在合并前运行 `pnpm test` 和 `pnpm build`。下阶段在现有设计、计价与订单接口之上接入 MCP，保持同一套业务校验。
