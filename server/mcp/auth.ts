import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ValidationError } from '../../shared/domain';

type Envelope = { purpose: string; owner: string; audience: string; expiresAt: number; data: Record<string, unknown> };
export interface McpOptions { secret?: string; publicUrl?: string; oauthStorePath?: string; now?: () => number; }

export function createMcpTokens(secret = randomBytes(32).toString('hex'), now = Date.now) {
  if (secret.length < 32) throw new Error('MCP_TOKEN_SECRET must contain at least 32 characters.');
  const sign = (value: string) => createHmac('sha256', secret).update(value).digest('base64url');
  return {
    issue(purpose: string, owner: string, audience: string, ttlMs: number, data: Record<string, unknown> = {}) {
      const expiresAt = now() + ttlMs;
      const payload = Buffer.from(JSON.stringify({ purpose, owner, audience, expiresAt, data })).toString('base64url');
      return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt).toISOString() };
    },
    verify(token: string, purpose: string, audience: string): Envelope {
      try {
        if (token.length > 12000) throw new Error();
        const [payload, signature, extra] = token.split('.');
        const expected = Buffer.from(sign(payload ?? '')), actual = Buffer.from(signature ?? '');
        if (extra !== undefined || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
        const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Envelope;
        if (value.purpose !== purpose || value.audience !== audience || !/^[a-f0-9]{64}$/.test(value.owner) || !Number.isFinite(value.expiresAt) || value.expiresAt <= now() || !value.data || typeof value.data !== 'object') throw new Error();
        return value;
      } catch { throw new ValidationError(purpose === 'access' ? 'MCP 连接凭证无效或已过期，请在演示页面重新连接。' : '订单确认已过期或无效，请重新获取报价并确认。', purpose === 'access' ? 401 : 400); }
    },
  };
}
export type McpTokens = ReturnType<typeof createMcpTokens>;

export function mcpOptionsFromEnvironment(): McpOptions {
  const publicUrl = process.env.MCP_PUBLIC_URL?.trim() || undefined;
  let secret = process.env.MCP_TOKEN_SECRET?.trim();
  if (publicUrl && !secret) throw new Error('Set MCP_TOKEN_SECRET when using MCP_PUBLIC_URL.');
  if (!secret) {
    const path = resolve('.data/mcp-token-secret');
    mkdirSync(dirname(path), { recursive: true });
    try { writeFileSync(path, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    secret = readFileSync(path, 'utf8').trim();
  }
  return { secret, publicUrl, oauthStorePath: resolve('.data/mcp-oauth.sqlite') };
}
