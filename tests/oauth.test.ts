import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { SqliteStorage } from '../server/storage';
import { OAuthStore } from '../server/mcp/oauth-store';
import { createDefaultConfig } from '../shared/catalog';

async function fixture() {
  const storage = new SqliteStorage(':memory:');
  let now = Date.now();
  const app = createApp(storage, { configured: () => false, reply: async () => { throw new Error('No model in OAuth tests'); } }, { secret: 'oauth-test-secret-at-least-32-characters', now: () => now });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const redirect = 'https://chatgpt.com/connector/oauth/test-callback';
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const json = async (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const form = async (path: string, body: Record<string, string>, cookie = '', origin = base) => fetch(base + path, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, origin }, body: new URLSearchParams(body) });
  async function register(overrides = {}) {
    return json('/register', { client_name: 'LOOP integration test', redirect_uris: [redirect], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], ...overrides });
  }
  async function authorize(clientId: string, overrides = {}, cookie = '') {
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', scope: 'loop:studio', state: 'preserve-me', resource: base + '/mcp', ...overrides });
    const response = await fetch(base + '/authorize?' + params, { headers: { cookie }, redirect: 'manual' });
    const text = await response.text();
    const request = text.match(/name="request" value="([^"]+)"/)?.[1];
    return { response, text, request: request!, cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
  }
  async function code(clientId: string) {
    const auth = await authorize(clientId);
    assert.equal(auth.response.status, 200); assert.ok(auth.request);
    const consent = await form('/oauth/consent', { request: auth.request, decision: 'allow' }, auth.cookie);
    assert.equal(consent.status, 303);
    const callback = new URL(consent.headers.get('location')!);
    assert.equal(callback.searchParams.get('state'), 'preserve-me');
    return { code: callback.searchParams.get('code')!, cookie: auth.cookie };
  }
  const exchange = (clientId: string, code: string, overrides = {}) => form('/token', { client_id: clientId, grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect, resource: base + '/mcp', ...overrides });
  return { base, register, authorize, code, exchange, form, advance: (ms: number) => { now += ms; }, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); app.locals.closeMcp(); storage.close(); } };
}

test('OAuth discovery → DCR → consent + PKCE → MCP shares this browser guest; refresh rotates and revoke takes effect', async () => {
  const f = await fixture(); const client = new Client({ name: 'oauth-test', version: '1' });
  try {
    const unauthorized = await fetch(f.base + '/mcp');
    assert.equal(unauthorized.status, 401);
    assert.match(unauthorized.headers.get('www-authenticate')!, /oauth-protected-resource\/mcp/);
    const resource = await (await fetch(f.base + '/.well-known/oauth-protected-resource/mcp')).json();
    assert.equal(resource.resource, f.base + '/mcp');
    const metadata = await (await fetch(f.base + '/.well-known/oauth-authorization-server')).json();
    assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
    const registration = await f.register(); assert.equal(registration.status, 201);
    const { client_id } = await registration.json();
    const { code, cookie } = await f.code(client_id);
    const exchange = await f.exchange(client_id, code); assert.equal(exchange.status, 200);
    const tokens = await exchange.json();
    await client.connect(new StreamableHTTPClientTransport(new URL(f.base + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + tokens.access_token } } }));
    const saved = await client.callTool({ name: 'loop_save_design', arguments: { name: '来自 ChatGPT', config: createDefaultConfig('hero') } });
    assert.equal(saved.isError, undefined);
    const designs = await (await fetch(f.base + '/api/designs', { headers: { cookie } })).json();
    assert.equal(designs[0].name, '来自 ChatGPT');
    assert.deepEqual(await (await fetch(f.base + '/api/designs')).json(), []);
    assert.equal((await f.exchange(client_id, code)).status, 400);
    const refreshBody = { grant_type: 'refresh_token', client_id, refresh_token: tokens.refresh_token, resource: f.base + '/mcp' };
    assert.equal((await f.form('/token', { ...refreshBody, resource: 'https://wrong.example/mcp' })).status, 400);
    const refresh = await f.form('/token', refreshBody); assert.equal(refresh.status, 200);
    const refreshed = await refresh.json(); assert.notEqual(tokens.refresh_token, refreshed.refresh_token);
    assert.equal((await f.form('/token', refreshBody)).status, 400);
    assert.equal((await f.form('/revoke', { client_id, token: refreshed.refresh_token })).status, 200);
    assert.equal((await fetch(f.base + '/mcp', { headers: { authorization: 'Bearer ' + refreshed.access_token } })).status, 401);
    assert.equal((await f.form('/token', { ...refreshBody, refresh_token: refreshed.refresh_token })).status, 400);
  } finally { await client.close(); await f.close(); }
});

test('OAuth rejects cross-user consent, cross-origin forms, unsafe redirects, wrong verifier/audience and expired requests', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.register({ redirect_uris: ['http://evil.example/callback'] })).status, 400);
    assert.equal((await f.register({ redirect_uris: ['javascript:alert(1)'] })).status, 400);
    const a = await (await f.register()).json(), b = await (await f.register()).json();
    const auth = await f.authorize(a.client_id);
    assert.equal((await f.form('/oauth/consent', { request: auth.request, decision: 'allow' }, auth.cookie, 'https://evil.example')).status, 403);
    assert.equal((await f.form('/oauth/consent', { request: auth.request, decision: 'allow' })).status, 400);
    const denied = await f.form('/oauth/consent', { request: auth.request, decision: 'deny' }, auth.cookie);
    assert.equal(new URL(denied.headers.get('location')!).searchParams.get('error'), 'access_denied');
    assert.equal((await f.form('/oauth/consent', { request: auth.request, decision: 'allow' }, auth.cookie)).status, 400);
    const { code } = await f.code(a.client_id);
    assert.equal((await f.exchange(a.client_id, code, { code_verifier: 'x'.repeat(43) })).status, 400);
    assert.equal((await f.exchange(b.client_id, code)).status, 400);
    assert.equal((await f.exchange(a.client_id, code, { resource: 'https://other.example/mcp' })).status, 400);
    assert.equal((await f.exchange(a.client_id, code, { redirect_uri: 'https://other.example/callback' })).status, 400);
    assert.equal((await f.exchange(a.client_id, code)).status, 200);
    const wrongRedirect = await f.authorize(a.client_id, { redirect_uri: 'https://evil.example/callback' });
    assert.equal(wrongRedirect.response.status, 400); assert.equal(wrongRedirect.response.headers.has('location'), false);
    const wrongScope = await f.authorize(a.client_id, { scope: 'admin' });
    assert.equal(new URL(wrongScope.response.headers.get('location')!).searchParams.get('error'), 'invalid_scope');
    const pending = await f.authorize(a.client_id); f.advance(5 * 60_000);
    assert.equal((await f.form('/oauth/consent', { request: pending.request, decision: 'allow' }, pending.cookie)).status, 400);
    const expired = await f.code(a.client_id); f.advance(60_000);
    assert.equal((await f.exchange(a.client_id, expired.code)).status, 400);
  } finally { await f.close(); }
});

test('OAuth registered clients and grants persist across store restart', () => {
  const folder = mkdtempSync(join(tmpdir(), 'loop-oauth-'));
  try {
    const first = new OAuthStore(join(folder, 'oauth.sqlite'));
    first.put('client', 'registered-client', { client_id: 'registered-client' });
    first.put('grant', 'grant-id', { owner: 'guest-owner' }, 60_000); first.close();
    const second = new OAuthStore(join(folder, 'oauth.sqlite'));
    assert.deepEqual(second.get('client', 'registered-client'), { client_id: 'registered-client' });
    assert.deepEqual(second.get('grant', 'grant-id'), { owner: 'guest-owner' }); second.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
