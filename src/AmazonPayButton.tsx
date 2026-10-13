import { useEffect, useId, useRef, useState } from 'react';
import type { AmazonPayButtonConfig } from '../shared/amazon-pay';
import type { DesignConfig, Order } from '../shared/types';
import type { Language } from '../shared/localization';

type CheckoutRequest = { designName: string; config: DesignConfig; idempotencyKey: string };
type PreparedCheckout = { order: Order; button: AmazonPayButtonConfig };
type AmazonPaySDK = { renderButton: (selector: string, config: AmazonPayButtonConfig & { onError: () => void }) => unknown };
declare global { interface Window { amazon?: { Pay?: AmazonPaySDK }; } }

const sdkURL = 'https://static-na.payments-amazon.com/checkout.js';
let sdkLoading: Promise<AmazonPaySDK> | null = null;
const preparedCheckouts = new Map<string, Promise<PreparedCheckout>>();

function loadSDK(): Promise<AmazonPaySDK> {
  if (window.amazon?.Pay) return Promise.resolve(window.amazon.Pay);
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<AmazonPaySDK>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sdkURL; script.async = true;
    const finish = (error?: Error) => {
      window.clearTimeout(timer); script.onload = null; script.onerror = null;
      if (!error && window.amazon?.Pay) resolve(window.amazon.Pay);
      else { script.remove(); reject(error || new Error('Amazon Pay did not load.')); }
    };
    const timer = window.setTimeout(() => finish(new Error('Amazon Pay took too long to load.')), 20000);
    script.onload = () => finish(); script.onerror = () => finish(new Error('Amazon Pay could not load.'));
    document.head.append(script);
  }).catch(error => { sdkLoading = null; throw error; });
  return sdkLoading;
}

function prepareCheckout(request: CheckoutRequest): Promise<PreparedCheckout> {
  const existing = preparedCheckouts.get(request.idempotencyKey);
  if (existing) return existing;
  const preparation = fetch('/api/payments/amazon-pay/prepare', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000),
  }).then(async response => {
    if (!response.ok) throw new Error('Checkout could not be prepared.');
    const checkout = await response.json() as PreparedCheckout;
    if (!checkout.order?.id || checkout.button?.sandbox !== true || checkout.button.productType !== 'PayOnly' || checkout.button.ledgerCurrency !== 'USD') {
      throw new Error('Sandbox checkout is unavailable.');
    }
    return checkout;
  }).catch(error => { preparedCheckouts.delete(request.idempotencyKey); throw error; });
  preparedCheckouts.set(request.idempotencyKey, preparation);
  if (preparedCheckouts.size > 12) preparedCheckouts.delete(preparedCheckouts.keys().next().value!);
  return preparation;
}

export const AMAZON_PAY_RETURN_KEY = 'loop-amazon-pay-return-v1';
export type AmazonPayReturn = { orderId: string | null; checkoutSessionId: string | null };
function nonempty(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() && value.length <= maxLength ? value.trim() : null;
}
export function readAmazonPayReturn(url: URL, stored: string | null): AmazonPayReturn | null {
  if (url.searchParams.get('amazonPayReturn') === '1') {
    return { orderId: nonempty(url.searchParams.get('orderId'), 100), checkoutSessionId: nonempty(url.searchParams.get('amazonCheckoutSessionId'), 250) };
  }
  try {
    const value = stored ? JSON.parse(stored) : null;
    if (!value || typeof value !== 'object') return null;
    const orderId = nonempty(value.orderId, 100), checkoutSessionId = nonempty(value.checkoutSessionId, 250);
    return orderId ? { orderId, checkoutSessionId } : null;
  } catch { return null; }
}
export function clearAmazonPayReturnQuery(url: URL): URL {
  const cleaned = new URL(url);
  if (cleaned.searchParams.get('amazonPayReturn') !== '1') return cleaned;
  for (const key of ['amazonPayReturn', 'orderId', 'amazonCheckoutSessionId']) cleaned.searchParams.delete(key);
  return cleaned;
}

export default function AmazonPayButton({ request, disabled, language, onStart, onPrepared, onBusy }: {
  request: CheckoutRequest; disabled: boolean; language: Language;
  onStart: () => void; onPrepared: (order: Order) => void; onBusy: (busy: boolean) => void;
}) {
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [button, setButton] = useState<AmazonPayButtonConfig | null>(null);
  const root = useRef<HTMLDivElement>(null), active = useRef(false), mounted = useRef(true);
  const buttonId = `loop-amazon-pay-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!button || !root.current) return;
    const container = root.current;
    container.replaceChildren(); setPhase('ready');
    try {
      if (!window.amazon?.Pay) throw new Error('Amazon Pay is unavailable.');
      window.amazon.Pay.renderButton(`#${buttonId}`, { ...button, onError: () => { if (mounted.current) setPhase('error'); } });
    } catch { setPhase('error'); }
    return () => container.replaceChildren();
  }, [button, buttonId]);
  const prepare = async () => {
    if (disabled || active.current) return;
    active.current = true; setPhase('loading'); onBusy(true); onStart();
    try {
      const [checkout] = await Promise.all([prepareCheckout(request), loadSDK()]);
      if (!mounted.current) return;
      onPrepared(checkout.order); setButton({ ...checkout.button });
    } catch { if (mounted.current) setPhase('error'); }
    finally { active.current = false; onBusy(false); }
  };
  return <div className="amazon-pay-option">
    <div className="payment-option-heading"><strong>Amazon Pay</strong><span>{text('SANDBOX', '沙盒测试')}</span></div>
    <p>{text('Try Amazon checkout with a sandbox buyer account. No real charge or shipping.', '用沙盒买家账号体验 Amazon 结账，不会真实扣款或发货。')}</p>
    {phase === 'idle' && <button className="secondary full-width" disabled={disabled} onClick={() => void prepare()}>{text('Continue with Amazon Pay sandbox', '使用 Amazon Pay 沙盒结账')}</button>}
    {phase === 'loading' && <div className="amazon-pay-loading" role="status"><span className="spinner" />{text('Preparing Amazon Pay…', '正在准备 Amazon Pay…')}</div>}
    <div id={buttonId} ref={root} className="amazon-pay-button" hidden={phase !== 'ready'} inert={disabled} aria-label={text('Amazon Pay sandbox checkout', 'Amazon Pay 沙盒结账')} />
    {phase === 'ready' && <p className="amazon-pay-instruction">{text('Select the Amazon Pay button to open the sandbox checkout.', '点击 Amazon Pay 按钮，打开沙盒收银台。')}</p>}
    {phase === 'error' && <><p role="alert" className="amazon-pay-error">{text('Amazon Pay could not open. Your design is kept; try again.', 'Amazon Pay 暂时无法打开。搭配已保留，可以重试。')}</p><button className="secondary full-width" disabled={disabled} onClick={() => void prepare()}>{text('Try Amazon Pay again', '重试 Amazon Pay')}</button></>}
  </div>;
}
