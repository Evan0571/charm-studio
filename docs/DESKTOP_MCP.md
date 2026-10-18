# Local stdio MCP connection

Use [the hosted OAuth server](CHATGPT.md) for a shared URL. This guide runs a local Node process in a desktop host that supports stdio MCP. Support for inline MCP Apps rendering depends on the host.

## Install and build

```bash
pnpm install --frozen-lockfile
pnpm build
```

Configure your host to launch an absolute Node executable with these arguments:

```json
{
  "mcpServers": {
    "loop-local": {
      "command": "/absolute/path/to/node",
      "args": [
        "--import", "/absolute/path/to/charm-studio/node_modules/tsx/dist/loader.mjs",
        "/absolute/path/to/charm-studio/server/mcp/stdio.ts"
      ],
      "cwd": "/absolute/path/to/charm-studio"
    }
  }
}
```

This is a generic example, not a universal host configuration schema. If the host does not support `cwd`, launch through a wrapper that changes into the repository root before executing Node. On Windows use the correct `node.exe` and drive-qualified paths. No machine-specific plugin archive or private installation link is distributed by this repository.

The ordinary website need not be running. The entry uses local SQLite and disables the backend AI stylist; the host model reads the catalog and creates previews. Protocol data goes to stdout and diagnostics to stderr. The HTTP endpoint retains its separate OAuth flow.

## Try the tools

> Read the LOOP catalog and show an interactive hero design with silver hardware, a star charm and a wood bead. Do not save or create an order.

If the host renders MCP Apps, use visual choices, locks, rotation, zoom and bag preview. Some hosts expose tools without rendering cards; use the website for a visual trial in that case.

## Persistent local identity

The entry generates ignored `.data/desktop-mcp-owner` and uses `.data/charm-studio.sqlite`. Optional `LOOP_STDIO_OWNER_PATH` and `LOOP_STDIO_DATABASE` choose alternative private paths. Keep the owner profile stable to reopen the same local guest's records. Browser and stdio guests are different identities.

The current UI resource is `ui://loop/design-v5.html`, with older URI aliases. Ten design tools and the additional renderer asset tool are exposed. Fixed-whitelist model/material data is loaded on demand via MCP, keeping binary payloads outside model-visible content and below the default stdio message boundary. The inline card uses static WebGL geometry rather than a WebAssembly physics engine; the website studio retains its own motion path.

## Verify

```bash
pnpm mcp:desktop-check
```

The check uses an isolated local database, the SDK's default message limit and a process with external network access blocked. It validates initialization, tools, full UI/resource transfer, saves and same-draft reopening. This does not prove your target desktop host has rendered the card; verify that visually in the host.
