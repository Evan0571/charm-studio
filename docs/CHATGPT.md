# Connect LOOP to ChatGPT

The public website and MCP server run independently of the author's computer. A compatible ChatGPT account/workspace needs permission to add custom MCP servers. The [web MCP demo](https://loop-charm-studio.vercel.app/mcp-demo.html) offers a separate no-ChatGPT trial.

For a self-contained Chinese guide to give a teammate's GPT, use [LOOP Demo installation and acceptance](LOOP_TEAMMATE_SETUP_AND_TEST.zh-CN.md). It covers personal custom MCP connections without public publication, OAuth, Work mode, read-only acceptance, and evidence-based troubleshooting.

## Hosted connection

1. In ChatGPT on the web, open **Plugins**, choose **Add** and **Add custom MCP server**. Account/workspace permissions and UI labels can vary.
2. Name it **LOOP** and enter `https://loop-charm-studio.vercel.app/mcp` as the Server URL.
3. Choose **OAuth** and leave static Client ID/Client Secret blank. LOOP publishes dynamic-registration metadata.
4. Create/install the personal connection and complete **Continue to LOOP** → **Authorize connection** in the browser.
5. On the ChatGPT homepage, switch from **Chat** to **Work** when that choice is available. Start a new Work conversation and select `@LOOP` from the actual plugin picker.

Some ChatGPT surfaces request OAuth only on the first tool call. If the plugin
shows **Try now** before linking, open a new conversation, select LOOP, and ask
it to call `loop_get_catalog`. The host should offer its connection flow, which
opens LOOP's **连接你的 LOOP 工作台** page. Choose **授权连接**, return to ChatGPT,
and retry the tool. Each person completes this flow in their own browser.

After a server update, refresh the custom connection's tool metadata and start
a new conversation. A chat reply saying “authorization required,” or a button
that merely resends a prompt, is not evidence that OAuth has started; check for
the actual host connection flow or LOOP consent page.

[Official custom MCP setup](https://developers.openai.com/api/docs/guides/custom-mcp-server) and [OAuth guidance](https://developers.openai.com/plugins/build/auth). This custom connection is separate from a public plugin-directory listing; directory publication has its own [review/submission process](https://developers.openai.com/plugins/deploy/submission).

Try:

> Use LOOP to read the catalog and create a simple cherry charm with a pearl for my brown tote, under 15 USD. Use the hero structure and show the interactive preview. Do not save or place an order yet.

Then lock the cherry in the card and ask:

> Keep the locked cherry and the pearl. Change the hardware to silver and show the updated interactive preview.

Use the card to rotate/zoom, switch to the bag view and inspect visual replacement choices. Save deliberately; request another revision while retaining the saved draft ID to update the same record. Review the exact quote before separately confirming a test order.

## Guest identity

OAuth authorizes a browser guest workspace, not a verified ChatGPT-linked customer account. Open the website and consent page in the same browser profile/domain when you want that website workspace. Different browsers, private windows and local stdio profiles are separate guests.

Each person should authorize independently. Share the URL and instructions; do not share cookies, bearer tokens, private keys or someone else's consent session. No local installation or project OpenAI API key is needed to use the hosted catalog/preview workflow.

The card's **test checkout** creates test orders only. Amazon Pay Sandbox is a separate website flow using a Sandbox test buyer; the card does not launch Amazon checkout. No real charge or shipping occurs in either flow.

## What a successful connection demonstrates

- OAuth discovery, dynamic client registration, S256 PKCE and explicit guest consent.
- MCP 2025-11-25 over Streamable HTTP.
- Ten design tools plus `loop_get_preview_asset`, an additional renderer-only tool.
- The MCP Apps resource `ui://loop/design-v5.html`, interactive 3D, visual selection and locks.
- Saved design/quote/order operations in the authorized workspace.

An anonymous browser GET to `/mcp` returns **401**, with the discovery URL in `WWW-Authenticate`. This is expected. Unlinked MCP clients can initialize, ping, and list tool, resource, resource-template, and prompt definitions over POST. Every HTTP tool declares `oauth2` with `loop:studio` in both `securitySchemes` and its `_meta` compatibility mirror. Unlinked or expired tool calls return an MCP error result carrying `_meta["mcp/www_authenticate"]`; no business tool executes before token validation succeeds. Reading resources and executing prompts remain protected. Authorized GET/DELETE returns **405** because this stateless implementation has no separate long-lived event stream or deletable transport session; normal requests use POST-scoped streams. Local stdio retains its separate trusted local identity and does not advertise HTTP OAuth.

`https://loop-charm-studio.vercel.app/authorize` is an OAuth endpoint, not a
standalone account-linking URL. ChatGPT must supply its registered `client_id`,
exact redirect URI, `state`, resource, and PKCE challenge. A manually generated
link for another client cannot link the recipient's ChatGPT connection.

## Local development tunnel

Use this only when running your own local copy:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm chatgpt:connect
```

Install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) for your OS first. The helper starts a dedicated loopback server on port 3004 and prints its current HTTPS URL. Use that exact URL including `/mcp`. Keep the terminal open. It can coexist with the ordinary website on port 3000.

Optional `.env` settings:

```dotenv
CHATGPT_PORT=3004
# CLOUDFLARED_BIN=/absolute/path/to/cloudflared
```

Windows can use `C:/tools/cloudflared.exe`; ignored `.data/bin/cloudflared.exe` is another supported location. The helper supplies its child with its own public URL, signing key and secure-cookie settings. Its server-side AI fallback is disabled: ChatGPT should read the catalog and call the preview tool using its host model.

Temporary URLs change or stop when the process/tunnel stops. Reconnect using the current address. Use [Vercel deployment](VERCEL_DEPLOY.md) for a fixed domain. Local stdio is documented separately in [DESKTOP_MCP.md](DESKTOP_MCP.md).

## Troubleshooting

| Symptom | Action |
| --- | --- |
| No custom MCP creation entry | Check the target account/workspace permissions; use the public web MCP client for evaluation |
| Authorization repeats or fails | Confirm exact `/mcp` URL, canonical domain, OAuth metadata, stable signing key and storage |
| Tools missing after an update | Refresh the connection's tool metadata; rediscover the current UI resource |
| Card cannot load assets | Confirm the complete build and current streamed backend; inspect the host's CSP and connection logs |
| Catalog/preview works but `loop_suggest_design` fails | On helper/stdio it is intentionally disabled; use the host model with catalog and preview |
| Website drafts differ from the card | Verify the browser profile that granted consent; identities are guest-scoped |
| A fixed domain asks for Vercel login | The production domain must be reachable by the host; retain LOOP's own OAuth |

## Validation boundaries

The author's real ChatGPT account previously completed hosted OAuth, catalog/preview, bag-view and locked-part revision checks. Local SDK/AppBridge tests cover additional actions and strict CSP behavior. Those tests do not establish acceptance in every ChatGPT account or desktop host. Independent second-account OAuth, save and confirmation acceptance remains a team submission check; see [VALIDATION.md](VALIDATION.md).
