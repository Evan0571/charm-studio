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
import type { OAuthPersistence } from '../server/mcp/oauth-store';
import { createLoopOAuth } from '../server/mcp/oauth';
import { createMcpTokens } from '../server/mcp/auth';
import { hash } from '../server/studio-service';
import { createDefaultConfig } from '../shared/catalog';

async function fixture(streamResponses = false) {
  const storage = new SqliteStorage(':memory:');
  let now = Date.now();
  const app = createApp(storage, { configured: () => false, reply: async () => { throw new Error('No model in OAuth tests'); } }, { secret: 'oauth-test-secret-at-least-32-characters', streamResponses, now: () => now });
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

for (const streaming of [false, true]) test(`first-use OAuth discovers tools, challenges without execution, and resumes after linking (streaming=${streaming})`, async () => {
  const f = await fixture(streaming);
  const anonymous = new Client({ name: 'unlinked-host', version: '1' });
  const linked = new Client({ name: 'linked-host', version: '1' });
  const refreshed = new Client({ name: 'refreshed-host', version: '1' });
  try {
    await anonymous.connect(new StreamableHTTPClientTransport(new URL(f.base + '/mcp')));
    const sdkTools = (await anonymous.listTools()).tools;
    // SDK 1.x strips unknown top-level fields while decoding tools. Check the
    // actual wire descriptor as well as the compatibility mirror it retains.
    const discovery = await fetch(f.base + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'first-discovery', method: 'tools/list', params: {} }) });
    assert.equal(discovery.status, 200);
    const wire = await discovery.text();
    const tools = JSON.parse(streaming ? wire.split('\n').find(line => line.startsWith('data: '))!.slice(6) : wire).result.tools as Array<(typeof sdkTools)[number] & { securitySchemes: unknown }>;
    assert.equal(tools.length, 11);
    for (const tool of tools) {
      const schemes = [{ type: 'oauth2', scopes: ['loop:studio'] }];
      assert.deepEqual(tool.securitySchemes, schemes);
      assert.deepEqual(tool._meta?.securitySchemes, schemes);
      assert.deepEqual(sdkTools.find(item => item.name === tool.name)?._meta?.securitySchemes, schemes);
      const blocked = await anonymous.callTool({ name: tool.name, arguments: {} });
      assert.equal(blocked.isError, true, `${tool.name} must request linking before input validation or execution`);
      const challenges = blocked._meta?.['mcp/www_authenticate'] as string[];
      assert.equal(challenges.length, 1);
      assert.ok(challenges[0].includes(`resource_metadata="${f.base}/.well-known/oauth-protected-resource/mcp"`));
      assert.match(challenges[0], /error="insufficient_scope"/);
      assert.match(challenges[0], /error_description="[^"]+"/);
      assert.equal(blocked.structuredContent, undefined, 'No catalog, private data, quote or checkout token is returned before linking');
    }
    const preview = tools.find(tool => tool.name === 'loop_preview_design')!;
    assert.equal((preview._meta?.ui as { resourceUri: string }).resourceUri, 'ui://loop/design-v5.html');
    const asset = tools.find(tool => tool.name === 'loop_get_preview_asset')!;
    assert.deepEqual((asset._meta?.ui as { visibility: string[] }).visibility, ['app']);
    assert.ok((await anonymous.listResources()).resources.some(resource => resource.uri === 'ui://loop/design-v5.html'));
    assert.ok((await anonymous.listPrompts()).prompts.some(prompt => prompt.name === 'design-bag-charm'));
    await anonymous.listResourceTemplates();
    // Public discovery must not open the resource/prompt execution surfaces.
    for (const [method, params] of [
      ['resources/read', { uri: 'loop://catalog' }],
      ['prompts/get', { name: 'design-bag-charm', arguments: { idea: 'test' } }],
    ]) {
      const denied = await fetch(f.base + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'protected-surface', method, params }) });
      assert.equal(denied.status, 401);
    }
    const registration = await f.register();
    assert.equal(registration.status, 201);
    const { client_id } = await registration.json();
    const { code, cookie } = await f.code(client_id);
    const exchange = await f.exchange(client_id, code);
    assert.equal(exchange.status, 200);
    const tokens = await exchange.json();
    await linked.connect(new StreamableHTTPClientTransport(new URL(f.base + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + tokens.access_token } } }));
    const designs = (await linked.callTool({ name: 'loop_list_designs', arguments: {} })).structuredContent as { designs: unknown[] };
    const orders = (await linked.callTool({ name: 'loop_list_orders', arguments: {} })).structuredContent as { orders: unknown[] };
    assert.deepEqual(designs.designs, [], 'Unlinked save attempts created no drafts');
    assert.deepEqual(orders.orders, [], 'Unlinked checkout attempts created no orders');
    const catalog = await linked.callTool({ name: 'loop_get_catalog', arguments: {} });
    assert.equal(catalog.isError, undefined);
    assert.equal((catalog.structuredContent as { catalog: { currency: string } }).catalog.currency, 'USD');
    const rendered = await linked.callTool({ name: 'loop_preview_design', arguments: { name: 'Linked preview', config: createDefaultConfig('hero') } });
    assert.equal(rendered.isError, undefined);
    // A linked identity can save, but the same unlinked host still cannot read it.
    assert.equal((await linked.callTool({ name: 'loop_save_design', arguments: { name: 'Private linked draft', config: createDefaultConfig('hero') } })).isError, undefined);
    assert.equal((await anonymous.callTool({ name: 'loop_list_designs', arguments: {} })).isError, true);
    const browserDrafts = await (await fetch(f.base + '/api/designs', { headers: { cookie } })).json();
    assert.equal(browserDrafts.length, 1);
    f.advance(60 * 60_000 + 1);
    const expired = await linked.callTool({ name: 'loop_get_catalog', arguments: {} });
    assert.equal(expired.isError, true);
    assert.match(String(expired._meta?.['mcp/www_authenticate']), /error="invalid_token"/);
    const refresh = await f.form('/token', { client_id, grant_type: 'refresh_token', refresh_token: tokens.refresh_token, resource: f.base + '/mcp' });
    assert.equal(refresh.status, 200);
    const renewed = await refresh.json();
    await refreshed.connect(new StreamableHTTPClientTransport(new URL(f.base + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + renewed.access_token } } }));
    assert.equal((await refreshed.callTool({ name: 'loop_get_catalog', arguments: {} })).isError, undefined);
    assert.equal((await f.form('/revoke', { client_id, token: renewed.refresh_token })).status, 200);
    const revoked = await refreshed.callTool({ name: 'loop_get_catalog', arguments: {} });
    assert.equal(revoked.isError, true);
    assert.match(String(revoked._meta?.['mcp/www_authenticate']), /error="invalid_token"/);
  } finally { await Promise.all([anonymous, linked, refreshed].map(client => client.close())); await f.close(); }
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

test('independent OAuth providers sharing asynchronous persistence accept a code and refresh token only once', async () => {
  const local = new OAuthStore();
  // Yield each read to expose races that the former synchronous store hid.
  const shared: OAuthPersistence = {
    get: async <T>(kind: string, id: string) => { const value = local.get<T>(kind, id); await new Promise(resolve => setTimeout(resolve, 5)); return value; },
    put: async (...args) => local.put(...args), remove: async (...args) => local.remove(...args),
    consume: async <T>(kind: string, id: string) => local.consume<T>(kind, id),
    checkHealth: () => local.checkHealth(), close: () => {},
  };
  const audience = 'https://loop.example/mcp', tokens = createMcpTokens('shared-instance-secret-at-least-32-characters');
  const a = createLoopOAuth(audience, tokens, shared).provider;
  const b = createLoopOAuth(audience, tokens, shared).provider;
  try {
    const client = (await a.clientsStore.registerClient!({ redirect_uris: ['https://chatgpt.com/callback'], token_endpoint_auth_method: 'none' }))!;
    assert.equal((await b.clientsStore.getClient(client.client_id))?.client_id, client.client_id);
    const code = 'single-use-code', grantId = 'shared-grant';
    local.put('code', hash(code), { owner: 'a'.repeat(64), clientId: client.client_id, grantId, params: { resource: audience, redirectUri: 'https://chatgpt.com/callback', codeChallenge: 'verified-by-sdk' } }, 60_000);
    const exchanges = await Promise.allSettled([a, b].map(provider => provider.exchangeAuthorizationCode(client, code, 'sdk-verified', 'https://chatgpt.com/callback', new URL(audience))));
    assert.equal(exchanges.filter(value => value.status === 'fulfilled').length, 1);
    const credentials = exchanges.find(value => value.status === 'fulfilled')!;
    assert.equal(credentials.status, 'fulfilled');
    if (credentials.status !== 'fulfilled') throw new Error('Missing credentials');
    assert.equal((await b.verifyAccessToken(credentials.value.access_token)).extra?.owner, 'a'.repeat(64));
    const refreshes = await Promise.allSettled([a, b].map(provider => provider.exchangeRefreshToken(client, credentials.value.refresh_token!, undefined, new URL(audience))));
    assert.equal(refreshes.filter(value => value.status === 'fulfilled').length, 1);
    const refreshed = refreshes.find(value => value.status === 'fulfilled')!;
    if (refreshed.status !== 'fulfilled') throw new Error('Missing refreshed credentials');
    await a.revokeToken!(client, { token: refreshed.value.refresh_token! });
    await assert.rejects(b.verifyAccessToken(refreshed.value.access_token));
  } finally { local.close(); }
});
