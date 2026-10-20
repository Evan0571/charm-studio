# Devpost 提交清单

核对日期：**2026-10-20**。主赛道：**Alexa+ / self-hosted MCP**。当前 [LOOP 项目](https://devpost.com/software/loop-bievcp) 为 **Draft，3/5 步完成，尚未提交**。遵照项目所有者要求，视频栏保留空白，最终条款和 Submit project 未执行。

截止：**2026-10-23 12:00 PDT = 芝加哥 10 月 23 日 14:00 CDT = 北京 10 月 24 日 03:00**。[官方规则](https://amazonappdev2026.devpost.com/rules) · [FAQ](https://amazonappdev2026.devpost.com/details/faqs)

## 已填写并核对

| 比赛项目 | 草稿状态与证据 |
| --- | --- |
| 项目与团队 | LOOP；Zihan TANG (`ztang325`) 与逸凡宋 (`syf1248226176`)；在已有团队草稿中编辑，未另建项目或发送邀请 |
| 资格与居住地 | 所有者确认：全体居住美国、加拿大省份 N/A；三项年龄/地区/关联员工声明属实，表单已勾选 |
| 主赛道 | Alexa+；自托管 MCP 2025-11-25 / Streamable HTTP，10 个设计工具＋1 个素材工具；网页客户端是实际 MCP 客户端 |
| 英文项目故事 | 介绍、实现、挑战、收获、后续与开发时间已保存；所有者确认比赛期间从零开发，仓库记录始于 10 月 8 日 |
| GitHub | 公开 MIT 仓库，含源码、资源、安装与测试说明；公开仓库无需邀请私有仓库评审 |
| 技术与能力边界 | 清楚说明沙盒、访客工作区、无真实扣款/发货、未连接真实 Alexa+ 或受限 SDK；未声称商业指标或第二账号已通过 |
| Try it out | 精简为英文网站与 GitHub 源码两个链接；Devpost 会把同域名的不同路径显示成相同名称，故演示与指南放在评审说明中 |
| 评审入口 | 无需 ChatGPT 账号、安装或自带 API Key 的真实 MCP 网页客户端；英文测试说明含 fallback、保存、报价与可选确认；显式 `?lang=en` 避免旧中文偏好影响评审 |
| 产品反馈 | 五个必答维度，覆盖 MCP、MCP Apps、OpenAI、Amazon Pay Sandbox、Vercel、存储、3D/物理与 TypeScript/Node/Express/Zod；复用意愿、学习 Significant 与职业 AI 价值 Yes 经所有者确认 |
| 可选材料 | Friction log 与带优先级的 feature requests 已保存；Google 文档为“知道链接的任何人可查看” |
| 附加挑战 | AWS Builder 与 Open Source 均选 No；不虚构 AWS/Kiro 使用或额外贡献。若团队决定加报，另行核对并填写对应贡献材料 |
| 图片 | 两张真实工作室/对话卡片截图及英文说明，价格取自真实画面 |

## 提交前仍必须完成

- [ ] **演示视频公开托管并填入表单。** 已有 [2 分 31 秒英文讲解实录](review/README.md)，但现有网站播放器/MP4 链接不满足比赛指定的公开 YouTube/Vimeo 托管要求。核对最终画面、英文说明、素材权利后上传，并在未登录状态确认可播放；本次按要求未填写视频栏。
- [ ] **所有者最终审阅并正式提交。** 完成视频后再核对预览、成员、赛道和附件；接受最终条款并提交，保存回执。目前保存草稿不等于参赛提交。

## 建议完成的验收，不能写成已通过

- [ ] 第二个真实 ChatGPT 账号独立完成 OAuth、3D 卡片、保存/重开和明确确认。作者账号、Platform 发布者连接、SDK 与自动测试不能替代该结果。
- [ ] 目标宿主实际 CSP、实体手机和低端 GPU 性能验收。已有桌面画面/窄屏检查不等于实体设备验收。

以上是当前原型的验收边界；比赛接受真实 MCP 网页客户端演示，不要求公开 ChatGPT 插件获批、真实 Alexa+ 硬件或伙伴 SDK。[官方 FAQ](https://amazonappdev2026.devpost.com/details/faqs)

## 代码、部署和打包核对

`pnpm test`、`pnpm build`、Vercel 产物导入、MCP 流式资源与桌面传输检查记录在 [VALIDATION.md](VALIDATION.md)。英文入口同时核对默认英文、已有中文偏好时显式英文覆盖、手动切换及刷新。

本地目录插件包版本 **0.2.4**；MCP 服务仍有独立版本 **0.2.1**，两者无需相等。插件 ZIP 仅包含远程连接配置和审核元数据，应用代码由部署提供；源码 ZIP 应从最终 Git commit 导出。打包命令见 [PUBLIC_PLUGIN_SUBMISSION.md](PUBLIC_PLUGIN_SUBMISSION.md)。本次不进行 OpenAI 目录审核或 Devpost 最终提交。
