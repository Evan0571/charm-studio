# LOOP MCP integration and hackathon demo

LOOP turns a bag-charm brief into a catalog-valid design, supports conversational revisions with locked parts, saves an editable 3D draft, and completes an explicitly confirmed test checkout. ChatGPT is the primary conversational host, with an inline MCP Apps preview. See [ChatGPT setup](CHATGPT.md). The standalone web simulator remains an actual MCP debugging client.

## Use the hosted service and share it

The shared server URL is **https://loop-charm-studio.vercel.app/mcp**, and the website is **https://loop-charm-studio.vercel.app/**. Trying this hosted service does not require GitHub access, Node.js, a local installation, or a tunnel. Each user adds the server in a ChatGPT account/workspace that allows custom MCP connections, selects **OAuth**, leaves the OAuth client ID and secret empty, and completes their own visitor consent. See the [hosted connection steps](CHATGPT.md#hosted-connection).

OAuth binds the connection to the authorizing browser's guest workspace on that domain. It does not create a verified ChatGPT-linked or cross-device customer account. Distinct browser guests have isolated designs and orders; multiple clients authorized by the same browser guest access that same workspace. Share the endpoint and instructions, rather than cookies, bearer credentials, or server secrets.

MCP checkout tools only create ordinary test orders. Amazon Pay sandbox payment is a separate website checkout using a sandbox test buyer; it causes no real charge or shipping. The connected guest's website sandbox order statuses can be read through `loop_list_orders`, but the MCP card does not initiate Amazon Pay checkout.

Sharing a reachable MCP endpoint is separate from a public directory listing. Directory distribution requires OpenAI review and publication after approval; this guide does not claim LOOP is listed. See the [official submission and publication process](https://developers.openai.com/plugins/deploy/submission). The local stdio deployment is a separate desktop option, not the hosted server's installation link.

## Competition path

Reviewed on October 18, 2026 against the [official rules](https://amazonappdev2026.devpost.com/rules), [FAQ](https://amazonappdev2026.devpost.com/details/faqs), and [resources](https://amazonappdev2026.devpost.com/resources):

- Alexa+ accepts a self-hosted MCP server using version 2025-11-25 or later over Streamable HTTP. LOOP implements 2025-11-25.
- Participants cannot obtain the partner-only Alexa+ SDK, MCP Toolkit, CLI, or Web Simulator, or connect their server to a real Alexa+ device/developer console.
- A custom web page performing real MCP initialization, tool discovery, and tool calls is an accepted demonstration. Hardware and public hosting are not required.
- Submission still needs a usable GitHub repository, a public demo video under three minutes, English materials or translations, and product feedback. This repository is published under MIT; a private-repository alternative would require reviewer access.

LOOP uses a self-hosted MCP server with ChatGPT as an AI host for the simulated experience. The official FAQ also accepts a custom real-MCP web client, which remains available for debugging. It makes no claim to use Alexa's voice runtime, account linking, native UI cards, or payments. AWS infrastructure is optional and is not part of this implementation.

## Run locally

Prerequisites: Node.js 22.13+ (24 recommended), pnpm at the version pinned in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm build:mcp-ui
pnpm dev
```

Open **http://localhost:3000/mcp-demo.html**. The regular studio is at **http://localhost:3000/#/studio**; `/` is the landing page. The server binds to `127.0.0.1` by default. If an older process is already running, restart it after installing the new dependencies; refreshing a tab does not reload an unwatched Node server.

SQLite is used when no cloud-storage configuration is supplied. Local data and the MCP signing key live in the ignored `.data/` directory. Existing cloud storage can also be used through the unchanged storage interface. Do not overwrite an existing `.env` when adding configuration.

For natural-language design, set `OPENAI_API_KEY` in `.env` and restart. The existing `OPENAI_MODEL` setting still applies. The key is used only by the server's existing stylist. The MCP SDK itself does not need an API key or Alexa account.

Without a model key, use **先试试目录示例** (“Try a catalog example”). This is explicitly a deterministic example, not an AI response. Saving, quoting, checkout, and retrieval still work. An external agent can also construct designs from `loop_get_catalog` without invoking LOOP's AI stylist.

Production build:

```bash
pnpm build
pnpm start
```

## Walk through the demo

1. Click **连接工作室** (“Connect studio”). The browser obtains a guest-scoped credential, then performs MCP `initialize`, `notifications/initialized`, `tools/list`, and `loop_get_catalog` calls.
2. Enter a brief, for example: “Design a vintage charm for my brown bag, under 15 USD.” Click **发送想法** (“Send idea”). The stylist is reached through `tools/call`, and the returned design drives the live 3D preview.
3. Check a part to lock it, then ask for a revision. The current configuration and locks travel through MCP to the same server-side stylist validation used by the main app.
4. Click **保存设计** (“Save design”). Open **我的收藏** (“Saved designs”) in the studio to continue editing the persisted configuration. Use the same hostname throughout: `localhost` and `127.0.0.1` have different cookies.
5. Click **查看报价，测试下单** (“Review quote”). This prepares an exact configuration and itemized price; no order exists yet. Review the summary, then click **确认创建测试订单** (“Confirm test order”). Canceling creates no order.
6. Click **读取已保存记录** (“Read saved records”) to retrieve designs and orders through MCP. Expand **MCP 调用记录与连接设置** to show the real calls, success/failure states, and timings.

All orders are test orders. No money is charged, stock reserved, goods manufactured, or shipment initiated. Tokens and API keys should remain hidden during recording.

## Runtime architecture

```text
ChatGPT + inline MCP Apps card / browser MCP debug client
             |
             | Streamable HTTP: initialize, tools/list, tools/call
             v
          POST /mcp
             |
       host + origin + bearer checks
             |
     official SDK McpServer tools
             |
     shared studio service + catalog/domain rules
             |
     existing storage adapter / existing AI stylist

Regular studio REST API ---> same studio service and storage
```

`POST /api/mcp/token` only exchanges the browser's HttpOnly guest cookie for a 24-hour MCP credential. Business operations in the demo use `src/mcp/client.ts`, which imports the official SDK `Client` and `StreamableHTTPClientTransport`. The browser does not call `/api/ai/design`, `/api/designs`, `/api/quote`, or `/api/orders` for its workflow.

`server/mcp/http.ts` creates one SDK server/transport per request with stateless Streamable HTTP. Local HTTP uses JSON responses by default; Vercel uses POST-scoped SSE streaming so the inline widget and large models do not exceed the buffered function-response limit. Set `MCP_HTTP_STREAMING=true` to exercise streaming locally. Business state is persisted independently of transport sessions. Authorized GET and DELETE on `/mcp` return 405 because there is no standalone SSE stream or transport session to delete. The SDK handles JSON-RPC validation, version negotiation, tool discovery, and schema validation. See the [Vercel deployment guide](VERCEL_DEPLOY.md), [official SDK server guide](https://ts.sdk.modelcontextprotocol.io/server) and [2025-11-25 transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Tools, resource, and prompt

| Tool | Inputs | Effect |
| --- | --- | --- |
| `loop_get_catalog` | none | Templates, slots, compatibility, materials, prices, colors, valid starter configurations |
| `loop_suggest_design` | `messages`, optional `currentConfig` | AI proposal and authoritative quote; no save/order |
| `loop_preview_design` | `name`, `config`, optional owned `designId` | Render the in-conversation card with preview, quote and actions; no save/order |
| `loop_quote_design` | `config` | Validate and calculate itemized USD price |
| `loop_save_design` | `name`, `config`, optional owned `id` | Create/update a draft visible in the studio |
| `loop_list_designs` | optional `offset`, `limit` | Page through this guest's drafts |
| `loop_get_design` | owned `id` | Load a draft and calculate its current quote |
| `loop_prepare_test_order` | `designName`, `config` | Prepare exact checkout summary and a 10-minute confirmation token; no database write |
| `loop_confirm_test_order` | `confirmationToken`, `confirmed: true` | Create one test order; the same token is idempotent |
| `loop_list_orders` | optional `offset`, `limit` | Retrieve this guest's test orders and stored prices |

The server also provides the MCP Apps UI resource `ui://loop/design-v5.html` (with v1–v4 URI aliases), the JSON resource `loop://catalog` and the prompt `design-bag-charm` with an `idea` argument. A renderer-only `loop_get_preview_asset` tool reads a fixed whitelist of public product assets; binary data stays in `_meta`, outside model-visible content. Splitting assets keeps the initial UI and individual messages below the default 10 MiB stdio limit. Tool schemas reject unknown top-level fields; successful results include text and structured content. Business failures use MCP `isError` results; protocol/authentication failures use protocol errors or HTTP status codes.

Names must be 1–50 characters. List tools default to 20 records and allow up to 50 per call. Use `offset` to retrieve more. AI conversations accept up to 20 messages and 20,000 characters total; the demo retains a bounded recent conversation. Chat transcripts are in-memory only. Saved designs and confirmed orders survive reloads through existing storage.

## Identity and confirmation

The credential is HMAC-signed, audience-bound to the MCP endpoint, and scoped to the current guest. A caller cannot supply an arbitrary owner ID. Origin and Host checks run before token issuance and MCP processing. Cookies alone do not authenticate `/mcp`. The web client keeps credentials in memory, never in localStorage, URLs, or call traces.

ChatGPT uses OAuth with explicit visitor consent, PKCE, dynamic client registration, refresh-token rotation and grant revocation; see [ChatGPT setup and identity limits](CHATGPT.md). The standalone debugging client also supports a manual 24-hour Bearer credential. A compatible SDK client can connect with:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'my-loop-client', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
}));
const tools = await client.listTools();
const catalog = await client.callTool({ name: 'loop_get_catalog', arguments: {} });
await client.close();
```

Credentials expire in 24 hours. Reconnecting issues another credential; it does not revoke earlier credentials. To invalidate all credentials, rotate the server's signing key and restart. This paragraph applies only to the legacy debug credentials; OAuth grants can be revoked. Neither route provides a verified-user cross-device account system. Treat this as visitor/hackathon access.

Checkout confirmation tokens contain the exact design, quote, owner, endpoint, expiration and idempotency key under a signature. Confirm cannot replace the configuration or price. A different guest, expired/edited token, or changed catalog price is rejected. Any design edit in the demo clears the pending confirmation. Repeated confirmation with the same valid token returns the existing order.

The web UI waits for a real button click; external agents must follow the tool instruction to ask for explicit user consent. A `confirmed: true` argument alone cannot prove human consent outside a trusted client. This is appropriate for the test-only flow; real commerce would require a trusted payment/authorization system.

## Optional hosting

The existing public service is hosted on Vercel. To deploy another fixed-domain instance, follow [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md); OAuth state is shared through Supabase and large MCP responses use streaming. Hosting is not required by the competition, but ChatGPT needs a reachable MCP endpoint. The temporary HTTPS route for local development is `pnpm chatgpt:connect`; see [setup](CHATGPT.md). For standalone single-process hosting, use HTTPS and retain both business storage and OAuth state:

```dotenv
HOST=0.0.0.0
COOKIE_SECURE=true
MCP_PUBLIC_URL=https://your-domain.example/mcp
MCP_TOKEN_SECRET=replace-with-a-random-secret-of-at-least-32-characters
```

The URL must end in `/mcp` with no credentials, query or fragment. Forward the configured public Host through the proxy. Arbitrary origins are not allowed; the demo uses the same origin as the server. The local key at `.data/mcp-token-secret` is created with mode 0600 and is not committed. No environment credentials are printed in diagnostics.

AI requests share the original per-guest limit (6/minute) and process-wide concurrency limit (4) across REST and MCP. Host/Origin checks, payload limits and signed guest identity are included. OAuth and grant revocation work with local SQLite or shared Supabase storage; Vercel requires the latter. Verified-user accounts, deployment-wide rate limiting and real commerce remain future work.

## Validation and submission preparation

```bash
pnpm test
pnpm mcp:smoke
pnpm build
node --import tsx scripts/mcp-streaming-check.mjs
```

The MCP tests connect a real official-SDK client to an actual HTTP server. They cover version 2025-11-25, tools/resources/prompts, browser/MCP data sharing, guest isolation, invalid configurations, explicit checkout, concurrent retry deduplication, forged/expired credentials, request protections, and the shared AI limiter. The model JSON schema also enforces at least one charm and the hero template's required main charm; regression tests cover valid alternative placements and reject bead-only drafts. AI provider calls are mocked in automated tests. `mcp:smoke` uses a temporary in-memory SQLite database and no model API, and prints the actual successful tool calls.

Styling and natural-language budget interpretation remain model-driven. Catalog validity, locked-part protection, and checkout prices are validated by the server; a user-stated budget is not a hard spending limit. Always review the authoritative itemized quote before confirming a test order.

Suggested recording sequence: connect and show the MCP trace; describe a concrete styling need; lock and revise a part; save and open the same design in 3D; review the exact quote; confirm a test order and retrieve it. Narrate in English or provide English translation. Explain the added workflow and state persistence, rather than claiming the model alone is the product.

The public repository includes an MIT license, English setup/testing guides and submission drafts. The team still needs to rehearse and record the public video, review its project description and product feedback, complete independent host acceptance and formally submit through Devpost. Follow the numbered [submission checklist](DEVPOST_CHECKLIST.md) and [demo script](DEMO_SCRIPT.md). The fixed hosted service is available; a local tunnel is only a development option.
