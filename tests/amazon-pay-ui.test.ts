import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAmazonPayReturnQuery, readAmazonPayReturn } from '../src/AmazonPayButton';

test('Amazon Pay return keeps an unverified order and session available after URL cleanup and refresh', () => {
  const url = new URL('https://loop.example/?campaign=demo&amazonPayReturn=1&orderId=order-1&amazonCheckoutSessionId=session-1#/studio');
  const details = readAmazonPayReturn(url, null);
  assert.deepEqual(details, { orderId: 'order-1', checkoutSessionId: 'session-1' });
  const cleaned = clearAmazonPayReturnQuery(url);
  assert.equal(cleaned.href, 'https://loop.example/?campaign=demo#/studio');
  assert.equal(url.searchParams.get('amazonPayReturn'), '1');
  assert.deepEqual(readAmazonPayReturn(cleaned, JSON.stringify(details)), details);
  assert.equal(readAmazonPayReturn(cleaned, null), null);
});

test('incomplete or canceled return never borrows a session from an older order', () => {
  const previous = JSON.stringify({ orderId: 'older-order', checkoutSessionId: 'older-session' });
  assert.deepEqual(readAmazonPayReturn(new URL('https://loop.example/?amazonPayReturn=1&orderId=new-order'), previous), { orderId: 'new-order', checkoutSessionId: null });
  assert.deepEqual(readAmazonPayReturn(new URL('https://loop.example/?amazonPayReturn=1'), previous), { orderId: null, checkoutSessionId: null });
  assert.equal(readAmazonPayReturn(new URL('https://loop.example/'), '{broken'), null);
  assert.equal(readAmazonPayReturn(new URL('https://loop.example/'), JSON.stringify({ orderId: '', checkoutSessionId: 'session' })), null);
});

test('replaying a stored payment does not remove unrelated URL parameters', () => {
  const unrelated = new URL('https://loop.example/?orderId=another-tool&campaign=demo#/saved');
  assert.equal(clearAmazonPayReturnQuery(unrelated).href, unrelated.href);
  assert.deepEqual(readAmazonPayReturn(unrelated, JSON.stringify({ orderId: 'payment-order', checkoutSessionId: 'payment-session' })), { orderId: 'payment-order', checkoutSessionId: 'payment-session' });
});
