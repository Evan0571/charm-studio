import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { SqliteStorage, storageFromEnvironment } from '../server/storage';
import { createDefaultConfig } from '../shared/catalog';

async function fixture() {
  const storage = new SqliteStorage(':memory:');
  const server = createApp(storage).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  function client() {
    let cookie = '';
    return async (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const data = response.status === 204 ? null : await response.json();
      return { status: response.status, data, headers: response.headers };
    };
  }
  return { storage, client, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); storage.close(); } };
}

test('saved drafts reload and another guest cannot read, update, or delete them', async () => {
  const f = await fixture();
  try {
    const alice = f.client(), bob = f.client();
    const saved = await alice('/api/designs', 'POST', { name: '我的青梨', config: createDefaultConfig('cord') });
    assert.equal(saved.status, 201);
    assert.match(saved.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(saved.headers.get('set-cookie')!, /SameSite=Lax/);
    assert.equal((await alice('/api/designs')).data[0].id, saved.data.id);
    assert.deepEqual((await bob('/api/designs')).data, []);
    assert.equal((await bob('/api/designs', 'POST', { id: saved.data.id, name: '入侵修改', config: createDefaultConfig('hero') })).status, 404);
    assert.equal((await bob(`/api/designs/${saved.data.id}`, 'DELETE')).status, 404);
    assert.equal((await alice('/api/designs')).data[0].name, '我的青梨');
    assert.equal((await alice(`/api/designs/${saved.data.id}`, 'DELETE')).status, 204);
    assert.deepEqual((await alice('/api/designs')).data, []);
  } finally { await f.close(); }
});

test('server ignores submitted totals, stores price snapshot, and makes concurrent checkout idempotent', async () => {
  const f = await fixture();
  try {
    const alice = f.client(), bob = f.client();
    await alice('/api/catalog'); // Establish the guest cookie before parallel requests.
    const config = createDefaultConfig('hero');
    const payload = { designName: '香蕉假日', config, idempotencyKey: 'checkout-123456', total: 1, quote: { total: 1 } };
    const results = await Promise.all([alice('/api/orders', 'POST', payload), alice('/api/orders', 'POST', payload)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
    assert.equal(results[0].data.id, results[1].data.id);
    assert.equal(results[0].data.quote.total, 84);
    assert.equal(results[0].data.status, 'test_confirmed');
    assert.equal((await alice('/api/orders')).data.length, 1);
    assert.deepEqual((await bob('/api/orders')).data, []);
    const changed = structuredClone(payload); changed.config.slots.main = 'orange';
    assert.equal((await alice('/api/orders', 'POST', changed)).status, 409);
    assert.equal((await bob('/api/orders', 'POST', payload)).status, 201);
  } finally { await f.close(); }
});

test('owner can save a complete design after unlocking, changing, and relocking a part', async () => {
  const f = await fixture();
  try {
    const client = f.client();
    const config = createDefaultConfig('hero'); config.lockedSlots = ['main'];
    const saved = await client('/api/designs', 'POST', { name: '锁定香蕉', config });
    config.lockedSlots = [];
    config.slots.main = 'pear';
    config.lockedSlots = ['main'];
    const updated = await client('/api/designs', 'POST', { id: saved.data.id, name: '改成青梨', config });
    assert.equal(updated.status, 200);
    const reloaded = (await client('/api/designs')).data[0];
    assert.equal(reloaded.config.slots.main, 'pear');
    assert.deepEqual(reloaded.config.lockedSlots, ['main']);
  } finally { await f.close(); }
});

test('rejects cross-site writes and invalid designs without creating orders', async () => {
  const f = await fixture();
  try {
    const client = f.client();
    const body = { name: '安全检查', config: createDefaultConfig('hero') };
    assert.equal((await client('/api/designs', 'POST', body, { origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await client('/api/designs', 'POST', body, { 'sec-fetch-site': 'cross-site' })).status, 403);
    const config = createDefaultConfig('hero'); config.slots.main = 'made-up';
    assert.equal((await client('/api/orders', 'POST', { config, idempotencyKey: 'invalid-order' })).status, 400);
    assert.deepEqual((await client('/api/orders')).data, []);
  } finally { await f.close(); }
});

test('health reports database readiness instead of only configured storage mode', async () => {
  const f = await fixture();
  try {
    const client = f.client();
    const healthy = await client('/api/health');
    assert.equal(healthy.status, 200);
    assert.deepEqual(healthy.data, { status: 'ok', storage: 'local' });
    f.storage.close();
    const unavailable = await client('/api/health');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.data.status, 'error');
    assert.equal(unavailable.data.storage, 'local');
    f.storage.close = () => {};
  } finally { await f.close(); }
});

test('SQLite data survives reopening the database file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-storage-'));
  const file = join(directory, 'studio.sqlite');
  const design = { id: '3b3e3f96-457d-400e-96ac-0389c93b547e', name: '持续保存', config: createDefaultConfig('chain'), createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' };
  try {
    const first = new SqliteStorage(file);
    await first.putDesign('test-owner', design); first.close();
    const reopened = new SqliteStorage(file);
    assert.deepEqual(await reopened.getDesign('test-owner', design.id), design);
    assert.equal(await reopened.getDesign('another-owner', design.id), undefined);
    reopened.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('partial cloud configuration fails instead of silently using local storage', () => {
  const originalUrl = process.env.SUPABASE_URL, originalKey = process.env.SUPABASE_SECRET_KEY;
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co'; delete process.env.SUPABASE_SECRET_KEY;
    assert.throws(() => storageFromEnvironment(), /Set both/);
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = originalKey;
  }
});
