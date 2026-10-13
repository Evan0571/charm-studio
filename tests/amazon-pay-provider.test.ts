import test from 'node:test';
import assert from 'node:assert/strict';
import { constants, createHash, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDefaultConfig } from '../shared/catalog';
import { quoteConfig, ValidationError } from '../shared/domain';
import type { Order } from '../shared/types';
import { createAmazonPayProvider, formatAmazonPayAmount, type AmazonPaySdkClient, type AmazonPaySdkConfig } from '../server/amazon-pay';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const environment = (): NodeJS.ProcessEnv => ({
  AMAZON_PAY_MERCHANT_ID: 'AMAZON-SANDBOX-MERCHANT', AMAZON_PAY_PUBLIC_KEY_ID: 'SANDBOX-EXAMPLEKEY', AMAZON_PAY_STORE_ID: 'amzn1.application-oa2-client.looptest',
  AMAZON_PAY_PRIVATE_KEY: keys.privateKey, AMAZON_PAY_BASE_URL: 'https://loop.example',
});
const order = (): Order => { const config = createDefaultConfig('hero'); return { id: '5601cf9d-9096-44eb-9948-6bd4c54fb58b', designName: 'Sandbox design', config, quote: quoteConfig(config), status: 'test_confirmed', createdAt: '2026-10-13T00:00:00.000Z' }; };
const checkoutSessionId = '7450f747-923d-4f9c-85bc-3c5a1e5d633d', chargeId = 'S01-5105180-3221187-C056351';
const checkout = () => ({
  checkoutSessionId, releaseEnvironment: 'Sandbox', storeId: environment().AMAZON_PAY_STORE_ID, productType: 'PayOnly', chargePermissionType: 'OneTime',
  statusDetails: { state: 'Completed', reasonCode: null }, paymentDetails: { paymentIntent: 'AuthorizeWithCapture', canHandlePendingAuthorization: false, chargeAmount: { amount: '14.00', currencyCode: 'USD' } },
  merchantMetadata: { merchantReferenceId: order().id }, webCheckoutDetails: { checkoutMode: 'ProcessOrder', checkoutResultReturnUrl: 'https://loop.example/?amazonPayReturn=1' },
  chargeId, chargePermissionId: 'S01-5105180-3221187', buyer: { name: 'Buyer should not leave the provider', email: 'buyer@example.com' },
});
const completedReceipt = () => ({
  checkoutSessionId, statusDetails: { state: 'Completed', reasonCode: null, reasonDescription: null },
  chargePermissionType: 'OneTime', chargeId, chargePermissionId: 'S01-5105180-3221187',
  releaseEnvironment: null, storeId: null, productType: null, paymentDetails: null,
  merchantMetadata: null, webCheckoutDetails: null,
});
const charge = () => ({ chargeId, chargePermissionId: 'S01-5105180-3221187', releaseEnvironment: 'Sandbox', statusDetails: { state: 'Captured', reasonCode: null }, chargeAmount: { amount: '14.00', currencyCode: 'USD' }, captureAmount: { amount: '14.00', currencyCode: 'USD' } });
const response = (data: unknown) => Promise.resolve({ status: 200, data });
function fakeClient(overrides: Partial<AmazonPaySdkClient> = {}): AmazonPaySdkClient {
  return { generateButtonSignature: () => 'test-signature', getCheckoutSession: () => response(checkout()), completeCheckoutSession: () => response(checkout()), getCharge: () => response(charge()), ...overrides };
}
const invalid = (status: number) => (error: unknown) => error instanceof ValidationError && error.status === status;

test('Amazon Pay stays unconfigured with missing credentials, live keys, unsafe URLs or invalid RSA keys', async () => {
  const missing = ['AMAZON_PAY_MERCHANT_ID', 'AMAZON_PAY_PUBLIC_KEY_ID', 'AMAZON_PAY_STORE_ID', 'AMAZON_PAY_PRIVATE_KEY', 'AMAZON_PAY_BASE_URL'];
  const variants: NodeJS.ProcessEnv[] = [{}, ...missing.map(key => { const env = environment(); delete env[key]; return env; }),
    { ...environment(), AMAZON_PAY_PUBLIC_KEY_ID: 'LIVE-EXAMPLEKEY' }, { ...environment(), AMAZON_PAY_PUBLIC_KEY_ID: 'EXAMPLEKEY' },
    { ...environment(), AMAZON_PAY_PRIVATE_KEY: 'invalid-private-key-secret' }, { ...environment(), AMAZON_PAY_BASE_URL: 'http://public.example' },
    { ...environment(), AMAZON_PAY_BASE_URL: 'https://user:private-token@loop.example' }, { ...environment(), AMAZON_PAY_BASE_URL: 'https://loop.example?secret=x' },
  ];
  for (const env of variants) {
    let calls = 0;
    const provider = createAmazonPayProvider({ env, clientFactory: () => { calls++; return fakeClient(); } });
    assert.equal(provider.configured(), false); assert.equal(calls, 0);
    await assert.rejects(provider.button(order()), invalid(503));
    await assert.rejects(provider.getCheckoutSession(checkoutSessionId), invalid(503));
    await assert.rejects(provider.completeCheckoutSession(checkoutSessionId, '14.00', 'same-order-key'), invalid(503));
    await assert.rejects(provider.getCharge(chargeId), invalid(503));
  }
});

test('Amazon Pay loads escaped PEM or a private-key file and pins SDK to US Sandbox', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-amazon-pay-key-'));
  const path = join(directory, 'private.pem');
  try {
    await writeFile(path, keys.privateKey, { mode: 0o600 });
    for (const env of [{ ...environment(), AMAZON_PAY_PRIVATE_KEY: keys.privateKey.replace(/\n/g, '\\n'), AMAZON_PAY_BASE_URL: 'http://localhost:3000/' },
      { ...environment(), AMAZON_PAY_PRIVATE_KEY: '', AMAZON_PAY_PRIVATE_KEY_PATH: path }]) {
      let config: AmazonPaySdkConfig | undefined;
      const provider = createAmazonPayProvider({ env, clientFactory: value => { config = value; return fakeClient(); } });
      assert.equal(provider.configured(), true);
      assert.equal(createHash('sha256').update(config!.privateKey).digest('hex'), createHash('sha256').update(keys.privateKey.trim()).digest('hex'));
      assert.equal(config?.region, 'us'); assert.equal(config?.sandbox, true); assert.equal(config?.publicKeyId, 'SANDBOX-EXAMPLEKEY'); assert.equal(config?.algorithm, 'AMZN-PAY-RSASSA-PSS-V2');
      assert.equal(Object.hasOwn(config!, 'overrideServiceUrl'), false);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the installed Amazon Pay SDK signs the exact ProcessOrder amount and merchant order without network access', async () => {
  const provider = createAmazonPayProvider({ env: environment() });
  assert.equal(provider.configured(), true);
  const saved = order(), config = await provider.button(saved), signed = config.createCheckoutSessionConfig;
  const payload = JSON.parse(signed.payloadJSON);
  assert.equal(config.sandbox, true); assert.equal(config.productType, 'PayOnly'); assert.equal(config.ledgerCurrency, 'USD');
  assert.equal(config.publicKeyId, 'SANDBOX-EXAMPLEKEY'); assert.equal(config.merchantId, 'AMAZON-SANDBOX-MERCHANT');
  assert.equal(signed.algorithm, 'AMZN-PAY-RSASSA-PSS-V2'); assert.equal(payload.storeId, environment().AMAZON_PAY_STORE_ID);
  assert.equal(payload.webCheckoutDetails.checkoutMode, 'ProcessOrder'); assert.equal(payload.chargePermissionType, 'OneTime');
  assert.equal(payload.paymentDetails.paymentIntent, 'AuthorizeWithCapture'); assert.equal(payload.paymentDetails.canHandlePendingAuthorization, false);
  assert.deepEqual(payload.paymentDetails.chargeAmount, { amount: saved.quote.total.toFixed(2), currencyCode: 'USD' });
  assert.equal(payload.merchantMetadata.merchantReferenceId, saved.id);
  assert.equal(payload.webCheckoutDetails.checkoutResultReturnUrl, `https://loop.example/?amazonPayReturn=1&orderId=${saved.id}`);
  const validSignature = (json: string) => verify('RSA-SHA256', Buffer.from(signed.algorithm + '\n' + createHash('sha256').update(json).digest('hex')), { key: keys.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, Buffer.from(signed.signature, 'base64'));
  assert.equal(validSignature(signed.payloadJSON), true);
  payload.paymentDetails.chargeAmount.amount = '0.01'; assert.equal(validSignature(JSON.stringify(payload)), false);
  assert.doesNotMatch(JSON.stringify(config), /PRIVATE KEY/);
});

test('provider sends exact USD amount and stable idempotency key, then reads verified sandbox fields', async () => {
  const calls: unknown[] = [];
  const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({
    getCheckoutSession: id => { calls.push(['get', id]); return response(JSON.stringify(checkout())); },
    completeCheckoutSession: (id, payload, headers) => { calls.push(['complete', id, payload, headers]); return response(checkout()); },
    getCharge: id => { calls.push(['charge', id]); return response(charge()); },
  }) });
  const initial = await provider.getCheckoutSession(checkoutSessionId), completed = await provider.completeCheckoutSession(checkoutSessionId, '14.00', '1'.repeat(32)), captured = await provider.getCharge(chargeId);
  assert.equal(initial.merchantMetadata?.merchantReferenceId, order().id); assert.equal(initial.storeId, environment().AMAZON_PAY_STORE_ID);
  assert.equal(initial.paymentDetails?.paymentIntent, 'AuthorizeWithCapture'); assert.equal(initial.webCheckoutDetails?.checkoutMode, 'ProcessOrder'); assert.equal(Object.hasOwn(initial, 'buyer'), false);
  assert.equal(completed.statusDetails.state, 'Completed'); assert.equal(completed.chargeId, chargeId); assert.equal(captured.statusDetails.state, 'Captured');
  assert.deepEqual(captured.captureAmount, { amount: '14.00', currencyCode: 'USD' });
  assert.deepEqual(calls, [['get', checkoutSessionId], ['complete', checkoutSessionId, { chargeAmount: { amount: '14.00', currencyCode: 'USD' } }, { 'x-amz-pay-idempotency-key': '1'.repeat(32) }], ['charge', chargeId]]);
});

test('provider rejects mismatched resources, live responses and malformed monetary fields', async () => {
  for (const value of [{ ...checkout(), releaseEnvironment: 'Live' }, { ...checkout(), releaseEnvironment: undefined }, { ...checkout(), checkoutSessionId: 'different-session' },
    { ...checkout(), releaseEnvironment: null, statusDetails: { state: 'Open' } }, { ...checkout(), releaseEnvironment: null, statusDetails: { state: 'Canceled' } },
    { ...checkout(), statusDetails: { state: 'Paid' } }, { ...checkout(), paymentDetails: { chargeAmount: { amount: 14, currencyCode: 'USD' } } }, { ...checkout(), merchantMetadata: 'invalid' }]) {
    const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({ getCheckoutSession: () => response(value) }) });
    await assert.rejects(provider.getCheckoutSession(checkoutSessionId), invalid(502));
  }
  for (const value of [{ ...charge(), releaseEnvironment: 'Live' }, { ...charge(), releaseEnvironment: null }, { ...charge(), chargeId: 'different-charge' }, { ...charge(), captureAmount: { amount: 'NaN', currencyCode: 'USD' } }]) {
    const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({ getCharge: () => response(value) }) });
    await assert.rejects(provider.getCharge(chargeId), invalid(502));
  }
});

test('official Complete receipt with null metadata and environment permits a canonical Completed session read', async () => {
  const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({
    completeCheckoutSession: () => response(JSON.stringify(completedReceipt())),
    getCheckoutSession: () => response(completedReceipt()),
  }) });
  const receipt = await provider.completeCheckoutSession(checkoutSessionId, '14.00', 'same-order-key');
  assert.deepEqual(receipt, { checkoutSessionId, statusDetails: { state: 'Completed', reasonCode: null, reasonDescription: null },
    chargeId, chargePermissionId: 'S01-5105180-3221187' });
  assert.equal(Object.hasOwn(receipt, 'merchantMetadata'), false);
  const canonical = await provider.getCheckoutSession(checkoutSessionId);
  assert.equal(canonical.releaseEnvironment, null); assert.equal(canonical.paymentDetails, null);
  assert.equal(canonical.merchantMetadata, null); assert.equal(canonical.webCheckoutDetails, null);
  assert.equal((await provider.getCharge(chargeId)).releaseEnvironment, 'Sandbox');
});

test('Complete receipts reject foreign sessions, explicit live mode and invalid completion states', async () => {
  for (const value of [{ ...completedReceipt(), checkoutSessionId: 'different-session' }, { ...completedReceipt(), releaseEnvironment: 'Live' },
    { ...completedReceipt(), statusDetails: { state: 'Open' } }, { ...completedReceipt(), statusDetails: { state: 'Canceled' } },
    { ...completedReceipt(), chargeId: 123 }]) {
    const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({ completeCheckoutSession: () => response(value) }) });
    await assert.rejects(provider.completeCheckoutSession(checkoutSessionId, '14.00', 'same-order-key'), invalid(502));
  }
});

test('a canceled sandbox session can omit payment details without becoming a confirmed payment', async () => {
  const value = { checkoutSessionId, releaseEnvironment: 'Sandbox', statusDetails: { state: 'Canceled', reasonCode: 'BuyerCanceled' }, paymentDetails: null, merchantMetadata: null };
  const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({ getCheckoutSession: () => response(value) }) });
  const result = await provider.getCheckoutSession(checkoutSessionId);
  assert.equal(result.statusDetails.state, 'Canceled'); assert.equal(result.statusDetails.reasonCode, 'BuyerCanceled'); assert.equal(result.paymentDetails, null);
});

test('provider scrubs rejected SDK error messages and response payloads', async () => {
  for (const [status, expectedStatus] of [[401, 502], [425, 409], [429, 429], [422, 502]]) {
    const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({ getCheckoutSession: () => Promise.reject({ message: 'DO-NOT-EXPOSE-SECRET', config: { privateKey: keys.privateKey }, response: { status, data: 'DO-NOT-EXPOSE-BUYER' } }) }) });
    await assert.rejects(provider.getCheckoutSession(checkoutSessionId), error => {
      assert.equal(invalid(expectedStatus!)(error), true); assert.doesNotMatch(String(error), /DO-NOT-EXPOSE|PRIVATE KEY/); return true;
    });
  }
});

test('a stalled SDK completion times out without reporting a successful payment', async () => {
  const provider = createAmazonPayProvider({ env: environment(), requestTimeoutMs: 5, clientFactory: () => fakeClient({ completeCheckoutSession: () => new Promise(() => {}) }) });
  await assert.rejects(provider.completeCheckoutSession(checkoutSessionId, '14.00', 'same-order-key'), invalid(504));
});

test('invalid USD amounts and resource identifiers never reach the SDK', async () => {
  let calls = 0;
  const provider = createAmazonPayProvider({ env: environment(), clientFactory: () => fakeClient({ completeCheckoutSession: () => { calls++; return response(checkout()); }, getCheckoutSession: () => { calls++; return response(checkout()); } }) });
  for (const id of ['', '../live/session', `${checkoutSessionId}?override=1`]) await assert.rejects(provider.getCheckoutSession(id), invalid(400));
  for (const value of ['0.00', '-1.00', '1.005', '1e3', 'NaN', '150000.01']) await assert.rejects(provider.completeCheckoutSession(checkoutSessionId, value, 'same-order-key'), invalid(400));
  await assert.rejects(provider.completeCheckoutSession(checkoutSessionId, '14.00', 'x'.repeat(33)), invalid(400));
  await assert.rejects(provider.button({ ...order(), quote: { ...order().quote, currency: 'CNY' } }), invalid(400));
  assert.equal(calls, 0);
  assert.equal(formatAmazonPayAmount(1.1), '1.10'); assert.equal(formatAmazonPayAmount(150000), '150000.00');
  for (const total of [0, 0.000000001, -1, 1.005, Number.NaN, Number.POSITIVE_INFINITY, 150000.01]) assert.throws(() => formatAmazonPayAmount(total), invalid(400));
});
