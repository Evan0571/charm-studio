// Development-only MCP Apps host. Never included in the production build.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const auth = await (await fetch('/api/mcp/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
const client = new Client({ name: 'LOOP local UI verification host', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(auth.endpoint), { requestInit: { headers: { Authorization: `Bearer ${auth.token}` } } }));
const catalog = (await client.callTool({ name: 'loop_get_catalog' })).structuredContent as any;
const args = { name: '珍珠与星光', config: catalog.examples.find((e: any) => e.config.templateId === 'hero').config };
const result = await client.callTool({ name: 'loop_preview_design', arguments: args }) as CallToolResult;
const resource = await client.readResource({ uri: 'ui://loop/design-v2.html' });
const content = resource.contents[0];
if (!('text' in content)) throw new Error('Missing widget HTML');
const frame = document.getElementById('widget') as HTMLIFrameElement;
const bridge = new AppBridge(client, { name: 'LOOP local verification host', version: '1.0.0' }, { serverTools: {}, serverResources: {}, updateModelContext: {}, logging: {} }, { hostContext: { theme: 'light', displayMode: 'inline', containerDimensions: { width: frame.clientWidth } } });
window.addEventListener('resize', () => bridge.setHostContext({ theme: 'light', displayMode: 'inline', containerDimensions: { width: frame.clientWidth } }));
const trace: unknown[] = [];
bridge.onupdatemodelcontext = async context => { trace.push(context); return {}; };
bridge.onsizechange = ({ height }) => { if (height) frame.style.height = `${height}px`; };
bridge.oninitialized = async () => { await bridge.sendToolInput({ arguments: args }); await bridge.sendToolResult(result); };
await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
// Apply an opaque-origin sandbox and a CSP representative of the host. All
// credentials remain in this parent; the component calls tools via AppBridge.
const csp = `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src ${location.origin} data: blob:; connect-src ${location.origin} data: blob:; font-src data:;`;
frame.srcdoc = content.text.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
Object.assign(window, { loopHarness: {
  trace, client, bridge,
  async chooseSlot(selectionSlot: string) {
    const latest = (trace.at(-1) as any)?.structuredContent ?? args;
    const result = await client.callTool({ name: 'loop_preview_design', arguments: { name: latest.name, config: latest.config, ...(latest.designId ? { designId: latest.designId } : {}), selectionSlot } }) as CallToolResult;
    await bridge.sendToolResult(result);
  },
  async revise() {
    const latest = (trace.at(-1) as any)?.structuredContent ?? args;
    const edited = { name: '银色版 · 保留主挂饰', config: { ...latest.config, metalTone: 'silver' }, ...(latest.designId ? { designId: latest.designId } : {}) };
    const revision = await client.callTool({ name: 'loop_preview_design', arguments: edited }) as CallToolResult;
    await bridge.sendToolResult(revision);
  },
} });
