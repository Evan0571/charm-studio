# Deploy LOOP on Vercel

The current shared site is [loop-charm-studio.vercel.app](https://loop-charm-studio.vercel.app/). This guide deploys your own copy from `master`, with website, REST API, OAuth and MCP on one domain. Supabase stores business and shared OAuth state; no author's laptop or tunnel is required.

## 1. Prepare storage

Use a Supabase project you control. For a fresh project, execute the complete [schema.sql](../supabase/schema.sql) in its SQL Editor. Existing earlier installations may need both [shared OAuth](../supabase/migrations/20261013172935_loop_shared_oauth.sql) and [Sandbox payment fields](../supabase/migrations/20261013173649_loop_amazon_pay_sandbox.sql) migrations. These preserve existing designs/orders; review the selected target before applying SQL.

Obtain its Project URL and server-only secret/service-role key. Keep the checked-in RLS and grants. Never place that key in browser code or a `VITE_` variable.

## 2. Import the repository

1. Import `Evan0571/charm-studio` or your fork into Vercel.
2. Use the repository root, Vite framework preset and Node **24.x**.
3. Keep the checked-in install command `pnpm install --frozen-lockfile`, build command `pnpm build`, and output directory `dist`.
4. Set the Production Branch to **master**.

The complete build generates `dist-server/app.mjs` and `dist-mcp`; a plain `vite build` is insufficient. `api/index.mjs` loads the Express backend. The routes and included assets are configured in [vercel.json](../vercel.json). Do not use a local `pnpm start` or tunnel helper as a Vercel start command.

## 3. Configure Production environment variables

| Variable | Value |
| --- | --- |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |
| `SUPABASE_URL` | Your selected project URL |
| `SUPABASE_SECRET_KEY` | Server-only secret/service-role key |
| `MCP_TOKEN_SECRET` | A stable random secret of at least 32 characters |
| `COOKIE_SECURE` | `true` |
| `MCP_PUBLIC_URL` | Recommended explicit `https://your-production-domain/mcp` |
| `OPENAI_API_KEY` | Optional for the website AI stylist |
| `OPENAI_MODEL` | Optional; default `gpt-4.1-mini` |

Generate the signing secret privately using your secret manager or a cryptographically secure generator, retain it across deployments, and never commit it. For Amazon Pay Sandbox, add the separate provider variables in [ENVIRONMENT.md](ENVIRONMENT.md#amazon-pay-sandbox), using inline private-key secret storage and the exact production return origin.

Vercel automatically uses shared Supabase OAuth and streamed MCP responses. Do not configure local SQLite storage. If `MCP_PUBLIC_URL` is omitted, the code derives the applicable Vercel domain; set it explicitly for a chosen production/custom domain.

Use separate Preview configuration and preferably separate development storage/signing secrets. Do not assign a Production MCP audience to an unrelated Preview domain. OAuth records are namespaced by full MCP URL.

## 4. Deploy and verify

Deploy and use the stable production domain, rather than a one-off deployment URL. Environment changes require a redeploy. Verify the actual commit and Production Branch.

| Route | Expected |
| --- | --- |
| `/`, `/#/studio`, `/mcp-demo.html` | Website and 3D/MCP client load |
| `/api/health` | HTTP 200; `status: "ok"`, `storage: "supabase"` |
| `/api/catalog` | JSON catalog, not the homepage |
| `/.well-known/oauth-protected-resource/mcp` | Resource equals the chosen `/mcp` URL |
| `/.well-known/oauth-authorization-server` | Same-domain discovery, registration and token endpoints |
| Anonymous `/mcp` | HTTP 401 plus OAuth discovery challenge |

```bash
pnpm setup:check --url https://your-production-domain
```

Then follow [TESTING.md](TESTING.md), including save/reopen and explicit test-order confirmation. Those operations create demo records, with no real charge or shipping. A basic status check alone does not validate writes or live AI.

## 5. Connect a host

Use [CHATGPT.md](CHATGPT.md) with your fixed `/mcp` URL and independent OAuth consent. The production domain must be reachable without Vercel account login; LOOP's own OAuth remains enabled. Test a card, revision, save and test confirmation. Production MCP uses POST-scoped SSE streams; a direct GET is not a successful client connection.

A domain change creates a new browser guest workspace and MCP audience; there is no automatic guest migration. Preserve the signing key and database across ordinary releases.

## Troubleshooting

| Failure | Check |
| --- | --- |
| API returns homepage HTML | Correct branch, `vercel.json`, server entry and full build |
| Health 503 | Supabase variables, project availability, schema/OAuth RPCs and grants |
| Host/Origin rejected | Canonical `MCP_PUBLIC_URL`, current domain and Preview separation |
| Old authorizations fail after release | Signing secret, database and audience changed |
| Large card/model response fails | Current streaming backend and non-buffering proxies |
| Card build missing | Complete `pnpm build` and included `dist-mcp` / public assets |
| AI unavailable | Optional key, model access and API credit; manual studio remains independent |

The static site uses the CDN and one Node function serves the backend. Shared OAuth supports independent instances and atomic token consumption. Large card/model content streams over HTTP; desktop stdio remains a separate local path.

## Optional live storage acceptance script

```bash
pnpm build
node --import tsx scripts/vercel-flow-check.mjs
```

This uses your private Supabase configuration, exercises multiple instances, authorization, save/reopen and test checkout. Temporary grants/drafts are removed, but an isolated immutable test order remains. Run it only when those writes are intended. It does not deploy a cloud service or perform a real payment.

References: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [streaming and body-size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [SQLite hosting limits](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
