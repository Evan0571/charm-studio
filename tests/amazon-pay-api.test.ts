import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { SqliteStorage } from '../server/storage';
import type { AmazonPayProvider, AmazonPayCheckoutSession, AmazonPayCharge } from '../server/amazon-pay';
import type { AmazonPayButtonConfig } from '../shared/amazon-pay';
import type { Order } from '../shared/types';
import { createDefaultConfig } from '../shared/catalog';
import { quoteConfig, ValidationError } from '../shared/domain';

const paymentPath = '/api/payments/amazon-pay';
const body = (key = 'sandbox-checkout-12345') => ({
  designName: 'Sandbox banana', config: createDefaultConfig('hero'), idempotencyKey: key,
  total: 0.01, quote: { total: 0.01, currency: 'CNY' },
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

class FakeAmazonPay implements AmazonPayProvider {
  enabled = true;
  buttonOrders: Order[] = [];
  sessionReads: string[] = [];
  chargeReads: string[] = [];
  captures: { sessionId: string; amount: string; idempotencyKey: string }[] = [];
  sessions = new Map<string, AmazonPayCheckoutSession>();
  charges = new Map<string, AmazonPayCharge>();
  readFailuresAfterCapture = 0;
  captureGate?: ReturnType<typeof deferred>;
  captureEntered = deferred();
  configured() { return this.enabled; }
  async button(order: Order): Promise<AmazonPayButtonConfig> {
    this.buttonOrders.push(structuredClone(order));
    return {
      merchantId: 'sandbox-merchant', publicKeyId: 'SANDBOX-EXAMPLEKEY', ledgerCurrency: 'USD',
      checkoutLanguage: 'en_US', productType: 'PayOnly', placement: 'Checkout', buttonColor: 'Gold', sandbox: true,
      createCheckoutSessionConfig: {
        payloadJSON: JSON.stringify({
          storeId: 'sandbox-store', chargePermissionType: 'OneTime',
          webCheckoutDetails: { checkoutMode: 'ProcessOrder' }, merchantMetadata: { merchantReferenceId: order.id },
          paymentDetails: { paymentIntent: 'AuthorizeWithCapture', canHandlePendingAuthorization: false, chargeAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' } },
        }),
        signature: 'sandbox-test-signature', algorithm: 'AMZN-PAY-RSASSA-PSS-V2',
      },
    };
  }
  addSession(order: Order, id = 'S01-checkout', state = 'Open') {
    const chargeId = `charge-${id}`, permission = `permission-${id}`;
    const session: AmazonPayCheckoutSession = {
      checkoutSessionId: id, statusDetails: { state, ...(state === 'Canceled' ? { reasonCode: 'BuyerCanceled' } : {}) }, releaseEnvironment: 'Sandbox',
      productType: 'PayOnly', chargePermissionType: 'OneTime',
      paymentDetails: { paymentIntent: 'AuthorizeWithCapture', chargeAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' } },
      merchantMetadata: { merchantReferenceId: order.id }, webCheckoutDetails: { checkoutMode: 'ProcessOrder' },
      chargeId: state === 'Completed' ? chargeId : null, chargePermissionId: permission,
    };
    this.sessions.set(id, session);
    this.charges.set(chargeId, {
      chargeId, chargePermissionId: permission, releaseEnvironment: 'Sandbox', statusDetails: { state: 'Captured' },
      chargeAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' },
      captureAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' },
    });
    return session;
  }
  async getCheckoutSession(id: string) {
    this.sessionReads.push(id);
    if (this.captures.length && this.readFailuresAfterCapture > 0) {
      this.readFailuresAfterCapture--;
      throw new ValidationError('Temporary sandbox read failure.', 502);
    }
    const session = this.sessions.get(id);
    assert.ok(session, `Missing fake session ${id}`);
    return structuredClone(session);
  }
  async completeCheckoutSession(id: string, amount: string, idempotencyKey: string) {
    this.captures.push({ sessionId: id, amount, idempotencyKey });
    this.captureEntered.resolve();
    if (this.captureGate) await this.captureGate.promise;
    const session = this.sessions.get(id)!;
    session.statusDetails.state = 'Completed'; session.chargeId = `charge-${id}`;
    return structuredClone(session);
  }
  async getCharge(id: string) {
    this.chargeReads.push(id);
    const charge = this.charges.get(id);
    assert.ok(charge, `Missing fake charge ${id}`);
    return structuredClone(charge);
  }
}

async function fixture(provider = new FakeAmazonPay()) {
  const storage = new SqliteStorage(':memory:');
  const app = createApp(storage, undefined, { oauthStorePath: ':memory:' }, provider);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  function client() {
    let cookie = '';
    return async (path: string, method = 'GET', payload?: unknown) => {
      const response = await fetch(`${base}${path}`, {
        method, headers: { ...(cookie ? { cookie } : {}), ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return { status: response.status, data: response.status === 204 ? null : await response.json() };
    };
  }
  return {
    storage, provider, client,
    async close() {
      provider.captureGate?.resolve();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      app.locals.closeMcp(); storage.close();
    },
  };
}

test('unconfigured Amazon Pay reports sandbox status and rejects checkout without creating an order', async () => {
  const provider = new FakeAmazonPay(); provider.enabled = false;
  const f = await fixture(provider);
  try {
    const alice = f.client();
    assert.deepEqual((await alice(`${paymentPath}/status`)).data, { configured: false, environment: 'sandbox' });
    assert.equal((await alice(`${paymentPath}/prepare`, 'POST', body())).status, 503);
    assert.equal((await alice(`${paymentPath}/complete`, 'POST', { orderId: 'anything', checkoutSessionId: 'S01-checkout' })).status, 503);
    assert.deepEqual((await alice('/api/orders')).data, []);
    assert.equal(provider.buttonOrders.length, 0); assert.equal(provider.captures.length, 0);
  } finally { await f.close(); }
});

test('concurrent prepare uses one server-priced USD order and keeps ordinary checkout keys separate', async () => {
  const f = await fixture();
  try {
    const alice = f.client(), bob = f.client();
    await alice('/api/catalog');
    const prepared = await Promise.all([alice(`${paymentPath}/prepare`, 'POST', body()), alice(`${paymentPath}/prepare`, 'POST', body())]);
    assert.deepEqual(prepared.map(result => result.status), [200, 200]);
    const saved: Order = prepared[0].data.order;
    assert.equal(prepared[1].data.order.id, saved.id);
    assert.deepEqual(saved.quote, quoteConfig(body().config));
    assert.equal(saved.status, 'sandbox_pending');
    assert.deepEqual(saved.payment, { provider: 'amazon_pay', environment: 'sandbox', updatedAt: saved.createdAt });
    assert.equal((await alice('/api/orders')).data.length, 1);
    for (const order of f.provider.buttonOrders) assert.deepEqual(order.quote, saved.quote);
    assert.equal((await bob(`${paymentPath}/prepare`, 'POST', body())).status, 200);
    const changed = body(); changed.config.slots.main = 'pear';
    assert.equal((await alice(`${paymentPath}/prepare`, 'POST', changed)).status, 409);
    assert.equal((await alice('/api/orders', 'POST', body())).status, 409);
    const regular = body('ordinary-checkout-12345');
    assert.equal((await alice('/api/orders', 'POST', regular)).status, 201);
    assert.equal((await alice(`${paymentPath}/prepare`, 'POST', regular)).status, 409);
  } finally { await f.close(); }
});

test('another guest cannot read or complete the Amazon Pay order', async () => {
  const f = await fixture();
  try {
    const alice = f.client(), bob = f.client();
    const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
    f.provider.addSession(order);
    assert.equal((await alice(`/api/orders/${order.id}`)).status, 200);
    assert.equal((await bob(`/api/orders/${order.id}`)).status, 404);
    assert.deepEqual((await bob('/api/orders')).data, []);
    assert.equal((await bob(`${paymentPath}/complete`, 'POST', { orderId: order.id, checkoutSessionId: 'S01-checkout' })).status, 404);
    assert.equal(f.provider.sessionReads.length, 0); assert.equal(f.provider.captures.length, 0);
  } finally { await f.close(); }
});

test('untrusted session identity, order, amount, currency, environment, product, mode and intent cannot capture', async t => {
  const changes: [string, (session: AmazonPayCheckoutSession) => void][] = [
    ['session id', session => { session.checkoutSessionId = 'S01-other'; }],
    ['order reference', session => { session.merchantMetadata!.merchantReferenceId = 'another-order'; }],
    ['amount', session => { session.paymentDetails!.chargeAmount!.amount = '0.01'; }],
    ['fractional cents', session => { session.paymentDetails!.chargeAmount!.amount += '1'; }],
    ['currency', session => { session.paymentDetails!.chargeAmount!.currencyCode = 'CNY'; }],
    ['environment', session => { Object.assign(session, { releaseEnvironment: 'Live' }); }],
    ['product', session => { session.productType = 'PayAndShip'; }],
    ['mode', session => { session.webCheckoutDetails!.checkoutMode = 'Review'; }],
    ['intent', session => { session.paymentDetails!.paymentIntent = 'Authorize'; }],
    ['recurring charge permission', session => { session.chargePermissionType = 'Recurring'; }],
  ];
  for (const [name, change] of changes) await t.test(name, async () => {
    const f = await fixture();
    try {
      const alice = f.client();
      const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
      change(f.provider.addSession(order));
      const result = await alice(`${paymentPath}/complete`, 'POST', { orderId: order.id, checkoutSessionId: 'S01-checkout' });
      assert.equal(result.status, 409);
      const saved = (await alice(`/api/orders/${order.id}`)).data;
      assert.equal(saved.status, 'sandbox_pending'); assert.equal(saved.payment.checkoutSessionId, undefined);
      assert.equal(f.provider.captures.length, 0); assert.equal(f.provider.chargeReads.length, 0);
    } finally { await f.close(); }
  });
});

test('captured payment stores verified IDs and concurrent or repeated completion captures only once', async () => {
  const f = await fixture();
  try {
    const alice = f.client();
    const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
    f.provider.addSession(order); f.provider.captureGate = deferred();
    const request = { orderId: order.id, checkoutSessionId: 'S01-checkout', total: 0.01 };
    const concurrent = Promise.all([alice(`${paymentPath}/complete`, 'POST', request), alice(`${paymentPath}/complete`, 'POST', request)]);
    await f.provider.captureEntered.promise; f.provider.captureGate.resolve();
    const results = await concurrent;
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    assert.deepEqual(results[0].data, results[1].data);
    const paid: Order = results[0].data;
    assert.equal(paid.status, 'sandbox_paid'); assert.equal(paid.payment?.checkoutSessionId, request.checkoutSessionId);
    assert.equal(paid.payment?.chargeId, 'charge-S01-checkout');
    assert.equal(f.provider.captures.length, 1);
    assert.equal(f.provider.captures[0].amount, order.quote.total.toFixed(2));
    assert.match(f.provider.captures[0].idempotencyKey, /^[a-f0-9]{32}$/);
    const reads = f.provider.sessionReads.length;
    assert.deepEqual((await alice(`${paymentPath}/complete`, 'POST', request)).data, paid);
    assert.equal(f.provider.sessionReads.length, reads); assert.equal(f.provider.captures.length, 1);
    assert.equal((await alice(`${paymentPath}/prepare`, 'POST', body())).status, 409);
    assert.equal((await alice(`${paymentPath}/complete`, 'POST', { ...request, checkoutSessionId: 'S01-other' })).status, 409);
  } finally { await f.close(); }
});

test('a captured payment recovers after a session-read failure without capturing again', async () => {
  const f = await fixture();
  try {
    const alice = f.client();
    const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
    f.provider.addSession(order); f.provider.readFailuresAfterCapture = 1;
    const request = { orderId: order.id, checkoutSessionId: 'S01-checkout' };
    assert.equal((await alice(`${paymentPath}/complete`, 'POST', request)).status, 502);
    const pending = (await alice(`/api/orders/${order.id}`)).data;
    assert.equal(pending.status, 'sandbox_pending'); assert.equal(pending.payment.checkoutSessionId, request.checkoutSessionId);
    assert.equal(f.provider.captures.length, 1);
    const recovered = await alice(`${paymentPath}/complete`, 'POST', request);
    assert.equal(recovered.status, 200); assert.equal(recovered.data.status, 'sandbox_paid');
    assert.equal(f.provider.captures.length, 1);
  } finally { await f.close(); }
});

test('a captured payment recovers after persistence fails without capturing again', async t => {
  const f = await fixture();
  try {
    const alice = f.client();
    const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
    f.provider.addSession(order);
    const original = f.storage.updateAmazonPayOrder.bind(f.storage);
    let failures = 1;
    t.mock.method(f.storage, 'updateAmazonPayOrder', async (...args: Parameters<typeof original>) => {
      if (failures-- > 0) throw new Error('Simulated storage outage');
      return original(...args);
    });
    t.mock.method(console, 'error', () => {});
    const request = { orderId: order.id, checkoutSessionId: 'S01-checkout' };
    assert.equal((await alice(`${paymentPath}/complete`, 'POST', request)).status, 503);
    assert.equal((await alice(`/api/orders/${order.id}`)).data.status, 'sandbox_pending');
    const recovered = await alice(`${paymentPath}/complete`, 'POST', request);
    assert.equal(recovered.status, 200); assert.equal(recovered.data.status, 'sandbox_paid');
    assert.equal(f.provider.captures.length, 1);
  } finally { await f.close(); }
});

test('declined, canceled, and in-progress capture states are reported without false payment success', async t => {
  for (const [chargeState, expected] of [['Declined', 'sandbox_failed'], ['Canceled', 'sandbox_canceled'], ['CaptureInitiated', 'sandbox_pending']]) await t.test(chargeState, async () => {
    const f = await fixture();
    try {
      const alice = f.client();
      const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
      const session = f.provider.addSession(order, 'S01-checkout', 'Completed');
      f.provider.charges.get(session.chargeId!)!.statusDetails.state = chargeState;
      const result = await alice(`${paymentPath}/complete`, 'POST', { orderId: order.id, checkoutSessionId: session.checkoutSessionId });
      assert.equal(result.status, 200); assert.equal(result.data.status, expected);
      assert.equal(f.provider.captures.length, 0);
    } finally { await f.close(); }
  });
  await t.test('canceled checkout session', async () => {
    const f = await fixture();
    try {
      const alice = f.client();
      const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
      const session = f.provider.addSession(order, 'S01-checkout', 'Canceled');
      const request = { orderId: order.id, checkoutSessionId: session.checkoutSessionId };
      assert.equal((await alice(`${paymentPath}/complete`, 'POST', request)).data.status, 'sandbox_canceled');
      session.paymentDetails = null; session.merchantMetadata = null; session.webCheckoutDetails = null;
      assert.equal((await alice(`${paymentPath}/complete`, 'POST', request)).data.status, 'sandbox_canceled');
      assert.equal(f.provider.captures.length, 0); assert.equal(f.provider.chargeReads.length, 0);
    } finally { await f.close(); }
  });
});

test('previously verified sessions retain canceled or failed outcomes after Amazon redacts metadata', async t => {
  for (const [reasonCode, expected] of [['Declined', 'sandbox_failed'], ['AmazonCanceled', 'sandbox_failed'], ['BuyerCanceled', 'sandbox_canceled'], ['Expired', 'sandbox_canceled']]) await t.test(reasonCode, async () => {
    const f = await fixture();
    try {
      const alice = f.client();
      const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
      const session = f.provider.addSession(order, 'S01-checkout', 'Completed');
      f.provider.charges.get(session.chargeId!)!.statusDetails.state = 'CaptureInitiated';
      const request = { orderId: order.id, checkoutSessionId: session.checkoutSessionId };
      const bound = await alice(`${paymentPath}/complete`, 'POST', request);
      assert.equal(bound.status, 200); assert.equal(bound.data.status, 'sandbox_pending');
      assert.equal(bound.data.payment.checkoutSessionId, request.checkoutSessionId);
      session.statusDetails = { state: 'Canceled', reasonCode };
      session.paymentDetails = null; session.merchantMetadata = null; session.webCheckoutDetails = null;
      const result = await alice(`${paymentPath}/complete`, 'POST', request);
      assert.equal(result.status, 200); assert.equal(result.data.status, expected);
      assert.equal((await alice(`/api/orders/${order.id}`)).data.status, expected);
      assert.deepEqual((await alice(`${paymentPath}/complete`, 'POST', request)).data, result.data);
      assert.equal(f.provider.captures.length, 0);
      assert.equal(f.provider.chargeReads.length, 1);
    } finally { await f.close(); }
  });
  await t.test('unbound redacted cancellation cannot claim another order', async () => {
    const f = await fixture();
    try {
      const alice = f.client();
      const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
      const session = f.provider.addSession(order, 'S01-checkout', 'Canceled');
      session.statusDetails.reasonCode = 'Declined';
      session.paymentDetails = null; session.merchantMetadata = null; session.webCheckoutDetails = null;
      assert.equal((await alice(`${paymentPath}/complete`, 'POST', { orderId: order.id, checkoutSessionId: session.checkoutSessionId })).status, 409);
      const pending = (await alice(`/api/orders/${order.id}`)).data;
      assert.equal(pending.status, 'sandbox_pending'); assert.equal(pending.payment.checkoutSessionId, undefined);
      assert.equal(f.provider.captures.length, 0); assert.equal(f.provider.chargeReads.length, 0);
    } finally { await f.close(); }
  });
});

test('a Completed checkout needs matching sandbox charge identity, permission and monetary capture', async t => {
  const changes: [string, (charge: AmazonPayCharge) => void][] = [
    ['charge identity', charge => { charge.chargeId = 'charge-other'; }],
    ['charge permission', charge => { charge.chargePermissionId = 'permission-other'; }],
    ['environment', charge => { Object.assign(charge, { releaseEnvironment: 'Live' }); }],
    ['charge amount', charge => { charge.chargeAmount.amount = '0.01'; }],
    ['charge currency', charge => { charge.chargeAmount.currencyCode = 'CNY'; }],
    ['capture amount', charge => { charge.captureAmount!.amount = '0.01'; }],
    ['missing capture', charge => { charge.captureAmount = null; }],
  ];
  for (const [name, change] of changes) await t.test(name, async () => {
    const f = await fixture();
    try {
      const alice = f.client();
      const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
      const session = f.provider.addSession(order, 'S01-checkout', 'Completed');
      change(f.provider.charges.get(session.chargeId!)!);
      assert.equal((await alice(`${paymentPath}/complete`, 'POST', { orderId: order.id, checkoutSessionId: session.checkoutSessionId })).status, 409);
      assert.equal((await alice(`/api/orders/${order.id}`)).data.status, 'sandbox_pending');
      assert.equal(f.provider.captures.length, 0);
    } finally { await f.close(); }
  });
});

test('competing valid sessions for one order produce one binding and one capture', async () => {
  const f = await fixture();
  try {
    const alice = f.client();
    const order: Order = (await alice(`${paymentPath}/prepare`, 'POST', body())).data.order;
    f.provider.addSession(order, 'S01-first'); f.provider.addSession(order, 'S01-second');
    f.provider.captureGate = deferred();
    const concurrent = Promise.all(['S01-first', 'S01-second'].map(checkoutSessionId => alice(`${paymentPath}/complete`, 'POST', { orderId: order.id, checkoutSessionId })));
    await f.provider.captureEntered.promise; f.provider.captureGate.resolve();
    const results = await concurrent;
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const paid = results.find(result => result.status === 200)!.data;
    assert.equal(paid.status, 'sandbox_paid'); assert.equal(f.provider.captures.length, 1);
    assert.equal(f.provider.captures[0].sessionId, paid.payment.checkoutSessionId);
    assert.equal((await alice(`/api/orders/${order.id}`)).data.payment.checkoutSessionId, paid.payment.checkoutSessionId);
  } finally { await f.close(); }
});
