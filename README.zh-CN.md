# LOOP · 包挂定制工作室

用一句搭配想法开始，生成可继续修改的包挂设计：查看 3D、锁定喜欢的配件、继续对话调整、保存草稿，并在核对美元明细后确认测试订单。

[在线体验](https://loop-charm-studio.vercel.app/) · [真实 MCP 网页演示](https://loop-charm-studio.vercel.app/mcp-demo.html) · [English](README.md)

![LOOP 3D 工作室与挂包预览](docs/images/studio.png)

## 当前能力

- 三种结构、14 款配件、五种绳色、金/银五金与三种示意包型。
- 英文/中文网站，AI 对话、手动搭配、实时 3D、挂包预览、保存与重开。
- 服务端校验配置和计算 USD 报价；访客数据隔离、测试订单确认与幂等处理。
- MCP 2025-11-25 / Streamable HTTP：10 个设计工具，加 1 个卡片素材工具。
- ChatGPT 内 MCP Apps 卡片：图片选件、锁定、继续修改、保存与测试结算。
- Vercel 固定域名部署、Supabase 共享业务与 OAuth 存储、大资源流式传输。
- 网站独立提供 Amazon Pay 美国区 Sandbox，已完成真实沙盒交易验收；MCP 卡片保持独立测试订单流程。

所有订单均为演示，不真实扣款、生产或发货。3D 不代表精确制造尺寸；浏览器访客不是跨设备登录账号。

## 直接试用

网站无需注册，MCP 网页演示点击 **Connect to the studio** 后可以选择 **Try a catalog example**。展开 **MCP calls and connection settings** 查看实际协议调用。

ChatGPT 自定义 MCP 地址：`https://loop-charm-studio.vercel.app/mcp`。选择 OAuth，静态 Client ID/Secret 留空，完成自己的授权。需要目标账号允许自定义 MCP；[接入说明](docs/CHATGPT.md)。匿名直接打开 `/mcp` 返回 401 属于正常认证行为。

## 本地运行

Node.js 24（最低 22.13），pnpm 11.25.0。无需 Blender、Docker 或单独安装数据库。

```bash
git clone https://github.com/Evan0571/charm-studio.git
cd charm-studio
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
node -e "const fs=require('node:fs'); if(!fs.existsSync('.env')) fs.copyFileSync('.env.example','.env');"
pnpm setup:check
pnpm dev
```

访问 `http://localhost:3000`。无密钥时默认本地 SQLite，手动设计、保存、报价、测试订单和 MCP 固定示例可用。网页 AI 需要自己的 `OPENAI_API_KEY`；默认模型 `gpt-4.1-mini`。ChatGPT 读取目录再生成预览的路径使用宿主模型，无需项目 API Key。

```bash
pnpm test
pnpm mcp:smoke
pnpm build
pnpm start
```

保持同一浏览器和 hostname；`localhost` 与 `127.0.0.1` 是不同访客。`.env`、`.data` 和云端凭据不随 Git 分享。

## 团队提交材料

1. [Devpost 编号清单](docs/DEVPOST_CHECKLIST.md)：逐项说明要求、现状和待办。
2. [Demo 口播与操作稿](docs/DEMO_SCRIPT.md)：英文口播、中文操作、时间安排与备用路线。
3. [英文项目介绍草稿](docs/DEVPOST_SUBMISSION.md)：可供填写 Devpost 后审核。
4. [产品反馈草稿](docs/PRODUCT_FEEDBACK.md)：包含工具反馈、真实问题记录和待团队确认的主观回答。

英文 [README](README.md)、[评审测试指南](docs/TESTING.md)、[安装](docs/SETUP.md)、[配置](docs/ENVIRONMENT.md)、[状态](docs/STATUS.md) 和 [验收](docs/VALIDATION.md) 为当前对外文档。历史设计计划单独标注，不代表当前功能。

## 开源与素材

原创代码和自建素材使用 [MIT](LICENSE)，第三方材质与灯光保留 Poly Haven CC0 许可。详见 [素材来源](docs/ASSETS.md) 与 [第三方声明](THIRD_PARTY_NOTICES.md)。主仓库公开不自动满足比赛 Open Source 附加赛道的额外贡献要求。
