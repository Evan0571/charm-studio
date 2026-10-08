import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type McpTrace = { id: number; method: string; state: 'pending' | 'ok' | 'error'; elapsedMs?: number };

// This is an actual MCP client: all domain operations go over Streamable HTTP.
// The one REST call only exchanges this browser's guest identity for a scoped token.
export class LoopMcpClient {
  private client = new Client({ name: 'loop-web-simulator', version: '0.1.0' });
  private counter = 0;
  private credential?: { token: string; endpoint: string; expiresAt: string };
  constructor(private trace: (entry: McpTrace) => void) {}
  private async traced<T>(method: string, operation: () => Promise<T>): Promise<T> {
    const id = ++this.counter, started = performance.now();
    this.trace({ id, method, state: 'pending' });
    try {
      const result = await operation();
      this.trace({ id, method, state: 'ok', elapsedMs: Math.round(performance.now() - started) });
      return result;
    } catch (error) {
      this.trace({ id, method, state: 'error', elapsedMs: Math.round(performance.now() - started) });
      throw error;
    }
  }
  async connect() {
    const response = await fetch('/api/mcp/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? '无法建立 MCP 连接。');
    this.credential = data;
    await this.traced('initialize', () => this.client.connect(new StreamableHTTPClientTransport(new URL(data.endpoint), { requestInit: { headers: { Authorization: `Bearer ${data.token}` } } })));
    const tools = await this.traced('tools/list', () => this.client.listTools());
    return tools.tools;
  }
  async call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.traced(`tools/call · ${name}`, async () => {
      const result = await this.client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 }) as CallToolResult;
      const text = result.content.find(item => item.type === 'text');
      const value = result.structuredContent ?? (text?.type === 'text' ? JSON.parse(text.text) : undefined);
      if (result.isError) throw new Error(value?.error ?? 'MCP 工具调用失败。');
      if (!value) throw new Error('MCP 工具没有返回可用结果。');
      return value as T;
    });
  }
  connectionInfo() { return this.credential; }
  async close() { this.credential = undefined; await this.client.close(); }
}
