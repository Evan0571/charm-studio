# Devpost 提交清单

核对日期：2026-10-18。主赛道：**Alexa+ / self-hosted MCP**。本文件用于团队分工；正式对外项目介绍使用 [英文草稿](DEVPOST_SUBMISSION.md)，评审操作使用 [English testing guide](TESTING.md)。

截止：**2026-10-23 12:00 PDT = 芝加哥 10 月 23 日 14:00 CDT = 北京 10 月 24 日 03:00**。[比赛首页](https://amazonappdev2026.devpost.com/)

## 1. 注册并建立 Devpost 项目

**要求：** 在比赛页面加入活动，创建参赛项目；团队指定一名符合资格的代表提交，填写真实成员。[官方规则](https://amazonappdev2026.devpost.com/rules)

**当前：** 团队尚未建立项目草稿。

**待办：** 登录 [My projects / submission 页面](https://devpost.com/submit-to/30992-build-ship-shape-amazon-developer-hackathon/manage/submissions)，创建 LOOP 项目，添加成员、确定代表。完成后保留项目链接和最终提交凭证。

## 2. 选择 Alexa+ 主赛道并说明技术路径

**要求：** 自托管 MCP 路径采用 2025-11-25 或以上协议和 Streamable HTTP。允许真实网页 MCP 客户端演示；不需要真实 Alexa+ 设备或合作伙伴工具。[FAQ](https://amazonappdev2026.devpost.com/details/faqs)、[Resources](https://amazonappdev2026.devpost.com/resources)

**当前：** 已实测 2025-11-25 / Streamable HTTP，10 个设计工具＋1 个素材工具。

**待办：** 选择 Alexa+，Built With 填入实际技术；正文与视频清楚点出 self-hosted MCP、MCP Apps 和宿主客户端。ChatGPT 是演示宿主，不要描述为已接入真实 Alexa+。

## 3. 填写英文项目简介与项目故事

**要求：** 说明做什么、如何工作；提交材料使用英文或附英文翻译。若项目早于比赛开始存在，说明比赛期间的重要更新。[官方规则](https://amazonappdev2026.devpost.com/rules)

**当前：** [英文项目故事草稿](DEVPOST_SUBMISSION.md) 已提供，待团队审核。仓库最早提交在 2026-10-08；这不能单独证明代码此前不存在。

**待办：** 填写名称、tagline、用户问题、功能、实现、挑战和后续方向；确认开发时间说明真实。不要添加未经测量的用户数量、转化率、节省时间或收入。

## 4. 提供可访问的 GitHub 源码

**要求：** GitHub 包含运行所需源码、资源和说明；公开方案需要可识别的开源许可证。[比赛首页](https://amazonappdev2026.devpost.com/)

**当前交付：** 仓库采用 MIT；英文 README、运行配置、资源来源和评审说明已整理。发布检查需要确认 GitHub 为 Public 且 About 显示 MIT。

**待办：** 在未登录窗口打开 [仓库](https://github.com/Evan0571/charm-studio)，确认可读、许可证可见、README 截图正常。公开方案无需再邀请六位私有仓库评审。若日后改回私有，则必须重新按官方名单授予权限。

## 5. 填写体验链接与英文测试说明

**要求：** 让评审能够免费评估项目；英文测试步骤要可执行。Alexa+ 不强制永久在线托管，本地可运行源码与视频也可用于评审。[FAQ](https://amazonappdev2026.devpost.com/details/faqs)

**当前：** 线上网站、真实 MCP 网页客户端、OAuth 端点和英文指南已具备。

**待办：** 填入下面的链接，并附 [TESTING.md](TESTING.md)。先用无需 ChatGPT 账号的网页入口；ChatGPT 卡片作为额外路线。仓库与视频应持续可访问至评审期结束（2026-11-20）。

| 填写位置 | 地址 |
| --- | --- |
| Source code | https://github.com/Evan0571/charm-studio |
| Website | https://loop-charm-studio.vercel.app/ |
| Actual MCP demo | https://loop-charm-studio.vercel.app/mcp-demo.html |
| MCP Server URL | `https://loop-charm-studio.vercel.app/mcp` |
| English testing instructions | https://github.com/Evan0571/charm-studio/blob/master/docs/TESTING.md |

## 6. 录制并公开上传演示视频

**要求：** 少于 3 分钟，在 YouTube/Vimeo 公开可见；展示实际运行，有英文讲解或翻译，并拥有所用素材的使用权。[比赛首页](https://amazonappdev2026.devpost.com/)

**当前：** [口播与操作稿](DEMO_SCRIPT.md) 已准备；视频尚未录制、上传。

**待办：** 按约 2 分 50 秒的脚本录制并剪辑，保留真实操作结果；字幕与最终画面一致。上传后在未登录窗口检查可播放，再把链接填入 Devpost。不要把文档链接当作已完成视频。

## 7. 完成必填 Product Feedback

**要求：** 对使用的开发工具、API、SDK，写用途、优点、问题、上手体验、是否愿意再用及原因。[官方提交提示](https://amazonappdev2026.devpost.com/updates/46538-strong-submission-tips)

**当前：** [英文工具反馈草稿](PRODUCT_FEEDBACK.md) 已整理，包含 MCP/MCP Apps、OpenAI、Amazon Pay、Vercel、Supabase 与 3D 工具。

**待办：** 每位实际开发者核对主观评价、补充自己用到的工具并确认“是否再用”。删除草稿标记后填入表单；未使用的 Amazon 合作伙伴 SDK 不要写成亲测反馈。

## 8. 提交可选 friction log 和 feature requests

**要求：** 可选问题记录说明任务、复现步骤、预期/实际、严重度、解决方法和可执行建议；官方允许最高 10% 加分，并非保证加分。[比赛首页](https://amazonappdev2026.devpost.com/)

**当前：** 反馈草稿整理了实际记录：Amazon Pay 返回字段兼容、Vercel 大资源响应、卡片 CSP/stdio 消息体限制。

**待办：** 核实每条证据与描述，把适用条目填入 friction log；不要把“未获合作伙伴权限”编成测试过受限 SDK。Feature request 用 Critical / Important / Nice-to-have 标明优先级。

## 9. 核实是否参加附加赛道

**要求：** AWS Builder 需要真实 AWS 服务集成或比赛期间使用 Kiro Crew 的说明；Open Source 需要额外开源项目或公开贡献及相应链接/解释。[官方规则](https://amazonappdev2026.devpost.com/rules)

**当前：** 主项目公开与 Amazon Pay 接入，不能自动证明已满足上述两项。

**待办：** 暂只选择 Alexa+。若团队确有其他符合条件的工作，再补证据与表单；不要为了勾选奖项而虚构 AWS/Kiro 使用或把主仓库公开当作额外贡献。

## 10. 准备项目图片并核对展示文案

**团队建议：** 用实际工作室和对话卡片截图，让封面与视频一致。现有 [工作室截图](images/studio.png) 可作为素材。图片数量、尺寸和字段以实际 Devpost 表单为准，本清单没有把未核实的 UI 字段当成比赛硬性要求。

**待办：** 检查英文可读、模型已加载，价格取自画面真实结果。不要显示 API Key、授权 token、测试买家密码、私密邮件或其他无关账号内容。

## 11. 完成一次陌生用户验收

**团队建议：** 由队友用新浏览器按 [TESTING.md](TESTING.md) 完成生成、锁定修改、3D、保存重开、报价、取消与确认。如果视频主线是 ChatGPT，再用第二个真实账号验证 OAuth、卡片和保存/确认。

**当前：** 173 项自动测试、线上协议、真实 AI 修改和网页 3D 已通过；第二真实 ChatGPT 账号的完整验收仍待完成。

**待办：** 记录通过/失败，不把 mock 或作者账号结果当作第二账号结果。测试订单无扣款和发货；Amazon Pay Sandbox 用独立测试买家，MCP 卡片不发起该支付流程。

## 12. 正式提交并核对回执

**要求：** 截止前完成所有必填项并正式提交；保存草稿不等于提交。[官方规则](https://amazonappdev2026.devpost.com/rules)

**待办：** 检查项目页、所有链接、公开视频、赛道、成员和反馈，执行表单中的最终提交动作，保存确认页面。建议 10 月 22 日完成首版提交，把 23 日留给修正；规则限制截止后的材料修改。

## 团队完成标记

- [ ] 1 注册、成员与项目草稿
- [ ] 2 赛道与 Built With
- [ ] 3 审核英文项目故事与开发时间
- [ ] 4 未登录确认公开仓库与 MIT
- [ ] 5 填写体验/代码/测试链接
- [ ] 6 录制、剪辑并公开上传视频
- [ ] 7 开发者审核 Product Feedback
- [ ] 8 审核可选问题日志与功能建议
- [ ] 9 仅选择有证据支持的附加赛道
- [ ] 10 截图与展示文案
- [ ] 11 第二用户/目标宿主验收
- [ ] 12 正式提交并保存回执
