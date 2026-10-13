import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createApp } from '../server/app';
import { SqliteStorage } from '../server/storage';
import { createMcpTokens, type McpOptions } from '../server/mcp/auth';
import type { StylistService } from '../server/stylist';
import { createDefaultConfig } from '../shared/catalog';
import { quoteConfig } from '../shared/domain';

const secret = 'test-only-mcp-secret-at-least-32-characters';
function rawPost(url: string, headers: Record<string, string>, body: string) {
  // Fetch's forbidden-header handling can replace Host; use raw HTTP for this check.
  return new Promise<number>((resolve, reject) => {
    const request = httpRequest(url, { method: 'POST', headers }, response => { response.resume(); response.on('end', () => resolve(response.statusCode!)); });
    request.on('error', reject); request.end(body);
  });
}
const stylist: StylistService = {
  configured: () => true,
  reply: async request => {
    const config = request.currentConfig ?? createDefaultConfig('hero');
    return { message: '测试搭配', suggestions: ['换成银色'], proposal: { name: '测试初稿', config, quote: quoteConfig(config), reasons: ['模拟 AI provider，仅用于测试。'] } };
  },
};
async function fixture(options: McpOptions = {}) {
  const storage = new SqliteStorage(':memory:');
  const server = createApp(storage, stylist, { secret, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const clients: Client[] = [];
  function browser() {
    let cookie = '';
    return async (path: string, body?: unknown) => {
      const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie')!.split(';')[0];
      return { response, data: await response.json() };
    };
  }
  async function connect(web = browser()) {
    const { data } = await web('/api/mcp/token', {});
    const client = new Client({ name: 'loop-integration-test', version: '1.0.0' }); clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(data.endpoint), { requestInit: { headers: { Authorization: `Bearer ${data.token}` } } }));
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args }) as CallToolResult;
      return { result, data: result.structuredContent as any };
    };
    return { client, call, web, token: data.token as string };
  }
  return { base, storage, browser, connect, close: async () => {
    await Promise.all(clients.map(client => client.close()));
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); storage.close();
  } };
}

test('real SDK negotiates 2025-11-25 and discovers tools, catalog resource and design prompt', async () => {
  const f = await fixture();
  try {
    const a = await f.connect();
    const response = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'version-check', version: '1' } } }) });
    const init = await response.json();
    assert.equal(init.result.protocolVersion, '2025-11-25');
    assert.equal(response.headers.has('mcp-session-id'), false);
    assert.equal(a.client.getServerVersion()?.name, 'loop-charm-studio');
    const tools = (await a.client.listTools()).tools;
    assert.equal(tools.length, 11);
    assert.deepEqual((tools.find(tool=>tool.name==='loop_get_preview_asset')?._meta?.ui as {visibility:string[]}).visibility,['app']);
    assert.ok(tools.every(tool => tool.inputSchema.type === 'object' && tool.inputSchema.additionalProperties === false));
    assert.equal(tools.find(tool => tool.name === 'loop_confirm_test_order')?.annotations?.readOnlyHint, false);
    const catalog = await a.call('loop_get_catalog');
    assert.equal(catalog.data.catalog.currency, 'USD');
    assert.equal(catalog.data.examples.length, 3);
    const resources = await a.client.listResources();
    assert.ok(resources.resources.some(resource => resource.uri === 'loop://catalog'));
    assert.ok(resources.resources.some(resource => resource.uri === 'ui://loop/design-v2.html'));
    assert.ok(resources.resources.some(resource => resource.uri === 'ui://loop/design-v1.html'));
    assert.equal((tools.find(tool => tool.name === 'loop_preview_design')?._meta?.ui as { resourceUri: string }).resourceUri, 'ui://loop/design-v5.html');
    assert.equal((tools.find(tool => tool.name === 'loop_get_preview_asset')?._meta?.ui as { resourceUri?: string }).resourceUri, undefined, 'Private asset reads must not try to render another widget');
    const preview = await a.call('loop_preview_design', { name: '对话内预览', config: createDefaultConfig('hero') });
    assert.equal(preview.data.quote.total, quoteConfig(createDefaultConfig('hero')).total);
    assert.equal(preview.data.catalog.currency, 'USD');
    for (const selectionSlot of ['main', 'accent']) {
      const options = await a.call('loop_preview_design', { name: '配件选择', config: createDefaultConfig('hero'), selectionSlot });
      assert.equal(options.result.isError, undefined);
      assert.equal(options.data.selectionSlot, selectionSlot);
      assert.deepEqual(options.data.config, createDefaultConfig('hero'));
    }
    const invalidSlot = await a.call('loop_preview_design', { name: '无效位置', config: createDefaultConfig('hero'), selectionSlot: 'left-bead' });
    assert.equal(invalidSlot.result.isError, true);
    assert.equal(invalidSlot.data.status, 400);
    assert.deepEqual((await a.web('/api/designs')).data, []);
    const resource = await a.client.readResource({ uri: 'loop://catalog' });
    assert.equal(JSON.parse((resource.contents[0] as { text: string }).text).parts.length, catalog.data.catalog.parts.length);
    assert.equal((await a.client.listPrompts()).prompts[0].name, 'design-bag-charm');
    assert.match(JSON.stringify(await a.client.getPrompt({ name: 'design-bag-charm', arguments: { idea: '复古棕色' } })), /复古棕色/);
  } finally { await f.close(); }
});

test('Vercel streaming delivers large bag assets, then completes save and checkout', async () => {
  const f = await fixture({ streamResponses: true });
  try {
    const a = await f.connect();
    const response = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'loop_get_preview_asset', arguments: { path: '/assets/models/atelier-tote.glb' } } }) });
    assert.match(response.headers.get('content-type')!, /text\/event-stream/);
    assert.equal(response.headers.has('content-length'), false, 'Large resources must use a streamed response');
    const wire = await response.text();
    assert.ok(Buffer.byteLength(wire) > 4.5 * 1024 * 1024, 'The check must exercise a response above the buffered Vercel limit');
    const rpc = JSON.parse(wire.split('\n').find(line => line.startsWith('data: '))!.slice(6));
    assert.equal(rpc.result.structuredContent.path, '/assets/models/atelier-tote.glb');
    assert.equal(Buffer.from(rpc.result._meta.asset.base64, 'base64').subarray(0, 4).toString(), 'glTF');
    const bag = await a.client.callTool({ name: 'loop_get_preview_asset', arguments: { path: '/assets/models/atelier-tote.glb' } }) as CallToolResult;
    assert.equal(bag.isError, undefined);
    assert.equal(Buffer.from((bag._meta?.asset as { base64: string }).base64, 'base64').subarray(0, 4).toString(), 'glTF');
    assert.ok(Buffer.byteLength(JSON.stringify(bag)) > 4.5 * 1024 * 1024);
    const config = createDefaultConfig('hero');
    const saved = await a.call('loop_save_design', { name: 'Streaming deployment', config });
    assert.ok(saved.data.design.id);
    const prepared = await a.call('loop_prepare_test_order', { designName: 'Streaming deployment', config });
    assert.equal((await a.web('/api/orders')).data.length, 0);
    const confirmed = await a.call('loop_confirm_test_order', { confirmationToken: prepared.data.confirmationToken, confirmed: true });
    assert.equal(confirmed.result.isError, undefined);
    assert.equal((await a.web('/api/orders')).data.length, 1);
  } finally { await f.close(); }
});

test('browser and MCP share persisted designs while other identities cannot read or overwrite them', async () => {
  const f = await fixture();
  try {
    const a = await f.connect(), b = await f.connect();
    const config = createDefaultConfig('hero');
    const saved = await a.call('loop_save_design', { name: 'MCP 初稿', config });
    assert.equal(saved.result.isError, undefined);
    const id = saved.data.design.id;
    assert.equal((await a.web('/api/designs')).data[0].id, id);
    assert.equal((await a.call('loop_get_design', { id })).data.quote.total, quoteConfig(config).total);
    assert.equal((await b.call('loop_get_design', { id })).data.status, 404);
    assert.equal((await b.call('loop_save_design', { id, name: 'Not owned', config })).data.status, 404);
    assert.deepEqual((await b.call('loop_list_designs')).data.designs, []);
    config.slots.main = 'pear';
    await a.web('/api/designs', { id, name: '网页修改', config });
    assert.equal((await a.call('loop_get_design', { id })).data.design.config.slots.main, 'pear');
    assert.equal((await a.call('loop_list_designs', { offset: 1, limit: 1 })).data.designs.length, 0);
    assert.equal((await a.call('loop_list_designs')).data.total, 1);
  } finally { await f.close(); }
});

test('prepared checkout has no writes; explicit confirmation is bound to owner/config and concurrent retries create one order', async () => {
  const f = await fixture();
  try {
    const a = await f.connect(), b = await f.connect();
    const config = createDefaultConfig('hero');
    const prepared = await a.call('loop_prepare_test_order', { designName: '确认这版', config });
    assert.deepEqual((await a.web('/api/orders')).data, []);
    assert.equal(prepared.data.quote.total, quoteConfig(config).total);
    const confirmationToken = prepared.data.confirmationToken;
    assert.equal((await b.call('loop_confirm_test_order', { confirmationToken, confirmed: true })).data.status, 404);
    assert.equal((await a.call('loop_confirm_test_order', { confirmationToken, confirmed: false })).result.isError, true);
    assert.equal((await a.call('loop_confirm_test_order', { confirmationToken, confirmed: true, config: { ...config, metalTone: 'silver' } })).result.isError, true);
    assert.deepEqual((await a.web('/api/orders')).data, []);
    const orders = await Promise.all([a.call('loop_confirm_test_order', { confirmationToken, confirmed: true }), a.call('loop_confirm_test_order', { confirmationToken, confirmed: true })]);
    assert.equal(orders[0].data.order.id, orders[1].data.order.id);
    assert.deepEqual(orders[0].data.order.config, config);
    assert.equal(orders[0].data.order.status, 'test_confirmed');
    assert.equal((await a.web('/api/orders')).data.length, 1);
    assert.equal((await a.call('loop_list_orders')).data.total, 1);
    assert.equal((await b.call('loop_list_orders')).data.total, 0);
  } finally { await f.close(); }
});

test('rejects forged, expired and wrong-purpose credentials and checkout tickets', async () => {
  let now = Date.now();
  const f = await fixture({ now: () => now });
  try {
    const a = await f.connect();
    const prepared = await a.call('loop_prepare_test_order', { designName: '时效检查', config: createDefaultConfig('hero') });
    const ticket = prepared.data.confirmationToken as string;
    const forged = ticket.slice(0, -1) + (ticket.endsWith('a') ? 'b' : 'a');
    assert.equal((await a.call('loop_confirm_test_order', { confirmationToken: forged, confirmed: true })).result.isError, true);
    assert.equal((await a.call('loop_confirm_test_order', { confirmationToken: a.token, confirmed: true })).result.isError, true);
    const response = await fetch(`${f.base}/mcp`, { headers: { Authorization: `Bearer ${ticket}` } });
    assert.equal(response.status, 401);
    now += 10 * 60_000;
    assert.equal((await a.call('loop_confirm_test_order', { confirmationToken: ticket, confirmed: true })).result.isError, true);
    assert.deepEqual((await a.web('/api/orders')).data, []);
    now += 24 * 60 * 60_000;
    assert.equal((await fetch(`${f.base}/mcp`, { headers: { Authorization: `Bearer ${a.token}` } })).status, 401);
    const tokens = createMcpTokens(secret);
    const token = tokens.issue('access', 'a'.repeat(64), 'https://one.example/mcp', 1000).token;
    assert.throws(() => tokens.verify(token, 'access', 'https://two.example/mcp'));
    assert.equal(createMcpTokens(secret).verify(token, 'access', 'https://one.example/mcp').owner, 'a'.repeat(64));
    assert.throws(() => createMcpTokens('different-secret-that-is-also-over-32-characters').verify(token, 'access', 'https://one.example/mcp'));
  } finally { await f.close(); }
});

test('rejects incompatible catalog configurations and forged prices before writing', async () => {
  const f = await fixture();
  try {
    const a = await f.connect();
    const config = createDefaultConfig('hero'); config.slots.main = 'made-up';
    for (const name of ['loop_quote_design', 'loop_save_design', 'loop_prepare_test_order']) {
      const result = await a.call(name, { config, ...(name === 'loop_save_design' ? { name: '无效' } : name === 'loop_prepare_test_order' ? { designName: '无效' } : {}) });
      assert.equal(result.result.isError, true);
    }
    assert.equal((await a.call('loop_prepare_test_order', { config: createDefaultConfig('hero'), designName: '伪造价格', total: 0 })).result.isError, true);
    assert.equal((await a.call('loop_list_designs', { owner: 'other-owner' })).result.isError, true);
    assert.deepEqual((await a.web('/api/orders')).data, []);
    assert.deepEqual((await a.web('/api/designs')).data, []);
  } finally { await f.close(); }
});

test('AI tool reuses the provider, locked configuration and the shared REST/MCP rate limit', async () => {
  const f = await fixture();
  try {
    const a = await f.connect();
    const config = createDefaultConfig('hero'); config.lockedSlots = ['main'];
    const args = { messages: [{ role: 'user', content: '保留主挂饰' }], currentConfig: config };
    const ai = await a.call('loop_suggest_design', args);
    assert.deepEqual(ai.data.proposal.config, config);
    assert.deepEqual((await a.web('/api/designs')).data, []);
    for (let i = 0; i < 5; i++) assert.equal((await a.web('/api/ai/design', args)).response.status, 200);
    assert.equal((await a.call('loop_suggest_design', args)).data.status, 429);
    assert.equal((await a.web('/api/ai/design', args)).response.status, 429);
    const b = await f.connect();
    assert.equal((await b.call('loop_suggest_design', args)).result.isError, undefined);
  } finally { await f.close(); }
});

test('MCP HTTP validates Host, Origin, content type, protocol version, JSON size and bearer identity', async () => {
  const f = await fixture();
  try {
    const a = await f.connect();
    const headers = { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    const body = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body })).status, 403);
    assert.equal(await rawPost(`${f.base}/mcp`, { ...headers, Host: 'evil.example' }, body), 403);
    assert.equal(await rawPost(`${f.base}/api/mcp/token`, { ...headers, Host: 'evil.example' }, '{}'), 403);
    assert.equal((await fetch(`${f.base}/api/mcp/token`, { method: 'POST', headers: { ...headers, Origin: 'null' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: headers.Accept }, body })).status, 401);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body })).status, 415);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers: { ...headers, 'MCP-Protocol-Version': '1900-01-01' }, body })).status, 400);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers, body: '{' })).status, 400);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers, body: JSON.stringify({ text: 'a'.repeat(50000) }) })).status, 413);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'GET', headers })).status, 405);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'DELETE', headers })).status, 405);
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers: { ...headers, Origin: f.base }, body })).status, 200);
  } finally { await f.close(); }
});
