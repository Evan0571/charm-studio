# Configuration reference

Runtime sources are `server/stylist.ts`, `server/storage.ts`, `server/amazon-pay.ts`, `server/mcp/auth.ts`, `server/vercel.ts` and the startup scripts. This guide contains placeholders only.

Create `.env` from [.env.example](../.env.example) when it does not already exist. Run from the repository root and restart after changes. Exported process variables take precedence over dotenv. Server secrets must never use a `VITE_` prefix.

## Variables

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Ordinary website port |
| `HOST` | `127.0.0.1` | Ordinary website bind address; the dedicated ChatGPT helper binds loopback |
| `OPENAI_API_KEY` | Optional | Website AI and ordinary-server `loop_suggest_design`; not needed for manual design or the ChatGPT catalog/preview path |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Website model; a blank value is invalid; does not choose ChatGPT's model |
| `SUPABASE_URL` | Optional, paired | Supabase HTTPS project URL |
| `SUPABASE_SECRET_KEY` | Optional, paired | Server-only secret or legacy service-role key |
| `SQLITE_PATH` | `.data/charm-studio.sqlite` | Ordinary local business database |
| `AMAZON_PAY_MERCHANT_ID` | Required for Sandbox | US Sandbox merchant ID |
| `AMAZON_PAY_STORE_ID` | Required for Sandbox | Sandbox Integration Central store ID |
| `AMAZON_PAY_PUBLIC_KEY_ID` | Required for Sandbox | Must start with `SANDBOX-` |
| `AMAZON_PAY_PRIVATE_KEY_PATH` | Local alternative | Absolute RSA PEM file path, kept outside Git |
| `AMAZON_PAY_PRIVATE_KEY` | Deployment alternative | Inline PEM; takes precedence over the path; accepts real or escaped newlines |
| `AMAZON_PAY_BASE_URL` | Required for Sandbox | Exact return origin, HTTPS or `http://localhost:port`; no path/query/fragment |
| `CHATGPT_PORT` | `3004` | Temporary helper server, valid range 1024–65535 |
| `CLOUDFLARED_BIN` | `cloudflared` on PATH | Optional absolute binary path; helper also checks ignored `.data/bin/` |
| `MCP_PUBLIC_URL` | Unset locally | Stable `https://your-domain/mcp`, with no credentials/query/fragment |
| `MCP_TOKEN_SECRET` | Generated locally | Stable deployment requires a private random value with at least 32 characters |
| `MCP_OAUTH_STORAGE` | SQLite locally, Supabase on Vercel | Shared OAuth persistence; Vercel refuses SQLite |
| `MCP_HTTP_STREAMING` | Local off, Vercel on | `true` exercises streamed responses locally |
| `COOKIE_SECURE` | Unset locally | Set `true` for HTTPS; the tunnel helper supplies it to its child |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` on Vercel | Use the pinned pnpm version |
| `NODE_ENV` | Startup-managed | Production launchers set it for their child |
| `PLAYWRIGHT_MODULE` | Optional testing | External Playwright ESM entry for browser checks |
| `LOOP_UI_DEV` | Optional testing | `1` enables dev-mode language-browser checks |
| `LOOP_STDIO_OWNER_PATH` | `.data/desktop-mcp-owner` | Local stdio guest profile |
| `LOOP_STDIO_DATABASE` | `.data/charm-studio.sqlite` | Local stdio SQLite file |

There is no built-in configuration for `DATABASE_URL`, `OPENAI_BASE_URL`, another model vendor, or Alexa partner credentials. Adding an environment variable alone does not implement an integration.

## Minimal local setup

```dotenv
PORT=3000
HOST=127.0.0.1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Leave both Supabase variables and stable-deployment MCP settings unset. No credentials are needed for manual editing, saving, pricing, test orders or deterministic MCP examples.

To enable the website AI, set your own OpenAI API key and restart. This is separate from the ChatGPT host's account/model access. Keys can be created in the [OpenAI API dashboard](https://platform.openai.com/api-keys).

## Supabase

Execute [the complete schema](../supabase/schema.sql) in your selected project, then set both variables:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

For an older database, the checked-in migrations add shared OAuth records and Amazon Pay fields. A fresh database should use the complete schema. This adapter uses `supabase-js` and the Data API, not a Postgres connection string. The schema enables RLS and restricts direct table access; guest filtering is enforced on the server using the privileged key. Keep that key server-side and retain the checked-in grants. [Official API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

A cloud error is reported, not replaced by a local database. Changing storage does not migrate guest records. Health verifies connectivity; saving a test draft verifies writes.

## Amazon Pay Sandbox

The website's separate payment demonstration uses the US **Sandbox** and one-time USD payments. No paid Amazon seller subscription is needed for this Sandbox setup.

1. Use the [Sandbox registration flow](https://payments.amazon.com/register?isSandbox=true&locale=en_US&source=APDW).
2. In Sandbox Integration Central, create/select your store and obtain its merchant/store IDs and Sandbox public-key ID.
3. Save the RSA private key outside Git, and set the matching server-only variables.
4. Create your own Sandbox test buyer. Set the exact return origin for your deployment; Amazon does not require Sandbox domains to be added to live JavaScript Origins.
5. Restart/redeploy and test a real Sandbox checkout. Keep test buyer passwords private.

```dotenv
AMAZON_PAY_MERCHANT_ID=your-merchant-id
AMAZON_PAY_STORE_ID=your-store-id
AMAZON_PAY_PUBLIC_KEY_ID=SANDBOX-your-public-key-id
AMAZON_PAY_PRIVATE_KEY_PATH=/absolute/path/to/your-private-key.pem
AMAZON_PAY_BASE_URL=http://localhost:3000
```

For serverless deployments use `AMAZON_PAY_PRIVATE_KEY` in the secret store instead of a local file path. `/api/payments/amazon-pay/status` reports configuration readiness; it does not prove provider authorization.

The return handler verifies order ownership, amount/currency, Sandbox environment and captured charge before storing `sandbox_paid`. Failure, cancel, pending or network error does not count as paid; retry can reconcile an existing session. Test success, cancellation, reload, repeated clicks and interrupted return handling. Ordinary test orders remain available when Sandbox is unconfigured.

Official references: [setup](https://developer.amazon.com/docs/amazon-pay-checkout/get-set-up-for-integration.html), [verify and complete](https://developer.amazon.com/docs/amazon-pay-checkout/verify-and-complete-checkout.html), [Sandbox buyers](https://developer.amazon.com/docs/amazon-pay-checkout/amazon-pay-sandbox-accounts.html).

## Model behavior

The website stylist calls OpenAI Responses with strict JSON Schema, `store: false`, a 45-second per-request timeout and an output limit of 2,200 tokens. The default `gpt-4.1-mini` is a project choice, not a claim to be the newest model. English-language validation can trigger one retry.

A replacement must support the existing Responses/strict structured-output request and be accessible to your API project. Test both languages, initial proposals, revisions, locks and errors. Other vendors require provider code changes. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [model reference](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

| Path | Inference |
| --- | --- |
| Website AI / ordinary-server `loop_suggest_design` | Backend provider selected by `OPENAI_MODEL` |
| ChatGPT catalog → preview | Host conversation model |
| Temporary ChatGPT helper / local stdio | Backend stylist disabled; use host catalog/preview flow |
| Manual editing / fixed catalog example | No model call |

Server validation enforces compatibility and locked slots and recalculates the quote. A stated budget is not a server-enforced cap. Model output itself does not save or place an order. AI limits are six requests/minute per guest and four concurrent requests per process; they are not deployment-wide quotas.

## Local private state and hosting

Local business/OAuth databases, the signing key, desktop owner and helper connection information are generated under ignored `.data/`. Keep them private and preserve them when restarting a persistent instance. The guest cookie belongs to the browser; Git does not carry visitor identity.

A stable HTTPS server needs a stable `MCP_PUBLIC_URL`, `MCP_TOKEN_SECRET`, secure cookies and persistent storage. The temporary helper generates its own current URL and child configuration; it is not a fixed-domain launcher. Vercel uses Supabase rather than local `.data`. See [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md).

## Diagnostics

```bash
pnpm setup:check
pnpm setup:check --url http://localhost:3000
```

Diagnostics report presence/format and public status endpoints without printing secrets or calling AI. `configured: true` is not provider acceptance. OpenAI 401 usually requires checking the key, 429 requires checking quota/rate limits, and unavailable models require checking the configured model ID and project access. Preserve the current design on failure.
