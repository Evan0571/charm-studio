// Live Supabase verification using exactly the Vercel app factory. Two fresh
// server instances share authorization; temporary grants/drafts are removed.
// The immutable QA test order remains for review (no charge or shipping).
import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SupabaseOAuthStore } from '../server/mcp/oauth-store.ts';
import { createDefaultConfig } from '../shared/catalog.ts';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Live flow check requires your server-only Supabase environment.');
const origin = `https://loop-qa-${randomUUID()}.example`, endpoint = origin + '/mcp';
Object.assign(process.env, { VERCEL: '1', VERCEL_ENV: 'production', MCP_PUBLIC_URL: endpoint, MCP_TOKEN_SECRET: randomBytes(32).toString('hex'), MCP_OAUTH_STORAGE: 'supabase', COOKIE_SECURE: 'true' });
let createVercelApp;
if (process.argv.includes('--packaged')) {
  process.chdir(resolve('.vercel/output/functions/api/index.func'));
  ({ createVercelApp } = await import(pathToFileURL(resolve('dist-server/app.mjs'))));
  const handler = (await import(pathToFileURL(resolve('api/index.mjs')))).default;
  assert.equal(typeof handler, 'function', 'The actual packaged entry must import in plain Node');
} else ({ createVercelApp } = await import('../server/vercel.ts'));
const database = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const servers = [], apps = [], clients = [];
let cookie = '', owner;
const checks = [];
async function replica() {
  const app = createVercelApp(); apps.push(app);
  const server = app.listen(0, '127.0.0.1'); servers.push(server); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, init = {}, useCookie = true) => {
    const headers = new Headers(init.headers);
    headers.set('host', new URL(origin).host); headers.set('x-forwarded-proto', 'https');
    if (useCookie && cookie) headers.set('cookie', cookie);
    const response = await fetch(base + path, { ...init, headers, redirect: 'manual' });
    if (useCookie && response.headers.has('set-cookie')) {
      cookie = response.headers.get('set-cookie').split(';')[0];
      owner = createHash('sha256').update(cookie.split('=')[1]).digest('hex');
      assert.match(response.headers.get('set-cookie'), /Secure/);
    }
    return response;
  };
}
const form = (send, path, body) => send(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin }, body: new URLSearchParams(body) });
async function connect(send, token) {
  const client = new Client({ name: 'LOOP Vercel flow check', version: '1' }); clients.push(client);
  const localFetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, origin);
    return send(url.pathname + url.search, init);
  };
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), { fetch: localFetch, requestInit: { headers: { authorization: 'Bearer ' + token } } }));
  return client;
}
try {
  const first = await replica(), second = await replica();
  assert.equal((await (await first('/api/health')).json()).status, 'ok');
  const resource = await (await first('/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(resource.resource, endpoint);
  const metadata = await (await second('/.well-known/oauth-authorization-server')).json();
  assert.equal(metadata.token_endpoint, origin + '/token');
  const redirect = 'https://chatgpt.com/connector/oauth/vercel-check';
  const registration = await first('/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Vercel QA', redirect_uris: [redirect], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
  assert.equal(registration.status, 201); const { client_id } = await registration.json();
  const verifier = randomBytes(32).toString('base64url'), challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({ client_id, redirect_uri: redirect, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', resource: endpoint, scope: 'loop:studio', state: 'vercel-qa' });
  const authorization = await second('/authorize?' + params); assert.equal(authorization.status, 200);
  const request = (await authorization.text()).match(/name="request" value="([^"]+)"/)[1];
  const consent = await form(first, '/oauth/consent', { request, decision: 'allow' }); assert.equal(consent.status, 303);
  const callback = new URL(consent.headers.get('location')); assert.equal(callback.searchParams.get('state'), 'vercel-qa');
  const exchangeBody = { client_id, grant_type: 'authorization_code', code: callback.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect, resource: endpoint };
  const exchanges = await Promise.all([first, second].map(send => form(send, '/token', exchangeBody)));
  assert.deepEqual(exchanges.map(response => response.status).sort(), [200, 400]);
  const credentials = await exchanges.find(response => response.status === 200).json();
  checks.push('DCR, browser consent and concurrent PKCE exchange across independent instances');
  const client = await connect(second, credentials.access_token);
  const ui = await client.readResource({ uri: 'ui://loop/design-v5.html' });
  assert.ok(Buffer.byteLength(ui.contents[0].text) > 4.5 * 1024 * 1024);
  const largeAsset = await client.callTool({ name: 'loop_get_preview_asset', arguments: { path: '/assets/models/atelier-tote.glb' } });
  assert.equal(largeAsset.isError, undefined); assert.ok(Buffer.byteLength(JSON.stringify(largeAsset)) > 4.5 * 1024 * 1024);
  checks.push('Full inline widget and large bag transfer over stateless SSE');
  const config = createDefaultConfig('hero');
  const saved = await client.callTool({ name: 'loop_save_design', arguments: { name: 'Vercel isolated QA', config } }); assert.equal(saved.isError, undefined);
  const draftId = saved.structuredContent.design.id;
  assert.equal((await (await first('/api/designs')).json())[0].id, draftId);
  assert.deepEqual(await (await first('/api/designs', {}, false)).json(), []);
  const refreshed = await Promise.all([first, second].map(send => form(send, '/token', { client_id, grant_type: 'refresh_token', refresh_token: credentials.refresh_token, resource: endpoint })));
  assert.deepEqual(refreshed.map(response => response.status).sort(), [200, 400]);
  const next = await refreshed.find(response => response.status === 200).json();
  // Close both instances, start a fresh one, and reuse the persisted grant.
  await client.close();
  await Promise.all(servers.splice(0).map(server => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); }));
  for (const app of apps.splice(0)) app.locals.closeMcp();
  const restarted = await replica(), resumed = await connect(restarted, next.access_token);
  const loaded = await resumed.callTool({ name: 'loop_get_design', arguments: { id: draftId } }); assert.equal(loaded.structuredContent.design.id, draftId);
  const updated = await resumed.callTool({ name: 'loop_save_design', arguments: { id: draftId, name: 'Vercel QA after restart', config: { ...config, metalTone: 'silver' } } }); assert.equal(updated.isError, undefined);
  assert.equal((await (await restarted('/api/designs')).json()).length, 1);
  checks.push('Refresh rotation, instance restart, same owned draft revision and visitor isolation');
  const prepared = await resumed.callTool({ name: 'loop_prepare_test_order', arguments: { designName: 'Vercel QA after restart', config: updated.structuredContent.design.config } });
  assert.deepEqual(await (await restarted('/api/orders')).json(), []);
  const ticket = prepared.structuredContent.confirmationToken;
  const confirmed = await Promise.all([1, 2].map(() => resumed.callTool({ name: 'loop_confirm_test_order', arguments: { confirmationToken: ticket, confirmed: true } })));
  assert.ok(confirmed.every(result => !result.isError));
  assert.equal((await (await restarted('/api/orders')).json()).length, 1);
  await form(restarted, '/revoke', { client_id, token: next.refresh_token });
  assert.equal((await restarted('/mcp', { headers: { authorization: 'Bearer ' + next.access_token } })).status, 401);
  checks.push('Explicit test checkout, concurrent order retry and revocation');
  // Exercise expiry/atomic consumption directly through the actual database.
  const storeA = new SupabaseOAuthStore(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, endpoint);
  const storeB = new SupabaseOAuthStore(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, endpoint);
  await storeA.put('consent', 'expired-qa', { qa: true }, -1000);
  assert.equal(await storeB.consume('consent', 'expired-qa'), undefined);
  assert.equal(await storeB.get('consent', 'expired-qa'), undefined);
  checks.push('Database expiry enforcement');
  console.log(JSON.stringify({ status: 'passed', checks, realSupabase: true, packagedFunction: process.argv.includes('--packaged'), actualCloudDeployment: false, qaOrderId: confirmed[0].structuredContent.order.id }, null, 2));
} finally {
  await Promise.allSettled(clients.map(client => client.close()));
  await Promise.all(servers.map(server => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); }));
  for (const app of apps) app.locals.closeMcp();
  const cleanup = [database.from('charm_oauth_records').delete().eq('namespace', endpoint)];
  if (owner) cleanup.push(database.from('charm_designs').delete().eq('owner_id', owner));
  for (const result of await Promise.all(cleanup)) if (result.error) throw new Error('QA cleanup failed: ' + result.error.code);
}
