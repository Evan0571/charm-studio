# LOOP Demo 口播与操作稿

主版本：**英文口播＋中文操作说明**，目标成片 **2 分 50 秒**。主线是 ChatGPT 内的 MCP Apps 卡片；后面提供实际网页 MCP 客户端的替代路线。两条路线都需要拍摄真实操作结果。

比赛要求视频少于三分钟、公开上传 YouTube/Vimeo，英文讲解或提供英文翻译。[官方要求](https://amazonappdev2026.devpost.com/)

## 1. 录制前准备

1. 将网站、卡片与浏览器语言切成 English。使用同一个浏览器 profile 完成网站访问和 hosted OAuth 授权。
2. 提前安装/连接 LOOP，加载一次模型；录屏不包含注册、登录、token、私钥或测试买家密码。
3. 打开网站首页、3D 工作室、ChatGPT 新对话和公开 GitHub。关闭无关账号标签页。
4. 先排练提示词 A/B/C，确认目标账号能渲染卡片。独立第二账号验收仍需真实完成，本文不是验收结果。
5. 使用新的演示设计。不要删除已有用户记录。录制中的保存和确认会创建真实的演示记录，但没有扣款或发货。
6. 录制建议为 1920×1080、清晰光标和可读字号；长的真实等待可以剪掉，保留请求与对应实际结果，不拼接成未发生的功能。
7. 报价读当前画面，不把 USD 12 写成固定系统保证；自然语言预算不是服务端的硬性限额。

## 2. 可直接复制的提示词

**提示词 A — 首稿：**

```text
Use LOOP to read the catalog and create a design named Cocoa Cherry.
Use the hero template, a leather connector, a cherry as the main charm,
and a pearl as the accent, for my brown tote. Use gold hardware first.
Keep it under 15 USD and show the interactive 3D preview in English.
Do not save or create an order yet.
```

**提示词 B — 锁定后修改：**

```text
Keep the cherry I locked in the card, and keep the pearl.
Change only the hardware to silver, stay under 15 USD,
and show the updated interactive preview. Keep the current locks.
```

**提示词 C — 重开保存的同一份：**

```text
Read my saved LOOP designs and reopen the design named Cocoa Cherry.
Show the saved design in an interactive preview with its existing draft ID.
Do not duplicate it or create an order.
```

hero＋leather＋cherry＋pearl 的当前目录总价为 USD 12；以实际卡片/服务端报价为准。如果模型选了不同结构，不要继续假称为该固定配置，先明确重新使用 hero 结构。

## 3. 分镜口播和操作

### 1. 00:00–00:12

**操作：** 展示网站首页与完成的 3D 挂包画面。不要停留在加载态。

**英文口播：**

> Choosing a charm should feel personal, but a grid of products cannot show how your ideas fit together. LOOP turns a styling conversation into a design you can see and change.

### 2. 00:12–00:28

**操作：** 切到已连接 LOOP 的 ChatGPT 对话。简短展开一次 catalog/preview 工具调用，随后回到卡片。屏幕角标标注 Alexa+ track · MCP 2025-11-25 · Streamable HTTP。

**英文口播：**

> For the Alexa Plus track, we built a self-hosted MCP server using the required protocol and Streamable HTTP. ChatGPT is our demonstration host, with an interactive MCP Apps card.

### 3. 00:28–00:52

**操作：** 发送提示词 A。等完整 3D 渲染，展示樱桃主挂饰、珍珠点缀与实际报价。

**英文口播：**

> I start with a brown tote, a cherry charm, a pearl, and a fifteen-dollar budget. LOOP selects compatible parts from its catalog and returns an editable preview. The server calculates each line item, so the displayed price comes from the design itself.

### 4. 00:52–01:18

**操作：** 点击樱桃位置的 Lock，发送提示词 B。展示新卡片的银色五金与仍锁定的樱桃。

**英文口播：**

> I like the cherry, so I lock it before asking for silver hardware. The next version keeps that choice and changes the finish. The conversation carries the current configuration and locks, which lets me refine the design without starting again.

### 5. 01:18–01:40

**操作：** 轻拖旋转、缩放，再点击 On a bag。可打开点缀的 Change 图片选择器查看，但关闭时保留珍珠。

**英文口播：**

> I can inspect the charm from different angles, see it on a bag, and browse visual alternatives. These are interactive models driven by the same configuration as the quote. The preview helps compare the overall look before making a choice.

### 6. 01:40–02:05

**操作：** Rename → 输入 Cocoa Cherry → Use this name → Save design。发送提示词 C 重新读取这份草稿并展示。

**英文口播：**

> Now I name the design and save it. Reopening the saved draft brings back the selected parts and locks. MCP and the website share business rules, so this is a persistent design workflow rather than a picture that disappears after one answer.

### 7. 02:05–02:31

**操作：** View test order → 展示 Price details 与确认区 → Create test order → 展示 Test order confirmed 回执。

**英文口播：**

> Before an order exists, LOOP shows the exact configuration and itemized price for review. I confirm a test order as a separate action, and receive a receipt. Confirmation is bound to that quote and guest workspace, with duplicate protection. This demonstration does not charge money or ship anything.

### 8. 02:31–02:50

**操作：** 切到工作室 3D 完整画面，收尾展示公开仓库与网站地址。可短暂显示网站沙盒入口，但不要把普通测试回执标为付款成功。

**英文口播：**

> The website also includes a separate Amazon Pay Sandbox checkout. Our goal is to make accessory customization easier to explore: describe an idea, keep what you love, and turn it into a design you can return to.

## 4. 网页 MCP 替代路线

当目标 ChatGPT 账号没有自定义 MCP 权限或无法稳定显示卡片时，可以完整改用 [真实 MCP 网页客户端](https://loop-charm-studio.vercel.app/mcp-demo.html)。这是官方允许的演示方式；不应把网页画面说成 ChatGPT 原生卡片。[FAQ](https://amazonappdev2026.devpost.com/details/faqs)

1. 在 00:12–00:28 点击 **Connect to the studio**，展开 **MCP calls and connection settings**，拍到 `initialize`、`tools/list`、`loop_get_catalog`。随后收起连接区，避免显示凭据。
2. 将该段英文替换为：

   > For the Alexa Plus track, we built a self-hosted MCP server using the required protocol and Streamable HTTP. This web client performs real initialization, tool discovery, and tool calls, which you can inspect here.

3. 在 **Describe or refine your design** 输入 A 的搭配要求，点击 **Send idea**。不要用固定示例冒充 AI 结果。
4. 勾选樱桃位置的锁定 checkbox，再输入 B。网页客户端不具备 ChatGPT 卡片的图片选择器和卡片挂包按钮；在 01:18–01:40 打开同源工作室做挂包/选件展示，并明确这是网站视图。可以先保存并从收藏打开，避免丢失当前配置。
5. 网页客户端保存按钮为 **Save design**；重开使用 **Load saved records** 后点击对应设计。该路线不提供卡片 Rename，保留模型返回的设计名，并让字幕与实际名字一致。
6. 结算按钮为 **Review quote and test order** → **Create test order**。完成后 **Load saved records** 展示订单记录。
7. 对网页路线，保存段口播的 “Now I name the design and save it” 改为 “Now I save this design and reopen it from my saved records.” 其余口播按画面对应调整。

## 5. 可选 Amazon Pay Sandbox 镜头

只有团队已重新完成 Sandbox 买家实测且拿到可展示的回执时，才加入完整付款镜头。把它作为网站独立流程，替换中段一部分旋转/重开镜头；不要把三分钟成片继续加长。

操作：网站 **Review design** → **Continue with Amazon Pay sandbox** → 官方付款按钮 → 私下完成测试买家登录 → 拍摄返回 LOOP 后的 **Sandbox payment verified**。不要录制买家密码或付款表单敏感字段。

可替换约 10–12 秒的口播：

> On the website, this separate Amazon Pay Sandbox checkout verifies the captured test transaction against the order and amount before showing success. No real payment is collected.

仅拍到按钮时，只说“网站提供 Sandbox 入口”；普通 **Test order confirmed** 不能标注为 Amazon Pay 已支付。当前脚本主线的 MCP 卡片不发起 Amazon Pay。

## 6. 交片检查

1. 视频总长控制在 2:45–2:55，最终必须少于 3:00；实读时长和剪辑时间优先于脚本估算。
2. 英文口播/字幕清楚，价格、设计名称、按钮与画面一致；没有凭据和无权使用的音乐/素材。
3. 最少拍到一个真实 MCP 调用、锁定前后、完整 3D、保存/重开、报价和明确确认。
4. 说明 ChatGPT/网页是本次演示宿主；不声称接入真实 Alexa+、正式零售或真实制造。
5. 公开上传 YouTube/Vimeo，用未登录窗口检查播放，把最终 URL 填入 Devpost。

[纯英文提词器文本](DEMO_NARRATION_EN.txt) 与本文件主版本一致。它不包含操作说明或可选替换段；采用网页替代路线时需要使用上面的对应替换句。
