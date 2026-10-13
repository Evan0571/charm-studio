// Local browser checks with an in-memory database and an explicit mock provider.
// No Amazon account, credentials, or network payment calls are used.
// Set PLAYWRIGHT_MODULE to a Playwright ESM entry if it is not installed here.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { createApp } from '../server/app.ts';
import { SqliteStorage } from '../server/storage.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const storage = new SqliteStorage(':memory:');
const orders = new Map();
let configured = false, result = 'Captured', preparedCount = 0, base = '';
const orderFromId = (id, prefix) => {
  const order = orders.get(id.slice(prefix.length));
  assert.ok(order, 'Provider received a known mock order');
  return order;
};
const session = id => {
  const order = orderFromId(id, 'ui_session_');
  return { checkoutSessionId: id, statusDetails: { state: result === 'Canceled' ? 'Canceled' : 'Completed' }, releaseEnvironment: 'Sandbox', productType: 'PayOnly', chargePermissionType: 'OneTime',
    paymentDetails: { paymentIntent: 'AuthorizeWithCapture', chargeAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' } },
    merchantMetadata: { merchantReferenceId: order.id }, webCheckoutDetails: { checkoutMode: 'ProcessOrder' }, chargeId: `ui_charge_${order.id}` };
};
const provider = {
  configured: () => configured,
  button: async order => {
    orders.set(order.id, order); preparedCount++;
    return { merchantId: 'mock-merchant', publicKeyId: 'SANDBOX-mock-key', ledgerCurrency: 'USD', checkoutLanguage: 'en_US', productType: 'PayOnly', placement: 'Checkout', buttonColor: 'Gold', sandbox: true,
      createCheckoutSessionConfig: { algorithm: 'AMZN-PAY-RSASSA-PSS-V2', signature: 'mock-signature',
        payloadJSON: JSON.stringify({ returnURL: `${base}/?campaign=demo&amazonPayReturn=1&orderId=${order.id}&amazonCheckoutSessionId=ui_session_${order.id}` }) } };
  },
  getCheckoutSession: async id => session(id),
  completeCheckoutSession: async id => session(id),
  getCharge: async id => {
    const order = orderFromId(id, 'ui_charge_');
    return { chargeId: id, statusDetails: { state: result }, releaseEnvironment: 'Sandbox',
      chargeAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' }, captureAmount: { amount: order.quote.total.toFixed(2), currencyCode: 'USD' } };
  },
};
const app = createApp(storage, { configured: () => false, reply: async () => { throw new Error('AI calls disabled in this check'); } }, {}, provider);
const server = createHttpServer(app);
const vite = await createViteServer({ configFile: false, server: { middlewareMode: true, hmr: { server } }, appType: 'custom' });
app.use(vite.middlewares);
app.use(async (req, res, next) => {
  try { res.type('html').send(await vite.transformIndexHtml(req.originalUrl, await readFile('index.html', 'utf8'))); }
  catch (error) { next(error); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let failSDK = false;
await page.route('https://static-na.payments-amazon.com/checkout.js', route => failSDK ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: `
  window.amazon={Pay:{renderButton:(selector,config)=>{
    window.lastAmazonConfig=config;
    window.amazonTestOnError=()=>config.onError();
    const button=document.createElement('button');
    button.textContent='Mock Amazon Pay checkout';button.type='button';
    button.style='width:100%;background:#ffd814;padding:12px;border-radius:4px';
    button.onclick=()=>location.href=JSON.parse(config.createCheckoutSessionConfig.payloadJSON).returnURL;
    document.querySelector(selector).append(button);
  }}};
` }));
const review = async () => {
  await page.goto(base + '/#/studio'); await page.reload();
  await page.getByRole('button', { name: 'Review design', exact: true }).click();
};
const openAmazon = async () => {
  await review();
  await page.getByRole('button', { name: 'Continue with Amazon Pay sandbox', exact: true }).click();
  await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).waitFor();
  assert.ok(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).overflowY === 'auto' && element.clientHeight <= window.innerHeight));
  assert.equal(await page.evaluate(() => window.lastAmazonConfig.sandbox), true);
  assert.equal(await page.evaluate(() => window.lastAmazonConfig.productType), 'PayOnly');
  assert.equal(await page.evaluate(() => window.lastAmazonConfig.createCheckoutSessionConfig.algorithm), 'AMZN-PAY-RSASSA-PSS-V2');
};
const assertNotPaid = async () => assert.equal(await page.getByText('Sandbox payment verified', { exact: true }).count(), 0);
const counts = async () => (await (await page.request.get(base + '/api/orders')).json()).length;
try {
  await review();
  await page.getByText('Amazon Pay sandbox is being set up.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Continue with Amazon Pay sandbox', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Confirm test order', exact: true }).click();
  await page.getByText('Test order confirmed', { exact: true }).waitFor();
  console.log('PASS unconfigured sandbox keeps original test order flow');

  configured = true; failSDK = true; await review();
  const before = await counts(), beforePrepared = preparedCount;
  await page.getByRole('button', { name: 'Continue with Amazon Pay sandbox', exact: true }).click();
  await page.getByText('Amazon Pay could not open. Your design is kept; try again.', { exact: true }).waitFor();
  assert.equal(await counts(), before + 1);
  failSDK = false;
  await page.getByRole('button', { name: 'Try Amazon Pay again', exact: true }).click();
  await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).waitFor();
  assert.equal(preparedCount, beforePrepared + 1);
  await page.evaluate(() => window.amazonTestOnError());
  await page.getByRole('button', { name: 'Try Amazon Pay again', exact: true }).click();
  await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).waitFor();
  assert.equal(preparedCount, beforePrepared + 1);
  assert.equal(await counts(), before + 1);
  await page.getByRole('button', { name: 'Confirm test order', exact: true }).click();
  await page.getByText('Test order confirmed', { exact: true }).waitFor();
  assert.equal(await counts(), before + 2);
  console.log('PASS SDK load/onError retries reuse order; test order uses its own key');

  await page.route(base + '/api/quote', async route => {
    const response = await route.fetch(), quote = await response.json();
    quote.total -= 1;
    await route.fulfill({ response, json: quote });
  });
  await review();
  const quotedPrice = await page.locator('.bill-total').innerText();
  await page.getByRole('button', { name: 'Continue with Amazon Pay sandbox', exact: true }).click();
  await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).waitFor();
  assert.notEqual(await page.locator('.bill-total').innerText(), quotedPrice);
  await page.unroute(base + '/api/quote');
  console.log('PASS checkout updates a stale review price to the prepared server quote');

  result = 'Authorized'; await openAmazon();
  await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).click();
  await page.getByText('Sandbox payment not yet confirmed', { exact: true }).waitFor();
  await assertNotPaid();
  assert.equal(new URL(page.url()).searchParams.get('campaign'), 'demo');
  assert.equal(new URL(page.url()).searchParams.has('amazonCheckoutSessionId'), false);
  await mkdir('tmp/amazon-pay-ui', { recursive: true });
  await page.screenshot({ path: 'tmp/amazon-pay-ui/pending-mobile.png', fullPage: true });
  result = 'Captured';
  await page.getByRole('button', { name: 'Check payment status', exact: true }).click();
  await page.getByText('Sandbox payment verified', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('loop-amazon-pay-return-v1')), null);
  await page.screenshot({ path: 'tmp/amazon-pay-ui/paid-mobile.png', fullPage: true });
  console.log('PASS pending remains unconfirmed; retry displays server-verified sandbox payment');

  for (const [state, label] of [['Declined', 'Sandbox payment unsuccessful'], ['Canceled', 'Sandbox checkout canceled']]) {
    result = state; await openAmazon();
    await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).click();
    await page.getByText(label, { exact: true }).waitFor(); await assertNotPaid();
  }
  console.log('PASS failed and canceled receipts remain distinct from payment success');

  result = 'Captured'; await openAmazon();
  await page.route(base + '/api/payments/amazon-pay/complete', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary verification error' }) }), { times: 1 });
  await page.getByRole('button', { name: 'Mock Amazon Pay checkout', exact: true }).click();
  await page.getByText('No completed sandbox payment has been confirmed.', { exact: true }).waitFor(); await assertNotPaid();
  assert.ok(await page.evaluate(() => sessionStorage.getItem('loop-amazon-pay-return-v1')));
  await page.reload();
  await page.getByText('Sandbox payment verified', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('campaign'), 'demo');
  console.log('PASS failed verification survives refresh and reconciles with the server');

  await page.goto(base + '/?campaign=cancel&amazonPayReturn=1#/studio');
  await page.getByText('No completed sandbox payment has been confirmed.', { exact: true }).waitFor(); await assertNotPaid();
  await page.getByRole('button', { name: 'Continue my draft', exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get('campaign'), 'cancel');
  assert.ok(await page.evaluate(() => localStorage.getItem('loop-workspace-draft-v1')));
  console.log('PASS incomplete return keeps the draft and never reports payment success');
  assert.deepEqual(errors, []);
  console.log('PASS browser page errors: 0 (mock provider and SDK; no real Amazon end-to-end test)');
} catch (error) {
  await mkdir('tmp/amazon-pay-ui', { recursive: true });
  await page.screenshot({ path: 'tmp/amazon-pay-ui/failure.png', fullPage: true });
  console.error('Browser check failed. Screenshot: tmp/amazon-pay-ui/failure.png');
  throw error;
} finally {
  await browser.close(); await vite.close(); await app.locals.closeMcp();
  await new Promise(resolve => server.close(resolve)); storage.close();
}
