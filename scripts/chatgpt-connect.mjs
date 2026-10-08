import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { get } from 'node:https';
import { lookup } from 'node:dns';
import { Resolver } from 'node:dns/promises';

// Newly created tunnel domains can remain negatively cached by the local DNS
// resolver. Resolve only that public test hostname through Cloudflare on
// ENOTFOUND; this changes no system settings and still verifies HTTPS normally.
async function checkPublicMetadata(origin) {
  const resolver = new Resolver({ timeout: 1500, tries: 1 }); resolver.setServers(['1.1.1.1']);
  return new Promise((resolveCheck, reject) => {
    const request = get(`${origin}/.well-known/oauth-protected-resource/mcp`, {
      lookup(hostname, options, callback) {
        lookup(hostname, options, (error, address, family) => {
          if (error?.code !== 'ENOTFOUND') { callback(error, address, family); return; }
          resolver.resolve4(hostname).then(addresses => {
            if (options.all) callback(null, addresses.map(address => ({ address, family: 4 })));
            else callback(null, addresses[0], 4);
          }, callback);
        });
      },
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; if (body.length > 32000) request.destroy(new Error('Unexpected metadata response size.')); });
      response.on('end', () => {
        try { resolveCheck({ status: response.statusCode, resource: JSON.parse(body).resource }); }
        catch { resolveCheck({ status: response.statusCode }); }
      });
      response.on('error', reject);
    });
    request.setTimeout(5000, () => request.destroy(new Error('Metadata request timed out.')));
    request.on('error', reject);
  });
}

// Keep the temporary public process separate from the active 3D dev server.
const port = Number(process.env.CHATGPT_PORT || 3004);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid CHATGPT_PORT.');
for (const file of ['dist/index.html', 'dist-mcp/loop-widget.js', 'dist-mcp/loop-widget.css']) if (!existsSync(file)) throw new Error('Run pnpm build before connecting ChatGPT.');
await new Promise((resolveReady, reject) => {
  const check = createServer(); check.once('error', reject); check.listen(port, '127.0.0.1', () => check.close(resolveReady));
});
mkdirSync('.data', { recursive: true });
const secretPath = '.data/mcp-token-secret';
try { writeFileSync(secretPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const localBinary = `.data/bin/${process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'}`;
const binary = process.env.CLOUDFLARED_BIN || (existsSync(localBinary) ? resolve(localBinary) : 'cloudflared');
const tunnel = spawn(binary, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2', '--logfile', resolve('.data/chatgpt-tunnel.log')], { stdio: ['ignore', 'pipe', 'pipe'] });
let server;
const stop = () => { server?.kill('SIGTERM'); tunnel.kill('SIGTERM'); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  console.log('Starting a temporary HTTPS connection for the LOOP ChatGPT plugin…');
  const origin = await new Promise((resolveOrigin, reject) => {
    const timer = setTimeout(() => reject(new Error('HTTPS tunnel did not become ready within 45 seconds.')), 45_000);
    let log = '';
    const onOutput = chunk => {
      log = (log + chunk.toString()).slice(-12000);
      const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) { clearTimeout(timer); resolveOrigin(match[0]); }
    };
    tunnel.stdout.on('data', onOutput); tunnel.stderr.on('data', onOutput);
    tunnel.once('error', error => { clearTimeout(timer); reject(new Error(`Install cloudflared first, or set CLOUDFLARED_BIN. ${error.code || ''}`)); });
    tunnel.once('exit', code => { clearTimeout(timer); reject(new Error(`HTTPS tunnel stopped (${code}).`)); });
  });
  server = spawn(process.execPath, ['--import', 'tsx', 'server/chatgpt.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), MCP_PUBLIC_URL: `${origin}/mcp`, MCP_TOKEN_SECRET: readFileSync(secretPath, 'utf8').trim(), COOKIE_SECURE: 'true' }, stdio: ['ignore', 'inherit', 'inherit'],
  });
  let ready = false, diagnostic = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    if (server.exitCode !== null) throw new Error('LOOP ChatGPT server stopped before becoming ready.');
    try {
      const response = await checkPublicMetadata(origin);
      diagnostic = `HTTP ${response.status}`;
      ready = response.status === 200 && response.resource === `${origin}/mcp`;
      if (ready) break;
    } catch (error) { diagnostic = error.cause?.code || error.name; }
    await new Promise(resolveWait => setTimeout(resolveWait, 1000));
  }
  if (!ready) throw new Error(`The public endpoint could not be verified (${diagnostic}). Check .data/chatgpt-tunnel.log.`);
  writeFileSync('.data/chatgpt-connection.json', JSON.stringify({ endpoint: `${origin}/mcp`, authentication: 'OAuth', createdAt: new Date().toISOString(), serverPid: server.pid, tunnelPid: tunnel.pid }, null, 2) + '\n', { mode: 0o600 });
  console.log(`\nChatGPT → Plugins → Add custom MCP server\nName: LOOP\nServer URL: ${origin}/mcp\nAuthentication: OAuth (dynamic client registration; leave client ID/secret empty)\n\nKeep this process running while using the plugin. Ctrl+C disconnects the temporary endpoint.`);
  await Promise.race([new Promise(resolveExit => server.once('exit', resolveExit)), new Promise(resolveExit => tunnel.once('exit', resolveExit))]);
} finally { stop(); }
