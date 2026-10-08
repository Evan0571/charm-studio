// A deterministic, isolated real-MCP round trip. No AI calls or persistent writes.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../server/app.ts';
import { SqliteStorage } from '../server/storage.ts';

const storage = new SqliteStorage(':memory:');
const server = createApp(storage, { configured: () => false, reply: async () => { throw new Error('AI is disabled in the smoke check'); } }).listen(0, '127.0.0.1');
const client = new Client({ name: 'loop-smoke-client', version: '0.1.0' });
try {
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = await fetch(`${base}/api/mcp/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const connection = await auth.json();
  await client.connect(new StreamableHTTPClientTransport(new URL(connection.endpoint), { requestInit: { headers: { Authorization: `Bearer ${connection.token}` } } }));
  const tools = await client.listTools();
  console.log(`Connected to ${client.getServerVersion().name}; discovered ${tools.tools.length} tools.`);
  async function call(name, args = {}) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, JSON.stringify(result.structuredContent));
    console.log(`OK ${name}`);
    return result.structuredContent;
  }
  const catalog = await call('loop_get_catalog');
  const config = catalog.examples.find(example => example.config.templateId === 'hero').config;
  const saved = await call('loop_save_design', { name: 'MCP smoke design', config });
  const drafts = await (await fetch(`${base}/api/designs`, { headers: { cookie } })).json();
  assert.equal(drafts[0].id, saved.design.id);
  const prepared = await call('loop_prepare_test_order', { designName: saved.design.name, config });
  assert.equal((await call('loop_list_orders')).total, 0);
  const args = { confirmationToken: prepared.confirmationToken, confirmed: true };
  const first = await call('loop_confirm_test_order', args);
  const retry = await call('loop_confirm_test_order', args);
  assert.equal(first.order.id, retry.order.id);
  assert.equal((await call('loop_list_orders')).total, 1);
  console.log('PASS: MCP → saved design visible via REST → prepared quote → one confirmed test order after retry. Storage was temporary; no API credits used.');
} finally {
  await client.close(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve)); storage.close();
}
