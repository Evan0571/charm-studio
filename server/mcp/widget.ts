import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const WIDGET_URI = 'ui://loop/design-v1.html';
export function registerLoopWidget(server: McpServer, origin: string) {
  const meta = {
    ui: { prefersBorder: true, csp: { connectDomains: [origin], resourceDomains: [origin] } },
    'openai/widgetDescription': 'LOOP interactive bag-charm preview with exact USD pricing, part locks, save and explicit test-order confirmation.',
    'openai/widgetPrefersBorder': true,
    'openai/widgetCSP': { connect_domains: [origin], resource_domains: [origin] },
  };
  registerAppResource(server, 'LOOP design preview', WIDGET_URI, { _meta: meta }, async () => {
    let script: string, style: string;
    try { [script, style] = await Promise.all([readFile(resolve('dist-mcp/loop-widget.js'), 'utf8'), readFile(resolve('dist-mcp/loop-widget.css'), 'utf8')]); }
    catch { throw new Error('LOOP widget is not built. Run pnpm build:mcp-ui.'); }
    const config = JSON.stringify({ assetOrigin: origin }).replace(/</g, '\\u003c');
    const text = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOOP design preview</title><style>${style.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script>window.__LOOP_WIDGET__=${config};</script><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
    return { contents: [{ uri: WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text, _meta: meta }] };
  });
}
