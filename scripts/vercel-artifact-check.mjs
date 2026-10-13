// Plain Node, without tsx: verify the generated cloud entry is loadable and
// initializes with no local persistence or network activity.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = pathToFileURL(resolve('api/index.mjs'));
const originalDirectory = process.cwd(), temporary = await mkdtemp(join(tmpdir(), 'loop-vercel-entry-'));
Object.assign(process.env, {
  VERCEL: '1', VERCEL_ENV: 'production', MCP_PUBLIC_URL: 'https://loop-entry-check.example/mcp',
  MCP_TOKEN_SECRET: 'entry-check-only-secret-at-least-32-characters',
  SUPABASE_URL: 'https://entry-check.supabase.co', SUPABASE_SECRET_KEY: 'entry-check-only-placeholder',
  MCP_OAUTH_STORAGE: 'supabase',
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Cloud entry initialization must not call external services'); };
try {
  process.chdir(temporary);
  const { default: app } = await import(entry);
  assert.equal(typeof app, 'function');
  assert.equal(app.get('trust proxy'), 1);
  assert.deepEqual(await readdir(temporary), [], 'A cloud entry must not create local database or secret files');
  app.locals.closeMcp();
  console.log('PASS: built Vercel ESM entry imports in plain Node without network calls or filesystem writes.');
} finally {
  globalThis.fetch = originalFetch;
  process.chdir(originalDirectory);
  await rm(temporary, { recursive: true, force: true });
}
