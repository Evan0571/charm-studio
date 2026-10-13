import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDefaultConfig } from '../shared/catalog';
import type { Order } from '../shared/types';
import { SqliteStorage, SupabaseStorage } from '../server/storage';

function pendingOrder(): Order {
  return {
    id: randomUUID(), designName: 'Amazon Pay sandbox', config: createDefaultConfig('hero'),
    quote: { lines: [], total: 13, currency: 'USD' }, status: 'sandbox_pending',
    createdAt: '2026-10-13T00:00:00.000Z',
    payment: { provider: 'amazon_pay', environment: 'sandbox', updatedAt: '2026-10-13T00:00:00.000Z' },
  };
}

test('payment storage scopes order reads, session binding, and status updates to the owner', async () => {
  const storage = new SqliteStorage(':memory:');
  const order = pendingOrder();
  try {
    await storage.createOrder('alice', 'sandbox-checkout', 'hash', order);
    assert.equal(await storage.getOrder('bob', order.id), undefined);
    assert.equal(await storage.claimAmazonPaySession('bob', order.id, 'S01-other'), undefined);
    const bound = await storage.claimAmazonPaySession('alice', order.id, 'S01-alice');
    assert.equal(bound?.payment?.checkoutSessionId, 'S01-alice');
    assert.equal(await storage.updateAmazonPayOrder('bob', order.id, 'S01-alice', 'sandbox_paid', 'charge'), undefined);
    assert.equal(await storage.updateAmazonPayOrder('alice', order.id, 'S01-other', 'sandbox_paid', 'charge'), undefined);
    assert.deepEqual(await storage.getOrder('alice', order.id), bound);
  } finally { storage.close(); }
});

test('two SQLite connections bind only one Amazon Pay session and permit exact retries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-payment-race-'));
  const path = join(directory, 'orders.sqlite');
  const first = new SqliteStorage(path), second = new SqliteStorage(path);
  const order = pendingOrder();
  try {
    await first.createOrder('alice', 'sandbox-checkout', 'hash', order);
    const results = await Promise.all([
      first.claimAmazonPaySession('alice', order.id, 'S01-first'),
      second.claimAmazonPaySession('alice', order.id, 'S01-second'),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const winner = results.find(Boolean)!;
    assert.deepEqual(await second.claimAmazonPaySession('alice', order.id, winner.payment!.checkoutSessionId!), winner);
    assert.equal(await first.claimAmazonPaySession('alice', order.id, ''), undefined);
  } finally {
    first.close(); second.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('paid orders survive failure/cancel races and payment retries do not rewrite timestamps or charges', async () => {
  const storage = new SqliteStorage(':memory:');
  const order = pendingOrder();
  try {
    await storage.createOrder('alice', 'sandbox-checkout', 'hash', order);
    await storage.claimAmazonPaySession('alice', order.id, 'S01-first');
    const [paid, delayedFailure] = await Promise.all([
      storage.updateAmazonPayOrder('alice', order.id, 'S01-first', 'sandbox_paid', 'charge-first'),
      storage.updateAmazonPayOrder('alice', order.id, 'S01-first', 'sandbox_failed'),
    ]);
    assert.equal(paid?.status, 'sandbox_paid');
    assert.equal(paid?.payment?.chargeId, 'charge-first');
    assert.equal(delayedFailure, undefined);
    assert.equal(await storage.updateAmazonPayOrder('alice', order.id, 'S01-first', 'sandbox_failed'), undefined);
    assert.equal(await storage.updateAmazonPayOrder('alice', order.id, 'S01-first', 'sandbox_canceled'), undefined);
    assert.deepEqual(await storage.updateAmazonPayOrder('alice', order.id, 'S01-first', 'sandbox_paid', 'replacement-charge'), paid);
    assert.deepEqual(await storage.claimAmazonPaySession('alice', order.id, 'S01-first'), paid);
    assert.deepEqual((await storage.getOrderByKey('alice', 'sandbox-checkout'))?.order, paid);
  } finally { storage.close(); }
});

test('SQLite reopening preserves both legacy orders and Amazon Pay payment state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-payment-reopen-'));
  const path = join(directory, 'orders.sqlite');
  const legacy = pendingOrder(); legacy.status = 'test_confirmed'; delete legacy.payment;
  const sandbox = pendingOrder();
  let storage = new SqliteStorage(path);
  try {
    await storage.createOrder('alice', 'legacy-checkout', 'legacy-hash', legacy);
    await storage.createOrder('alice', 'sandbox-checkout', 'sandbox-hash', sandbox);
    await storage.claimAmazonPaySession('alice', sandbox.id, 'S01-first');
    const paid = await storage.updateAmazonPayOrder('alice', sandbox.id, 'S01-first', 'sandbox_paid', 'charge-first');
    storage.close(); storage = new SqliteStorage(path);
    assert.deepEqual(await storage.getOrder('alice', legacy.id), legacy);
    assert.deepEqual(await storage.getOrderByKey('alice', 'legacy-checkout'), { order: legacy, requestHash: 'legacy-hash' });
    assert.equal(await storage.claimAmazonPaySession('alice', legacy.id, 'S01-first'), undefined);
    assert.equal(await storage.updateAmazonPayOrder('alice', legacy.id, 'S01-first', 'sandbox_paid'), undefined);
    assert.deepEqual(await storage.getOrder('alice', sandbox.id), paid);
    assert.equal((await storage.listOrders('alice')).length, 2);
  } finally { storage.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Supabase requests enforce owner, session, provider, sandbox, and paid guards', async t => {
  const order = pendingOrder();
  let row: Record<string, unknown> = {
    id: order.id, owner_id: 'alice', design_name: order.designName, config: order.config,
    quote: order.quote, status: order.status, created_at: order.createdAt, request_hash: 'hash', payment: order.payment,
  };
  const patches: { query: URLSearchParams; body: Record<string, unknown> }[] = [];
  const reads: URLSearchParams[] = [];
  function value(field: string): unknown {
    if (field.startsWith('payment->>')) return (row.payment as Record<string, unknown> | null)?.[field.slice('payment->>'.length)];
    return row[field];
  }
  function matches(query: URLSearchParams): boolean {
    for (const [field, condition] of query) {
      if (field === 'select') continue;
      const [operator, ...pieces] = condition.split('.');
      const expected = pieces.join('.');
      const actual = value(field);
      if (operator === 'eq' && actual !== expected) return false;
      if (operator === 'neq' && actual === expected) return false;
      if (operator === 'is' && expected === 'null' && actual != null) return false;
    }
    return true;
  }
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const requestUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(requestUrl.pathname, '/rest/v1/charm_orders');
    const query = requestUrl.searchParams;
    assert.equal(query.get('id'), `eq.${order.id}`);
    assert.match(query.get('owner_id')!, /^eq\.(alice|bob)$/);
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      patches.push({ query, body });
      assert.equal(query.get('payment->>provider'), 'eq.amazon_pay');
      assert.equal(query.get('payment->>environment'), 'eq.sandbox');
      if (matches(query)) { row = { ...row, ...body }; return Response.json(row); }
      return Response.json({ code: 'PGRST116', details: 'The result contains 0 rows', message: 'Cannot coerce the result to a single JSON object' }, { status: 406 });
    }
    reads.push(query);
    return Response.json(matches(query) ? [row] : []);
  });
  const storage = new SupabaseStorage('https://storage-contract.supabase.co', 'server-test-key');
  assert.equal(await storage.getOrder('bob', order.id), undefined);
  assert.equal(await storage.claimAmazonPaySession('bob', order.id, 'S01-other'), undefined);
  const results = await Promise.all([
    storage.claimAmazonPaySession('alice', order.id, 'S01-first'),
    storage.claimAmazonPaySession('alice', order.id, 'S01-second'),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(patches.filter(patch => patch.query.get('payment->>checkoutSessionId') === 'is.null').length, 2);
  const bound = results.find(Boolean)!;
  const session = bound.payment!.checkoutSessionId!;
  assert.deepEqual(await storage.claimAmazonPaySession('alice', order.id, session), bound);
  assert.equal(await storage.updateAmazonPayOrder('bob', order.id, session, 'sandbox_paid'), undefined);
  assert.equal(await storage.updateAmazonPayOrder('alice', order.id, 'S01-other', 'sandbox_paid'), undefined);
  const [paid, delayedFailure] = await Promise.all([
    storage.updateAmazonPayOrder('alice', order.id, session, 'sandbox_paid', 'charge-first'),
    storage.updateAmazonPayOrder('alice', order.id, session, 'sandbox_failed'),
  ]);
  assert.equal(delayedFailure, undefined);
  assert.equal(paid?.status, 'sandbox_paid');
  const statusPatch = patches.find(patch => patch.body.status === 'sandbox_paid')!;
  assert.equal(statusPatch.query.get('payment->>checkoutSessionId'), `eq.${session}`);
  assert.ok(statusPatch.query.getAll('status').includes('neq.sandbox_paid'));
  assert.deepEqual(await storage.updateAmazonPayOrder('alice', order.id, session, 'sandbox_paid', 'replacement-charge'), paid);
  assert.equal(await storage.updateAmazonPayOrder('alice', order.id, session, 'sandbox_failed'), undefined);
  assert.equal(await storage.updateAmazonPayOrder('alice', order.id, session, 'sandbox_canceled'), undefined);
  assert.equal(patches.length, 4);
  assert.ok(reads.every(query => query.get('select')?.includes('payment')));
  row = { ...row, status: 'test_confirmed', payment: null };
  const legacy = await storage.getOrder('alice', order.id);
  assert.equal(legacy?.status, 'test_confirmed');
  assert.equal(Object.hasOwn(legacy!, 'payment'), false);
});
