// Run after pnpm build: exercise large MCP responses over local HTTP SSE.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createApp } from '../server/app.ts';
import { SqliteStorage } from '../server/storage.ts';

const widgetUri = 'ui://loop/design-v5.html';
const assetPath = '/assets/models/atelier-tote.glb';
const bufferedLimit = 4.5 * 1024 * 1024;
const disabled = { configured: () => false };
const unavailable = async () => { throw new Error('External providers are disabled for the streaming regression'); };
const storage = new SqliteStorage(':memory:');
const app = createApp(storage, { ...disabled, reply: unavailable }, {
  secret: 'isolated-streaming-check-secret-at-least-32-characters',
  oauthStorePath: ':memory:', streamResponses: true,
}, { ...disabled, button: unavailable, getCheckoutSession: unavailable, completeCheckoutSession: unavailable, getCharge: unavailable });
const server = app.listen(0, '127.0.0.1');
const client = new Client({ name: 'streaming-regression', version: '1.0.0' });
const originalFetch = globalThis.fetch;
try {
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, base, 'The streaming regression must not call external services');
    return originalFetch(input, init);
  };
  const issued = await fetch(`${base}/api/mcp/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(issued.status, 200);
  assert.ok(issued.headers.get('set-cookie')?.includes('loop_guest='));
  const { endpoint, token } = await issued.json();
  assert.equal(endpoint, `${base}/mcp`);
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }));
  assert.equal(client.getServerVersion()?.name, 'loop-charm-studio');

  async function streamed(id, method, params) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json',
        accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    assert.equal(response.headers.has('content-length'), false, 'Large MCP responses must be streamed');
    const wire = await response.text();
    assert.ok(Buffer.byteLength(wire) > bufferedLimit, 'The response must exceed the buffered deployment limit');
    const messages = wire.split(/\r?\n\r?\n/).flatMap(frame => {
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      return data ? [JSON.parse(data)] : [];
    });
    const replies = messages.filter(message => message.id === id);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].error, undefined);
    return replies[0].result;
  }

  const widget = await streamed('widget-check', 'resources/read', { uri: widgetUri });
  assert.equal(widget.contents.length, 1);
  const resource = widget.contents[0];
  assert.equal(resource.uri, widgetUri); assert.equal(resource.mimeType, RESOURCE_MIME_TYPE);
  assert.match(resource.text, /^<!doctype html>/i);
  assert.match(resource.text, /<div id="root"><\/div>/);
  assert.match(resource.text, /<\/body><\/html>$/);
  const [script, style] = await Promise.all([
    readFile('dist-mcp/loop-widget.js', 'utf8'), readFile('dist-mcp/loop-widget.css', 'utf8'),
  ]);
  assert.ok(resource.text.includes(`<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`), 'The entire built widget script must arrive');
  assert.ok(resource.text.includes(`<style>${style.replace(/<\/style/gi, '<\\/style')}</style>`), 'The entire built widget stylesheet must arrive');
  const sdkWidget = await client.readResource({ uri: widgetUri });
  assert.equal(sdkWidget.contents[0].text, resource.text, 'The official SDK must parse the same complete streamed resource');

  const asset = await streamed('asset-check', 'tools/call', { name: 'loop_get_preview_asset', arguments: { path: assetPath } });
  assert.equal(asset.isError, undefined); assert.equal(asset.structuredContent.path, assetPath);
  const bytes = Buffer.from(asset._meta.asset.base64, 'base64');
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(asset.structuredContent.byteLength, bytes.length);
  assert.ok(bytes.equals(await readFile(`public${assetPath}`)), 'The complete GLB must match the bundled model');
  console.log('PASS: full inline widget and large GLB stream over local HTTP SSE above 4.5 MiB, arrive intact, and the official SDK parses the widget. Memory-only storage; external providers disabled.');
} finally {
  await client.close();
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  app.locals.closeMcp(); storage.close();
  globalThis.fetch = originalFetch;
}
