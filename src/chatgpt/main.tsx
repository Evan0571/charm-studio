import { useLanguage, LanguageSwitcher, LanguageProvider } from '../Language';
import { Component, Suspense, lazy, useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { DefaultLoadingManager } from 'three';
import { CharmPreview } from '../CharmArt';
import { localizeCatalog } from '../../shared/localization';
import type { Catalog, DesignConfig, Quote, SavedDesign, Order } from '../../shared/types';
import './widget.css';

declare global { interface Window { __LOOP_WIDGET__: { assetOrigin: string } } }
const assetOrigin = window.__LOOP_WIDGET__.assetOrigin;
DefaultLoadingManager.setURLModifier(url => url.startsWith('/assets/') ? `${assetOrigin}${url}` : url);
const Scene = lazy(() => import('../CharmScene'));
const bridge = new App({ name: 'LOOP design preview', version: '1.0.0' }, {}, { autoResize: true });
type Preview = { name: string; config: DesignConfig; quote: Quote; catalog: Catalog; designId?: string };
type Checkout = { confirmationToken: string; designName: string; config: DesignConfig; quote: Quote; expiresAt: string; notice: string };
type Result = { isError?: boolean; structuredContent?: Record<string, unknown>; content?: unknown };
function data<T>(result: Result): T {
  if (result.isError) throw new Error(String(result.structuredContent?.error || '操作没有完成，请重试。'));
  if (!result.structuredContent) throw new Error('没有收到有效的设计数据。');
  return result.structuredContent as T;
}
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Widget() {
 const { tr, language, money } = useLanguage();
  const [rawPreview, setPreview] = useState<Preview>();
  const preview = useMemo(() => rawPreview ? { ...rawPreview, catalog: localizeCatalog(rawPreview.catalog, language) } : undefined, [rawPreview, language]);
  const [connected, setConnected] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), busyRef = useRef(false), revision = useRef(0);
  const [checkout, setCheckout] = useState<Checkout>(), [order, setOrder] = useState<Order>();
  const [three, setThree] = useState(false), [sceneFailed, setSceneFailed] = useState(false), [bag, setBag] = useState(false);
  const [ready, setReady] = useState(false);
  const call = async <T,>(name: string, args: Record<string, unknown>) => data<T>(await bridge.callServerTool({ name, arguments: args }));
  const context = async (value: Preview) => {
    try { await bridge.updateModelContext({ structuredContent: { name: value.name, config: value.config, quote: value.quote, designId: value.designId, testOrdersOnly: true } }); }
    catch { setNotice(tr("当前客户端未同步卡片状态；继续修改时，请在对话中说明要保留的配件。")); }
  };
  useEffect(() => {
    bridge.ontoolresult = result => {
      try {
        const value = data<Preview>(result);
        if (!value.config || !value.catalog || !value.quote) throw new Error(tr("没有收到完整的预览。"));
        revision.current++; setPreview(value); setCheckout(undefined); setOrder(undefined); setError(''); setNotice('');
      } catch (e) { setError((e as Error).message); }
    };
    bridge.onhostcontextchanged = ctx => { if (ctx.theme) document.documentElement.dataset.theme = ctx.theme; };
    void bridge.connect().then(() => {
      setConnected(true);
      document.documentElement.dataset.theme = bridge.getHostContext()?.theme ?? 'light';
    }).catch(() => setError(tr("请在已连接 LOOP 的对话中打开预览。")));
    return () => { void bridge.close(); };
  }, []);
  useEffect(() => {
    if (!three || ready || sceneFailed) return;
    const timer = setTimeout(() => { setSceneFailed(true); }, 25_000);
    return () => clearTimeout(timer);
  }, [three, ready, sceneFailed]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError((e as Error).message || tr("连接暂时不可用，请重试。")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  if (!preview) return <main className="loop-card empty"><span className="wordmark">LOOP</span><LanguageSwitcher/><p role="status">{tr(error) || tr("正在接收你的设计…")}</p></main>;
  const config = preview.config, template = preview.catalog.templates.find(t => t.id === config.templateId)!;
  const fallback = <CharmPreview config={config} catalog={preview.catalog} bag={bag}/>;
  const disabled = busy || !connected;
  async function lock(slot: string) {
    const current = preview!, rev = revision.current;
    const locked = current.config.lockedSlots;
    const nextConfig = { ...current.config, lockedSlots: locked.includes(slot) ? locked.filter(id => id !== slot) : [...locked, slot] };
    const quoted = await call<{ config: DesignConfig; quote: Quote }>('loop_quote_design', { config: nextConfig });
    if (rev !== revision.current) return;
    const next = { ...current, ...quoted };
    setPreview(next); setCheckout(undefined); setOrder(undefined); await context(next);
  }
  async function save() {
    const current = preview!, rev = revision.current;
    const result = await call<{ design: SavedDesign }>('loop_save_design', { name: current.name, config: current.config, ...(current.designId ? { id: current.designId } : {}) });
    if (rev !== revision.current) return;
    const next = { ...current, designId: result.design.id };
    setPreview(next); setNotice(tr("设计已保存到你的 LOOP 工作台。")); await context(next);
  }
  async function prepare() {
    const rev = revision.current;
    const prepared = await call<Checkout>('loop_prepare_test_order', { designName: preview!.name, config: preview!.config });
    if (rev === revision.current) { setCheckout(prepared); setOrder(undefined); }
  }
  async function confirm() {
    const current = checkout!, rev = revision.current;
    if (Date.parse(current.expiresAt) <= Date.now()) { setCheckout(undefined); throw new Error(tr("报价确认已过期，请重新查看测试订单。")); }
    const result = await call<{ order: Order }>('loop_confirm_test_order', { confirmationToken: current.confirmationToken, confirmed: true });
    if (rev !== revision.current) return;
    setOrder(result.order); setCheckout(undefined); setNotice(tr("测试订单已确认，未扣款，不会发货。"));
    await bridge.updateModelContext({ structuredContent: { order: result.order, testOrdersOnly: true } }).catch(() => {});
  }
  return <main className="loop-card" aria-busy={busy}>
    <header><span className="wordmark">LOOP<span>CHARM STUDIO</span></span><LanguageSwitcher/><span className="tag">{tr("你的专属搭配")}</span></header>
    <section className="preview" aria-label={tr("包挂设计预览")}>
      {three && !sceneFailed ? <SceneBoundary fallback={fallback} onError={() => setSceneFailed(true)}><Suspense fallback={fallback}><Scene config={config} catalog={preview.catalog} bag={bag} bagStyle="tote" motion={false} onReady={() => setReady(true)} onError={() => setSceneFailed(true)}/></Suspense></SceneBoundary> : fallback}
      <div className="view-controls"><button disabled={three && !sceneFailed} onClick={() => { setThree(true); setSceneFailed(false); setReady(false); }}>{tr("查看 3D")}</button><button aria-pressed={bag} onClick={() => setBag(!bag)}>{bag ? tr("只看包挂") : tr("挂包效果")}</button></div>
      {sceneFailed && <span className="preview-note">{tr("3D 暂不可用，已展示设计插画")}</span>}
    </section>
    <section className="details"><div className="title-row"><div><h1>{preview.name}</h1><p>{template.name} · {config.metalTone === 'gold' ? tr("金色") : tr("银色")} {tr("五金")}</p></div><strong className="price">{money(preview.quote.total, preview.quote.currency)}<small>{preview.quote.currency}</small></strong></div>
      <div className="parts" aria-label={tr("保留配件")}>{template.slots.map(slot => {
        const part = preview.catalog.parts.find(p => p.id === config.slots[slot.id]);
        const locked = config.lockedSlots.includes(slot.id);
        return <button key={slot.id} disabled={disabled || !!checkout} className={locked ? 'locked' : ''} aria-pressed={locked} aria-label={`${locked ? tr("解锁") : tr("锁定")} ${slot.name}`} onClick={() => void run(() => lock(slot.id))}><span>{slot.name}</span>{part?.name || tr("留空")}<small>{locked ? tr("已锁定") : tr("锁定")}</small></button>;
      })}</div>
      <p className="hint">{tr("锁定喜欢的配件，再在对话里告诉我怎么改。")}</p>
      <details open={!!checkout}><summary>{tr("价格明细")}</summary><ul className="quote-lines">{(checkout?.quote ?? preview.quote).lines.map(line => <li key={line.id}><span>{tr(line.name)}{line.quantity > 1 ? ` × ${line.quantity}` : ''}</span><span>{money(line.subtotal, (checkout?.quote ?? preview.quote).currency)}</span></li>)}</ul></details>
      {checkout ? <section className="checkout" aria-label={tr("确认测试订单")}><h2>{tr("确认这份测试订单")}</h2><p>{checkout.designName} · {money(checkout.quote.total, checkout.quote.currency)}</p><p>{tr("请核对上方设计与价格明细。仅记录测试订单，不会扣款、锁定库存或发货。")}</p><div className="actions"><button disabled={disabled} onClick={() => setCheckout(undefined)}>{tr("继续修改")}</button><button className="primary" disabled={disabled} onClick={() => void run(confirm)}>{tr("确认创建测试订单")}</button></div></section> : <div className="actions"><button disabled={disabled} onClick={() => void run(save)}>{preview.designId ? tr("保存修改") : tr("保存设计")}</button><button className="primary" disabled={disabled || !!order} onClick={() => void run(prepare)}>{order ? tr("测试订单已确认") : tr("查看测试订单")}</button></div>}
      {order && <p className="order-id">{tr("测试订单编号：")}{order.id}</p>}
      <p className="notice" role="status">{busy ? tr("正在处理…") : tr(notice)}</p>{error && <p className="error" role="alert">{tr(error)}</p>}
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Widget/></LanguageProvider>);
