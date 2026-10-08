// Read-only setup diagnostics. Never print secret values or call a model API.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

let failures = 0;
const check = (ok, message) => { console.log(`${ok ? 'OK' : 'FAIL'}  ${message}`); if (!ok) failures++; };
const info = message => console.log(`INFO  ${message}`);
const [major, minor] = process.versions.node.split('.').map(Number);
check(major > 22 || (major === 22 && minor >= 13), `Node ${process.versions.node}; required >=22.13, recommended 24`);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
info(`Package manager: ${pkg.packageManager}; platform: ${process.platform}/${process.arch}`);
for (const dependency of ['tsx', 'vite', 'express', '@modelcontextprotocol/sdk', '@modelcontextprotocol/ext-apps']) {
  try { import.meta.resolve(dependency); check(true, `${dependency} installed`); }
  catch { check(false, `${dependency} missing; run pnpm install --frozen-lockfile`); }
}
check(['public/assets/models/atelier-tote.glb', 'public/assets/models/atelier-shoulder.glb', 'public/assets/environment/studio-small-09-1k.hdr'].every(existsSync), 'Bundled 3D models and lighting available');
info(existsSync('.env') ? '.env found (values remain private)' : 'No .env; default local mode is available');
const cloudUrl = !!process.env.SUPABASE_URL, cloudKey = !!process.env.SUPABASE_SECRET_KEY;
check(cloudUrl === cloudKey, 'SUPABASE_URL and SUPABASE_SECRET_KEY must both be set or both absent');
info(`Storage configuration: ${cloudUrl && cloudKey ? 'Supabase (connectivity not yet checked)' : 'local SQLite'}`);
info(`Website AI key: ${process.env.OPENAI_API_KEY?.trim() ? 'configured (not verified)' : 'absent; manual studio and ChatGPT catalog/preview flow still work'}`);
info(`Website model: ${process.env.OPENAI_MODEL?.trim() ? 'overridden in OPENAI_MODEL; see your private .env' : 'gpt-4.1-mini (default)'}`);
if (process.env.OPENAI_MODEL !== undefined) check(!!process.env.OPENAI_MODEL.trim(), 'OPENAI_MODEL must not be blank when set');
for (const key of ['PORT', 'CHATGPT_PORT']) {
  if (process.env[key]) { const port = Number(process.env[key]); check(Number.isInteger(port) && port >= (key === 'CHATGPT_PORT' ? 1024 : 1) && port <= 65535, `${key} has a valid port`); }
}
if (process.env.MCP_PUBLIC_URL) {
  let valid = false;
  try { const url = new URL(process.env.MCP_PUBLIC_URL); valid = url.protocol === 'https:' && url.pathname === '/mcp' && !url.username && !url.password && !url.search && !url.hash; } catch { /* Report without echoing the value. */ }
  check(valid, 'MCP_PUBLIC_URL is an HTTPS URL ending in /mcp');
  check((process.env.MCP_TOKEN_SECRET?.trim().length ?? 0) >= 32, 'Stable public deployment has a signing secret of at least 32 characters');
}
if (process.env.COOKIE_SECURE === 'true' && !process.env.MCP_PUBLIC_URL) info('COOKIE_SECURE=true is intended for HTTPS; remove it for ordinary local HTTP. chatgpt:connect sets it only for its child server.');
const built = ['dist/index.html', 'dist-mcp/loop-widget.js', 'dist-mcp/loop-widget.css'].every(existsSync);
info(built ? 'Production and MCP UI builds exist; rebuild after source changes' : 'Builds missing; run pnpm build before pnpm start or pnpm chatgpt:connect');
const local = `.data/bin/${process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'}`;
const binary = process.env.CLOUDFLARED_BIN || (existsSync(local) ? resolve(local) : 'cloudflared');
const tunnel = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
info(tunnel.status === 0 ? 'cloudflared available for ChatGPT HTTPS connection' : 'cloudflared unavailable; only needed for pnpm chatgpt:connect');
if (process.argv[2] && process.argv[2] !== '--url') throw new Error('Usage: pnpm setup:check [--url http://localhost:3000]');
if (process.argv[2] === '--url') {
  const base = new URL(process.argv[3]);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Use a plain HTTP(S) base URL without credentials or query parameters.');
  for (const path of ['/api/health', '/api/catalog', '/api/ai/status']) {
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(8000), redirect: 'error' });
      const data = await response.json();
      const valid = response.ok && (path.endsWith('health') ? data.status === 'ok' : path.endsWith('catalog') ? Array.isArray(data.templates) && Array.isArray(data.parts) : typeof data.configured === 'boolean');
      check(valid, `${path}: HTTP ${response.status}${path.endsWith('status') && valid ? `; AI configured=${data.configured}` : ''}`);
    } catch { check(false, `${path}: could not read a valid response`); }
  }
}
info('No API keys printed, no AI requests made, no designs or orders written.');
process.exitCode = failures ? 1 : 0;
