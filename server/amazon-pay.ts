import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { AmazonPayButtonConfig } from '../shared/amazon-pay';
import type { Order } from '../shared/types';
import { ValidationError } from '../shared/domain';

const require = createRequire(import.meta.url);
const algorithm = 'AMZN-PAY-RSASSA-PSS-V2' as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const unavailable = () => new ValidationError('Amazon Pay sandbox is not configured. Complete the server settings and restart the app.', 503);
const invalidResponse = () => new ValidationError('Amazon Pay returned an unexpected sandbox response. Please check the order again.', 502);

export interface AmazonPayAmount { amount: string; currencyCode: string; }
export interface AmazonPayState { state: string; reasonCode?: string | null; reasonDescription?: string | null; }
export interface AmazonPayCheckoutSession {
  checkoutSessionId: string;
  statusDetails: AmazonPayState;
  releaseEnvironment: 'Sandbox';
  chargePermissionType?: string | null;
  productType?: string | null;
  storeId?: string | null;
  paymentDetails?: {
    chargeAmount?: AmazonPayAmount | null;
    totalOrderAmount?: AmazonPayAmount | null;
    paymentIntent?: string | null;
    canHandlePendingAuthorization?: boolean | null;
  } | null;
  merchantMetadata?: { merchantReferenceId?: string | null } | null;
  webCheckoutDetails?: { checkoutMode?: string | null; checkoutResultReturnUrl?: string | null } | null;
  chargeId?: string | null;
  chargePermissionId?: string | null;
}
export interface AmazonPayCharge {
  chargeId: string;
  chargePermissionId?: string | null;
  statusDetails: AmazonPayState;
  chargeAmount: AmazonPayAmount;
  captureAmount?: AmazonPayAmount | null;
  releaseEnvironment: 'Sandbox';
}
export interface AmazonPayProvider {
  configured(): boolean;
  button(order: Order): Promise<AmazonPayButtonConfig>;
  getCheckoutSession(id: string): Promise<AmazonPayCheckoutSession>;
  completeCheckoutSession(id: string, amount: string, idempotencyKey: string): Promise<AmazonPayCheckoutSession>;
  getCharge(id: string): Promise<AmazonPayCharge>;
}

export interface AmazonPaySdkConfig {
  publicKeyId: string;
  privateKey: string;
  region: 'us';
  sandbox: true;
  algorithm: typeof algorithm;
}
export interface AmazonPaySdkClient {
  generateButtonSignature(payload: string): string;
  getCheckoutSession(id: string): Promise<{ status: number; data: unknown }>;
  completeCheckoutSession(id: string, payload: { chargeAmount: AmazonPayAmount }, headers: Record<string, string>): Promise<{ status: number; data: unknown }>;
  getCharge(id: string): Promise<{ status: number; data: unknown }>;
}

// SDK configuration has no endpoint override or live mode. SANDBOX-prefixed keys
// select Sandbox even though the current SDK uses the same /v2 endpoint for both.
const sdkClient = (config: AmazonPaySdkConfig): AmazonPaySdkClient => {
  const sdk = require('@amazonpay/amazon-pay-api-sdk-nodejs') as { WebStoreClient: new (config: AmazonPaySdkConfig) => AmazonPaySdkClient };
  return new sdk.WebStoreClient(config);
};

export function formatAmazonPayAmount(total: number): string {
  const cents = Math.round(total * 100);
  if (!Number.isFinite(total) || total <= 0 || total > 150000 || cents <= 0 || !Number.isSafeInteger(cents) || Math.abs(total * 100 - cents) > 0.000001) {
    throw new ValidationError('This order does not have a valid USD payment amount.', 400);
  }
  return (cents / 100).toFixed(2);
}

function baseOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.origin.length > 850) return;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) return;
    return url.origin;
  } catch { return; }
}

function identifier(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ValidationError('Invalid Amazon Pay transaction identifier.', 400);
  return value;
}

function amount(value: unknown): AmazonPayAmount {
  if (!object(value) || typeof value.amount !== 'string' || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value.amount) || typeof value.currencyCode !== 'string') throw invalidResponse();
  return { amount: value.amount, currencyCode: value.currencyCode };
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined || typeof value === 'string') return value;
  throw invalidResponse();
}

function state(value: unknown): AmazonPayState {
  if (!object(value) || typeof value.state !== 'string' || !value.state) throw invalidResponse();
  return { state: value.state, reasonCode: optionalString(value.reasonCode), reasonDescription: optionalString(value.reasonDescription) };
}

function session(value: unknown, expectedId: string): AmazonPayCheckoutSession {
  if (!object(value) || value.checkoutSessionId !== expectedId || value.releaseEnvironment !== 'Sandbox') throw invalidResponse();
  const result: AmazonPayCheckoutSession = {
    checkoutSessionId: expectedId, statusDetails: state(value.statusDetails), releaseEnvironment: 'Sandbox',
    chargeId: optionalString(value.chargeId), chargePermissionId: optionalString(value.chargePermissionId),
    storeId: optionalString(value.storeId), productType: optionalString(value.productType), chargePermissionType: optionalString(value.chargePermissionType),
  };
  if (!['Open', 'Completed', 'Canceled'].includes(result.statusDetails.state)) throw invalidResponse();
  if (value.paymentDetails === null) result.paymentDetails = null;
  else if (value.paymentDetails !== undefined) {
    if (!object(value.paymentDetails)) throw invalidResponse();
    const pending = value.paymentDetails.canHandlePendingAuthorization;
    if (pending !== undefined && pending !== null && typeof pending !== 'boolean') throw invalidResponse();
    result.paymentDetails = {
      chargeAmount: value.paymentDetails.chargeAmount === undefined || value.paymentDetails.chargeAmount === null ? value.paymentDetails.chargeAmount : amount(value.paymentDetails.chargeAmount),
      totalOrderAmount: value.paymentDetails.totalOrderAmount === undefined || value.paymentDetails.totalOrderAmount === null ? value.paymentDetails.totalOrderAmount : amount(value.paymentDetails.totalOrderAmount),
      paymentIntent: optionalString(value.paymentDetails.paymentIntent), canHandlePendingAuthorization: pending,
    };
  }
  if (value.merchantMetadata === null) result.merchantMetadata = null;
  else if (value.merchantMetadata !== undefined) {
    if (!object(value.merchantMetadata)) throw invalidResponse();
    result.merchantMetadata = { merchantReferenceId: optionalString(value.merchantMetadata.merchantReferenceId) };
  }
  if (value.webCheckoutDetails === null) result.webCheckoutDetails = null;
  else if (value.webCheckoutDetails !== undefined) {
    if (!object(value.webCheckoutDetails)) throw invalidResponse();
    result.webCheckoutDetails = { checkoutMode: optionalString(value.webCheckoutDetails.checkoutMode), checkoutResultReturnUrl: optionalString(value.webCheckoutDetails.checkoutResultReturnUrl) };
  }
  return result;
}

function charge(value: unknown, expectedId: string): AmazonPayCharge {
  if (!object(value) || value.chargeId !== expectedId || value.releaseEnvironment !== 'Sandbox') throw invalidResponse();
  return {
    chargeId: expectedId, chargePermissionId: optionalString(value.chargePermissionId), releaseEnvironment: 'Sandbox',
    statusDetails: state(value.statusDetails), chargeAmount: amount(value.chargeAmount),
    captureAmount: value.captureAmount === undefined || value.captureAmount === null ? value.captureAmount : amount(value.captureAmount),
  };
}

function safeError(error: unknown): ValidationError {
  if (error instanceof ValidationError) return error;
  const status = object(error) ? object(error.response) ? error.response.status : error.status : undefined;
  if (status === 401 || status === 403) return new ValidationError('Amazon Pay sandbox credentials were not accepted. Check the server settings.', 502);
  if (status === 425 || status === 409) return new ValidationError('Amazon Pay is still processing this order. Please check it again shortly.', 409);
  if (status === 429) return new ValidationError('Amazon Pay sandbox is busy. Please try again shortly.', 429);
  return new ValidationError('Could not verify this Amazon Pay sandbox payment. Please check the order again.', 502);
}

export function createAmazonPayProvider(options: { env?: NodeJS.ProcessEnv; clientFactory?: (config: AmazonPaySdkConfig) => AmazonPaySdkClient; requestTimeoutMs?: number } = {}): AmazonPayProvider {
  const env = options.env ?? process.env;
  const merchantId = (env.AMAZON_PAY_MERCHANT_ID ?? '').trim(), publicKeyId = (env.AMAZON_PAY_PUBLIC_KEY_ID ?? '').trim();
  const storeId = (env.AMAZON_PAY_STORE_ID ?? '').trim(), baseUrl = baseOrigin((env.AMAZON_PAY_BASE_URL ?? '').trim());
  let client: AmazonPaySdkClient | undefined;
  if (merchantId && /^SANDBOX-[A-Za-z0-9]+$/.test(publicKeyId) && storeId && baseUrl) {
    try {
      const inlineKey = (env.AMAZON_PAY_PRIVATE_KEY ?? '').trim();
      const privateKey = (inlineKey ? inlineKey.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n') : readFileSync((env.AMAZON_PAY_PRIVATE_KEY_PATH ?? '').trim(), 'utf8')).trim();
      const parsed = createPrivateKey(privateKey);
      if (parsed.asymmetricKeyType === 'rsa' && (parsed.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048) {
        client = (options.clientFactory ?? sdkClient)({ publicKeyId, privateKey, region: 'us', sandbox: true, algorithm });
      }
    } catch { /* Configuration status never includes credential values or SDK errors. */ }
  }
  const connected = (): AmazonPaySdkClient => { if (!client) throw unavailable(); return client; };
  const request = async (call: () => Promise<{ status: number; data: unknown }>): Promise<unknown> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A timed-out Complete call may still finish at Amazon. Its stable
      // idempotency key and the service's pending state permit reconciliation.
      const response = await Promise.race([call(), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ValidationError('Amazon Pay sandbox verification timed out. Please check the order again.', 504)), options.requestTimeoutMs ?? 10000);
      })]);
      if (!Number.isInteger(response.status)) throw invalidResponse();
      if (response.status < 200 || response.status >= 300) throw { response: { status: response.status } };
      return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (error) { throw safeError(error); }
    finally { clearTimeout(timer); }
  };
  return {
    configured: () => !!client,
    async button(order) {
      const active = connected();
      if (order.quote.currency !== 'USD') throw new ValidationError('Amazon Pay sandbox supports USD orders only.', 400);
      const orderId = identifier(order.id);
      const returnUrl = new URL('/', baseUrl!);
      returnUrl.searchParams.set('amazonPayReturn', '1'); returnUrl.searchParams.set('orderId', orderId);
      const payloadJSON = JSON.stringify({
        webCheckoutDetails: { checkoutResultReturnUrl: returnUrl.toString(), checkoutMode: 'ProcessOrder' },
        storeId, chargePermissionType: 'OneTime', scopes: ['name'],
        paymentDetails: { paymentIntent: 'AuthorizeWithCapture', canHandlePendingAuthorization: false, chargeAmount: { amount: formatAmazonPayAmount(order.quote.total), currencyCode: 'USD' } },
        merchantMetadata: { merchantReferenceId: orderId, merchantStoreName: 'LOOP Studio', noteToBuyer: 'LOOP sandbox demonstration. No product will be shipped.' },
      });
      try {
        const signature = active.generateButtonSignature(payloadJSON);
        if (typeof signature !== 'string' || !signature) throw invalidResponse();
        return { merchantId, publicKeyId, ledgerCurrency: 'USD', checkoutLanguage: 'en_US', productType: 'PayOnly', placement: 'Checkout', buttonColor: 'Gold', sandbox: true, createCheckoutSessionConfig: { payloadJSON, signature, algorithm } };
      } catch (error) { throw safeError(error); }
    },
    async getCheckoutSession(id) {
      const active = connected(), key = identifier(id);
      return session(await request(() => active.getCheckoutSession(key)), key);
    },
    async completeCheckoutSession(id, value, idempotencyKey) {
      const active = connected(), key = identifier(id);
      if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,5})\.\d{2}$/.test(value) || formatAmazonPayAmount(Number(value)) !== value) throw new ValidationError('Invalid Amazon Pay checkout amount.', 400);
      if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(idempotencyKey)) throw new ValidationError('Invalid Amazon Pay submission identifier.', 400);
      return session(await request(() => active.completeCheckoutSession(key, { chargeAmount: { amount: value, currencyCode: 'USD' } }, { 'x-amz-pay-idempotency-key': idempotencyKey })), key);
    },
    async getCharge(id) {
      const active = connected(), key = identifier(id);
      return charge(await request(() => active.getCharge(key)), key);
    },
  };
}

export const amazonPayFromEnvironment = (env: NodeJS.ProcessEnv = process.env): AmazonPayProvider => createAmazonPayProvider({ env });
