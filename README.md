# LOOP · Your bag charm atelier

Turn a styling idea into an editable bag charm. Describe your bag, explore a live 3D design, keep the details you love, and review an itemized quote before confirming a test order.

[Try LOOP](https://loop-charm-studio.vercel.app/?lang=en) · [Try the MCP demo](https://loop-charm-studio.vercel.app/mcp-demo.html?lang=en) · [Reviewer guide](docs/TESTING.md) · [简体中文](README.zh-CN.md)

![LOOP studio showing a leather tote, banana charm, pearl accent, and editable parts](docs/images/studio.png)

## A design you can keep changing

- **Start with a conversation.** Describe your bag, colors, occasion, and budget. AI selects compatible parts from the real catalog.
- **See the result.** Rotate, zoom, and preview your charm on three illustrative bag models.
- **Keep what works.** Lock a part, revise the rest through conversation, or choose a replacement from visual options.
- **Return to your work.** Save and reopen designs in the same guest workspace.
- **Understand the price.** The server validates each configuration and calculates the USD line items.
- **Confirm deliberately.** Review a quote before creating a test order. The website also offers a separate Amazon Pay US Sandbox checkout.

LOOP includes three design structures, 14 parts, five cord colors, gold/silver hardware, an English/Chinese website, and interactive MCP Apps cards. Product geometry and most preview assets are authored for this project.

## Built for the Alexa+ track

LOOP implements a self-hosted MCP server with **protocol 2025-11-25 over Streamable HTTP**. It exposes **10 design tools and one renderer asset tool**, backed by the same business rules as the website. ChatGPT can act as a conversational host and display an interactive design card.

The [web MCP demo](https://loop-charm-studio.vercel.app/mcp-demo.html) is also a real SDK client: initialization, tool discovery, design requests, quotes, saves, and test checkout travel through MCP. Its expandable call trace makes that integration inspectable.

This is an Alexa+ hackathon prototype demonstrated through compatible clients, with no connection to a real Alexa+ device or partner-only runtime. The competition accepts this demonstration route; see the [official FAQ](https://amazonappdev2026.devpost.com/details/faqs) and [integration guide](docs/MCP.md).

## Try it without installing

| Entry | Use |
| --- | --- |
| [Website](https://loop-charm-studio.vercel.app/) | Discover designs, use the AI stylist, or open the 3D studio |
| [MCP web client](https://loop-charm-studio.vercel.app/mcp-demo.html) | Connect, try a catalog example or AI brief, and inspect MCP calls |
| [Health check](https://loop-charm-studio.vercel.app/api/health) | Check backend and storage availability |
| [Privacy notice](https://loop-charm-studio.vercel.app/privacy.html) | Understand browser drafts, saved records, and connected services |

**MCP Server URL:** `https://loop-charm-studio.vercel.app/mcp`

For a ChatGPT account/workspace with custom MCP access, add this URL with **OAuth**, leave static client credentials blank, install the resulting connection, and authorize your own guest workspace. Follow the [ChatGPT guide](docs/CHATGPT.md). Opening `/mcp` directly without credentials returns **401**, as expected.

The website and MCP web demo work without a ChatGPT account. Hosted use requires no GitHub login, local installation, or project API key from the visitor.

## Run locally

Use **Node.js 24** (minimum 22.13) and **pnpm 11.25.0**. Models, textures, lighting, and thumbnails are included; Blender and a separate database installation are unnecessary.

```bash
git clone https://github.com/Evan0571/charm-studio.git
cd charm-studio
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
node -e "const fs=require('node:fs'); if(!fs.existsSync('.env')) fs.copyFileSync('.env.example','.env');"
pnpm setup:check
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). With no keys configured, local SQLite supports manual design, saving, pricing, test orders, and deterministic MCP catalog examples.

To enable the website's AI stylist, set `OPENAI_API_KEY` in your private `.env` and restart. The project default is `OPENAI_MODEL=gpt-4.1-mini`. The ChatGPT catalog-to-preview workflow uses the host model and does not require a project OpenAI key. See [setup](docs/SETUP.md) and [configuration](docs/ENVIRONMENT.md).

```bash
pnpm test
pnpm mcp:smoke
pnpm build
pnpm start
```

Tests use isolated data and mocked AI. Building produces the website, MCP UI, and server bundle. [Validation records](docs/VALIDATION.md) distinguish these checks from live provider and client tests.

## How it works

```text
ChatGPT + MCP Apps card / web MCP client
                 | Streamable HTTP
                 v
        MCP tools + OAuth/PKCE
                 |
Website REST API + shared studio service
                 |
    Catalog validation + server pricing
                 |
    SQLite locally / Supabase on Vercel
```

The website AI stylist calls OpenAI Responses with structured output. ChatGPT's normal design flow reads the catalog and calls preview tools using its own model. Original procedural geometry, bundled GLB models, and Three.js render the same configuration that the server quotes.

Hosted OAuth uses shared persistence, and large UI/model resources use streamed MCP responses. A separate local stdio entry supports compatible desktop hosts. [Deployment](docs/VERCEL_DEPLOY.md) · [MCP reference](docs/MCP.md) · [Local stdio](docs/DESKTOP_MCP.md)

## Prototype boundaries

All checkout paths are demonstrations: **no real charge, stock reservation, manufacturing, or shipping**. MCP test checkout and website Amazon Pay Sandbox are separate flows. Guest cookies identify a browser workspace; there is no verified customer login or automatic cross-device recovery. Budgets are interpreted by the model, while configuration validity and final prices are enforced by the server. Previews illustrate appearance and proportion rather than manufacturing fit.

## Documentation

| Read next | Purpose |
| --- | --- |
| [Reviewer testing guide](docs/TESTING.md) | A complete hosted walkthrough and local fallback |
| [Setup](docs/SETUP.md) / [Environment](docs/ENVIRONMENT.md) | Install, configure, and run |
| [ChatGPT](docs/CHATGPT.md) / [MCP](docs/MCP.md) | Connect a host and inspect the protocol |
| [Current status](docs/STATUS.md) / [Validation](docs/VALIDATION.md) | Current scope, evidence, and limitations |
| [Product brief](docs/PRD.md) / [Assets](docs/ASSETS.md) | User need, product scope, and asset provenance |
| [Devpost checklist / 提交清单](docs/DEVPOST_CHECKLIST.md) | Numbered requirements and remaining submission work |
| [Demo script / 口播与操作稿](docs/DEMO_SCRIPT.md) | Timed English narration and Chinese recording instructions |
| [Submission copy](docs/DEVPOST_SUBMISSION.md) / [Product feedback](docs/PRODUCT_FEEDBACK.md) | Draft text for the team to review and submit |
| [Documentation index](docs/README.md) | Guides and historical design notes |

## License and credits

LOOP's original code and project-authored assets are available under the [MIT License](LICENSE). Poly Haven material maps and HDRI lighting retain their CC0 provenance. Third-party packages retain their own licenses. See [third-party notices](THIRD_PARTY_NOTICES.md) and the [asset register](docs/ASSETS.md).

Built for the [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/), Alexa+ track. Amazon, Alexa+, ChatGPT, and other product names belong to their respective owners.
