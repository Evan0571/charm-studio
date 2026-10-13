import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpOptionsFromEnvironment } from '../server/mcp/auth';
import { SupabaseOAuthStore } from '../server/mcp/oauth-store';
import { createVercelApp } from '../server/vercel';

test('Vercel refuses local persistence or transient secrets and isolates preview authorization', () => {
  const keys = ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'MCP_PUBLIC_URL', 'MCP_TOKEN_SECRET', 'MCP_OAUTH_STORAGE', 'MCP_HTTP_STREAMING', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'loop.example' });
    assert.throws(() => mcpOptionsFromEnvironment(), /Supabase|SUPABASE/);
    assert.throws(() => createVercelApp(), /Supabase|SUPABASE/, 'The production entry must fail before attempting local filesystem storage');
    Object.assign(process.env, { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'test-server-key' });
    assert.throws(() => mcpOptionsFromEnvironment(), /MCP_TOKEN_SECRET/);
    process.env.MCP_TOKEN_SECRET = 'test-stable-secret-at-least-32-characters';
    process.env.MCP_OAUTH_STORAGE = 'sqlite';
    assert.throws(() => mcpOptionsFromEnvironment(), /supabase on Vercel/);
    delete process.env.MCP_OAUTH_STORAGE;
    const production = mcpOptionsFromEnvironment();
    assert.equal(production.publicUrl, 'https://loop.example/mcp');
    assert.ok(production.oauthStore instanceof SupabaseOAuthStore);
    assert.equal(production.oauthStorePath, undefined);
    assert.equal(production.streamResponses, true);
    Object.assign(process.env, { VERCEL_ENV: 'preview', VERCEL_URL: 'loop-preview.example' });
    assert.equal(mcpOptionsFromEnvironment().publicUrl, 'https://loop-preview.example/mcp');
    process.env.MCP_PUBLIC_URL = 'https://custom-loop.example/mcp';
    assert.equal(mcpOptionsFromEnvironment().publicUrl, 'https://custom-loop.example/mcp');
  } finally {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
