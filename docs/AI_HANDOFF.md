# Teammate and coding-assistant handoff

Read [README](../README.md), [SETUP](SETUP.md), [ENVIRONMENT](ENVIRONMENT.md) and [STATUS](STATUS.md). Use the default `master` branch and pinned Node/pnpm versions. The repository is public; local configuration, databases and installed host connections are not part of it.

## Local acceptance

1. Inspect the existing checkout and preserve user edits. Install with `pnpm install --frozen-lockfile`.
2. Create `.env` from the example only if absent. Start with local SQLite and no provider key.
3. Run `pnpm setup:check`, `pnpm test`, `pnpm mcp:smoke` and `pnpm build`.
4. Start `pnpm dev` or the built `pnpm start`, then check public status endpoints with `pnpm setup:check --url http://localhost:3000`.
5. Follow [TESTING.md](TESTING.md) in a browser: 3D, editing, save/reopen, quote, explicit test confirmation and MCP trace.
6. Report actual results, running processes, addresses and unresolved account/provider steps.

Do not print/commit `.env`, `.data`, cookies, signing keys, test buyer passwords or server credentials. Do not overwrite configuration, delete user records, change dependency versions or copy another machine's temporary tunnel URL to make a check pass.

## Optional integrations

| Need | Guide |
| --- | --- |
| Website AI with the user's provider key | [Environment](ENVIRONMENT.md) |
| Supabase using the chosen project | [Setup](SETUP.md) and the complete checked-in schema |
| Hosted ChatGPT connection | [ChatGPT](CHATGPT.md), independent OAuth consent |
| Local desktop process | [Desktop MCP](DESKTOP_MCP.md) |
| Fixed-domain deployment | [Vercel](VERCEL_DEPLOY.md) |
| Amazon Pay Sandbox | [Environment](ENVIRONMENT.md#amazon-pay-sandbox) |

Use external services only within the user's task scope. No live database/provider configuration changes are needed for the default local acceptance path. Missing AI credentials do not block manual studio or host-driven catalog/preview testing.

Tests with stubs do not establish live provider acceptance; engine connection does not establish visible host rendering. Keep these distinctions in the report. The public documentation and [submission checklist](DEVPOST_CHECKLIST.md) should state only demonstrated behavior.
