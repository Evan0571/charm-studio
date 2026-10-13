// Desktop-only MCP entrypoint. The desktop host owns process access; HTTP
// clients continue to use the existing OAuth-protected /mcp endpoint.
import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SqliteStorage } from '../storage';
import { createStudioService } from '../studio-service';
import { createMcpTokens, mcpOptionsFromEnvironment } from './auth';
import { createLoopMcpServer } from './server';

const origin = 'http://localhost:3000';
// The card reads local models and textures through MCP. Desktop usage needs
// the built resource and its database, independently of the web server.
try { await Promise.all(['dist-mcp/loop-widget.js', 'dist-mcp/loop-widget.css'].map(file => access(resolve(file)))); }
catch { throw new Error('Build the LOOP preview with pnpm build:mcp-ui before connecting the desktop plugin.'); }
const ownerPath = resolve(process.env.LOOP_STDIO_OWNER_PATH || '.data/desktop-mcp-owner');
mkdirSync(dirname(ownerPath), { recursive: true });
try { writeFileSync(ownerPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
const owner = readFileSync(ownerPath, 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('Invalid desktop MCP profile; refusing to change the stored identity.');
const storage = new SqliteStorage(process.env.LOOP_STDIO_DATABASE || resolve('.data/charm-studio.sqlite'));
const service = createStudioService(storage, {
  configured: () => false,
  reply: async () => { throw new Error('Use the ChatGPT host model with loop_get_catalog and loop_preview_design.'); },
});
const server = createLoopMcpServer({ storage, service, owner, audience: `${origin}/mcp`, studioUrl: null, tokens: createMcpTokens(mcpOptionsFromEnvironment().secret) });
const transport = new StdioServerTransport();
let closed = false;
const close = async () => {
  if (closed) return;
  closed = true;
  await server.close();
  storage.close();
};
server.server.onclose = () => { if (!closed) { closed = true; storage.close(); } };
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void close().finally(() => process.exit(0)); });
process.stdin.once('end', () => { void close().finally(() => process.exit(0)); });
await server.connect(transport);
console.error('LOOP desktop MCP ready. Catalog, inline 3D previews and visual part selection available.');
