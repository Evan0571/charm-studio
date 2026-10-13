import { randomUUID } from 'node:crypto';
import type { Order, Quote } from '../shared/types';
import type { AmazonPayPreparedCheckout, AmazonPayStatus } from '../shared/amazon-pay';
import { quoteConfig, validateConfig, validateDesignId, validateIdempotencyKey, validateName, ValidationError } from '../shared/domain';
import type { AmazonPayCheckoutSession, AmazonPayProvider } from './amazon-pay';
import type { Storage } from './storage';
import { hash } from './studio-service';

const sessionIdOf = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new ValidationError('Amazon Pay 结账编号无效。');
  return value;
};

// Compare decimal strings as cents, without accepting exponents or rounding a
// different provider amount to match the server's immutable quote.
function matchesAmount(value: { amount: string; currencyCode: string } | null | undefined, quote: Quote): boolean {
  if (!value || value.currencyCode !== 'USD' || quote.currency !== 'USD' || typeof value.amount !== 'string') return false;
  const match = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(value.amount);
  const cents = Math.round(quote.total * 100);
  return !!match && Number.isSafeInteger(cents) && cents > 0
    && BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')) === BigInt(cents);
}

function validateSession(session: AmazonPayCheckoutSession, order: Order, sessionId: string): void {
  if (session.checkoutSessionId !== sessionId || session.releaseEnvironment !== 'Sandbox'
    || session.chargePermissionType !== 'OneTime'
    || session.merchantMetadata?.merchantReferenceId !== order.id
    || session.paymentDetails?.paymentIntent !== 'AuthorizeWithCapture'
    || !matchesAmount(session.paymentDetails?.chargeAmount, order.quote)
    || session.productType !== 'PayOnly'
    || session.webCheckoutDetails?.checkoutMode !== 'ProcessOrder') {
    throw new ValidationError('Amazon Pay 返回的订单与当前设计或金额不一致。', 409);
  }
}

function requireAmazonOrder(order: Order | undefined): asserts order is Order {
  if (!order || order.payment?.provider !== 'amazon_pay' || order.payment.environment !== 'sandbox') throw new ValidationError('没有找到这份 Amazon Pay 沙盒订单。', 404);
}

// Amazon also closes a checkout after a declined payment. Preserve the reason
// so a bank decline isn't presented as the buyer choosing to cancel.
const canceledStatus = (reason?: string | null): 'sandbox_failed' | 'sandbox_canceled' =>
  reason === 'Declined' || reason === 'AmazonCanceled' ? 'sandbox_failed' : 'sandbox_canceled';

export function createAmazonPayService(storage: Storage, provider: AmazonPayProvider) {
  const completing = new Map<string, Promise<Order>>();
  const configured = () => {
    if (!provider.configured()) throw new ValidationError('Amazon Pay 沙盒尚未配置完成。', 503);
  };
  async function finish(owner: string, orderId: string, sessionId: string): Promise<Order> {
    const order = await storage.getOrder(owner, orderId);
    requireAmazonOrder(order);
    if (order.payment!.checkoutSessionId && order.payment!.checkoutSessionId !== sessionId) throw new ValidationError('这份订单已关联另一次 Amazon Pay 结账。', 409);
    // A persisted paid result has already been verified with Amazon Pay. It is
    // immutable and repeating the return request must never initiate payment.
    if (order.status === 'sandbox_paid') return order;
    let session = await provider.getCheckoutSession(sessionId);
    if (session.checkoutSessionId !== sessionId || session.releaseEnvironment !== 'Sandbox') throw new ValidationError('Amazon Pay 返回的订单与当前设计或金额不一致。', 409);
    // Amazon can redact metadata after cancellation. Only accept this response
    // when the session was previously verified and bound to this owner's order.
    if (session.statusDetails.state === 'Canceled' && order.payment!.checkoutSessionId === sessionId) {
      return (await storage.updateAmazonPayOrder(owner, orderId, sessionId, canceledStatus(session.statusDetails.reasonCode))) ?? order;
    }
    validateSession(session, order, sessionId);
    const claimed = await storage.claimAmazonPaySession(owner, orderId, sessionId);
    if (!claimed) throw new ValidationError('这份订单已关联另一次 Amazon Pay 结账。', 409);
    if (claimed.status === 'sandbox_paid') return claimed;
    if (session.statusDetails.state === 'Canceled') {
      return (await storage.updateAmazonPayOrder(owner, orderId, sessionId, canceledStatus(session.statusDetails.reasonCode))) ?? claimed;
    }
    if (claimed.status !== 'sandbox_pending') return claimed;
    if (session.statusDetails.state === 'Open') {
      await provider.completeCheckoutSession(sessionId, order.quote.total.toFixed(2), hash(`amazon-pay-complete:${orderId}:${sessionId}`).slice(0, 32));
      // Re-read the canonical session. Transport failures leave the order
      // pending; a later retry can reconcile a payment Amazon already captured.
      session = await provider.getCheckoutSession(sessionId);
      validateSession(session, order, sessionId);
    }
    if (session.statusDetails.state !== 'Completed' || !session.chargeId) return claimed;
    const charge = await provider.getCharge(sessionIdOf(session.chargeId));
    if (charge.releaseEnvironment !== 'Sandbox' || charge.chargeId !== session.chargeId
      || (session.chargePermissionId && charge.chargePermissionId !== session.chargePermissionId)
      || !matchesAmount(charge.chargeAmount, order.quote)) {
      throw new ValidationError('Amazon Pay 返回的付款与当前订单不一致。', 409);
    }
    let status: 'sandbox_paid' | 'sandbox_failed' | 'sandbox_canceled';
    if (charge.statusDetails.state === 'Captured') {
      if (!matchesAmount(charge.captureAmount, order.quote)) throw new ValidationError('Amazon Pay 返回的付款与当前订单不一致。', 409);
      status = 'sandbox_paid';
    } else if (charge.statusDetails.state === 'Declined') status = 'sandbox_failed';
    else if (charge.statusDetails.state === 'Canceled') status = 'sandbox_canceled';
    else return claimed;
    const saved = await storage.updateAmazonPayOrder(owner, orderId, sessionId, status, charge.chargeId);
    if (!saved) throw new ValidationError('暂时无法保存付款结果，请重新核验这份订单。', 503);
    return saved;
  }
  return {
    status(): AmazonPayStatus { return { configured: provider.configured(), environment: 'sandbox' }; },
    async prepare(owner: string, body: Record<string, unknown>): Promise<AmazonPayPreparedCheckout> {
      configured();
      const config = validateConfig(body.config), designName = validateName(body.designName, '我的包挂');
      const key = validateIdempotencyKey(body.idempotencyKey);
      const requestHash = hash(JSON.stringify({ payment: 'amazon_pay_sandbox', designName, config: { ...config, lockedSlots: [...config.lockedSlots].sort() } }));
      let stored = await storage.getOrderByKey(owner, key);
      if (stored && stored.requestHash !== requestHash) throw new ValidationError('这次提交的设计已发生变化，请重新确认订单。', 409);
      if (!stored) {
        const now = new Date().toISOString();
        const quote = quoteConfig(config);
        if (quote.currency !== 'USD' || !Number.isSafeInteger(Math.round(quote.total * 100)) || quote.total <= 0) throw new ValidationError('Amazon Pay 沙盒需要有效的美元报价。');
        const order: Order = { id: randomUUID(), designName, config, quote, status: 'sandbox_pending', createdAt: now,
          payment: { provider: 'amazon_pay', environment: 'sandbox', updatedAt: now } };
        stored = await storage.createOrder(owner, key, requestHash, order);
      }
      if (stored.requestHash !== requestHash) throw new ValidationError('这次提交的设计已发生变化，请重新确认订单。', 409);
      requireAmazonOrder(stored.order);
      if (stored.order.status !== 'sandbox_pending' || stored.order.payment!.checkoutSessionId) throw new ValidationError('请核验已有付款结果，或重新确认设计后开始新的沙盒结账。', 409);
      return { order: stored.order, button: await provider.button(stored.order) };
    },
    async complete(owner: string, body: Record<string, unknown>): Promise<Order> {
      configured();
      const orderId = validateDesignId(body.orderId), sessionId = sessionIdOf(body.checkoutSessionId);
      const key = `${owner}:${orderId}:${sessionId}`;
      const pending = completing.get(key);
      if (pending) return pending;
      const result = finish(owner, orderId, sessionId);
      completing.set(key, result);
      try { return await result; } finally { completing.delete(key); }
    },
  };
}
