# Install and run LOOP

Use [the hosted website](https://loop-charm-studio.vercel.app/) for the quickest trial. This guide runs your own copy. All commands run from the repository root.

## 1. Prerequisites

- Node.js **24** recommended, minimum **22.13**; `.nvmrc` selects 24.
- Git and **pnpm 11.25.0**.
- A WebGL-capable browser with hardware acceleration.

SQLite is built into Node. Models, textures and lighting are bundled. Docker, Python, Blender, AWS credentials and Alexa+ partner access are not required to run the project. Optional browser automation requires Playwright and Chrome.

## 2. Install

```bash
git clone https://github.com/Evan0571/charm-studio.git
cd charm-studio
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
```

Use the default `master` branch. On Windows, use PowerShell/Windows Terminal; `pnpm.cmd` can be used if a PowerShell script policy blocks `pnpm.ps1`. On macOS/Linux, an existing Node version manager can read `.nvmrc` with `nvm install` and `nvm use`.

If a frozen-lockfile install fails, confirm the pnpm version and branch before changing dependencies. Do not delete the lockfile to bypass the failure.

## 3. Create a private local configuration

The following cross-platform command preserves an existing `.env`:

```bash
node -e "const fs=require('node:fs'); if(!fs.existsSync('.env')) fs.copyFileSync('.env.example','.env');"
pnpm setup:check
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Keep that terminal running. In another terminal:

```bash
pnpm setup:check --url http://localhost:3000
```

With no optional credentials, health reports `storage: "local"`, AI reports `configured: false`, and the manual studio, saving, quotes, test orders and deterministic MCP examples work. An unconfigured AI flag is expected in this mode.

On macOS, `start.command` provides a double-click launcher. If needed, use `chmod +x start.command`. Windows/Linux use the commands above.

## 4. Verify the workflow

1. Open `/#/studio`, change a part and inspect the 3D model and updated price.
2. Save a clearly named test draft, refresh and reopen it from `/#/saved`.
3. Review a test order, cancel it, then prepare a new review and explicitly confirm if you want a test record.
4. Open `/mcp-demo.html`, connect and use **Try a catalog example**.
5. Expand **MCP calls and connection settings** and inspect initialization, discovery and tool calls.

Keep the same hostname and browser: `localhost`, `127.0.0.1` and a private window have different guest identities.

```bash
pnpm test
pnpm mcp:smoke
pnpm build
```

These checks use isolated data and mocked AI; they do not consume model API credits. The build generates the website, MCP card and server bundle. A large chunk warning is not a build failure; check the exit status.

## 5. Enable website AI when needed

Set your own `OPENAI_API_KEY` in `.env`, keep `OPENAI_MODEL=gpt-4.1-mini`, and restart `pnpm dev`. Test a brief at `/#/search`, then lock a part and request a revision. This uses your API project and credits.

`configured: true` means a key is present, not that provider access, balance or model compatibility was verified. See [ENVIRONMENT.md](ENVIRONMENT.md).

## 6. Optional cloud storage

Default SQLite supports the local workflow. To use Supabase:

1. Choose a development project you control.
2. Execute the complete [supabase/schema.sql](../supabase/schema.sql) in that project's SQL Editor.
3. Set both `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in private server configuration.
4. Restart; check that health reports `storage: "supabase"`.
5. Save a test draft and refresh to verify persistence.

The adapter uses the Supabase Data API with a server-only secret/service-role key. Keep the provided RLS/grants intact; the backend enforces guest ownership. Do not expose that key in frontend variables. Setting only one variable fails startup; a configured cloud failure returns an error rather than silently falling back to SQLite. Switching adapters does not migrate old data.

See [configuration](ENVIRONMENT.md) and [Supabase's API key guide](https://supabase.com/docs/guides/getting-started/api-keys).

## 7. Production and external clients

```bash
pnpm build
pnpm start
```

This runs the ordinary website with its optional AI provider. For a temporary ChatGPT development connection, run the separate helper after building:

```bash
pnpm chatgpt:connect
```

It starts its own dedicated server on port 3004 and needs cloudflared. Its server-side AI fallback is disabled so the ChatGPT host can design using catalog/preview tools. Follow [CHATGPT.md](CHATGPT.md). Fixed-domain hosting follows [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md), with no local tunnel.

## 8. Update and preserve data

```bash
git status
git pull --ff-only
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Preserve your edits before pulling, then restart affected services. UI card changes require rebuilding `dist-mcp`. Stop a service with Ctrl+C; avoid killing unrelated Node processes. Keep private `.data` files when troubleshooting. Stop SQLite writers before backing up the full database/WAL state.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `node:sqlite` missing | Use Node 24 and reopen the terminal |
| Port already in use | Stop your previous service or change `PORT` / `CHATGPT_PORT` |
| Website works, AI does not | Optional key, provider permissions, model ID, API credits and restart |
| Health returns 503 | Supabase variables, complete schema, Data API availability and permissions |
| 3D blank or slow initially | Allow assets to finish loading; check WebGL/hardware acceleration and failed network requests |
| Saved drafts disappear | Same hostname, guest cookie, database adapter and browser |
| `/mcp` returns 401 | Expected without credentials; use OAuth or the MCP web client |
| Missing `dist-mcp` | Run the complete `pnpm build` |

Command portability does not imply physical acceptance on every OS/device. See [current validation](VALIDATION.md).
