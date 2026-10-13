import { useLanguage, LanguageSwitcher, LanguageProvider } from '../Language';
import { Component, Suspense, lazy, useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { prepareInlineAssets } from './inlineAssets';
import { CharmPreview } from '../CharmArt';
import { PartImage } from './PartImage';
import { validateConfig, validateName } from '../../shared/domain';
import { CHARM_PREVIEW_ASSETS, TOTE_PREVIEW_ASSETS } from '../../shared/previewAssets';
import { designSignature } from '../../shared/designState';
import { localizeCatalog } from '../../shared/localization';
import type { DesignConfig, Quote, SavedDesign, Order } from '../../shared/types';
import { checkoutExpired, isSaved, modelContext, reconcileSavedDesign, type Preview, type Checkout } from './state';
import './widget.css';

declare global { interface Window { __LOOP_WIDGET__: { assetOrigin: string } } }
const Scene = lazy(() => import('../CharmScene'));
const bridge = new App({ name: 'LOOP design preview', version: '2.1.0' }, {}, { autoResize: true });
type Result = { isError?: boolean; structuredContent?: Record<string, unknown>; content?: unknown };
type Action = 'quote' | 'lock' | 'save' | 'prepare' | 'confirm';
type Edit = { name: string; config: DesignConfig };
function data<T>(result: Result): T {
  if (result.isError) {
    let message = result.structuredContent?.error;
    if (!message && Array.isArray(result.content)) {
      const text = result.content.find(item => item.type === 'text')?.text;
      try { message = JSON.parse(text).error; } catch { /* Keep a useful fallback for protocol errors. */ }
    }
    throw new Error(typeof message === 'string' ? message : '操作没有完成，请重试。');
  }
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
  const { tr, language, money, locale } = useLanguage();
  const [rawPreview, setPreview] = useState<Preview>();
  const [incomingRevision, setIncomingRevision] = useState(0);
  const preview = useMemo(() => rawPreview ? { ...rawPreview, catalog: localizeCatalog(rawPreview.catalog, language) } : undefined, [rawPreview, language]);
  const [connected, setConnected] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Action>(), busyRef = useRef(false), revision = useRef(0);
  const [syncWarning, setSyncWarning] = useState(''), contextRevision = useRef(0);
  const [checkout, setCheckout] = useState<Checkout>(), [order, setOrder] = useState<Order>();
  const [receiptCollapsed, setReceiptCollapsed] = useState(false), [now, setNow] = useState(Date.now);
  const [sceneFailed, setSceneFailed] = useState(false), [bag, setBag] = useState(false), [ready, setReady] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0), [resetKey, setResetKey] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false), [assetAttempt, setAssetAttempt] = useState(0);
  const [selectionSlot, setSelectionSlot] = useState<string>(), [search, setSearch] = useState('');
  const [history, setHistory] = useState<Edit[]>([]);
  const [renaming, setRenaming] = useState(false), [nameInput, setNameInput] = useState('');
  const pickerHeading = useRef<HTMLHeadingElement>(null), checkoutHeading = useRef<HTMLHeadingElement>(null), receiptHeading = useRef<HTMLHeadingElement>(null);
  const slotButtons = useRef(new Map<string, HTMLButtonElement>());
  const call = async <T,>(name: string, args: Record<string, unknown>) => data<T>(await bridge.callServerTool({ name, arguments: args }));

  useEffect(() => {
    bridge.ontoolresult = result => {
      try {
        const value = data<Preview>(result);
        if (!value.config || !value.catalog || !value.quote) throw new Error(tr('没有收到完整的预览。'));
        validateConfig(value.config);
        revision.current++;
        setIncomingRevision(revision.current);
        setPreview(value); setSelectionSlot(value.selectionSlot); setSearch(''); setCheckout(undefined); setOrder(undefined);
        setHistory([]); setRenaming(false); setReceiptCollapsed(false); setError(''); setNotice('');
        setSceneFailed(false); setReady(false); setSceneVersion(version => version + 1);
        setAssetAttempt(attempt => attempt + 1);
      } catch (e) { setError((e as Error).message); }
    };
    bridge.onhostcontextchanged = ctx => { if (ctx.theme) document.documentElement.dataset.theme = ctx.theme; };
    void bridge.connect().then(() => {
      setConnected(true);
      document.documentElement.dataset.theme = bridge.getHostContext()?.theme ?? 'light';
    }).catch(() => setError(tr('请在已连接 LOOP 的对话中打开预览。')));
    return () => { void bridge.close(); };
  }, []);
  useEffect(() => {
    if (!connected || !rawPreview?.designId || isSaved(rawPreview)) return;
    let active = true;
    const source = rawPreview;
    // A model can save and preview concurrently. Refresh only the persisted
    // baseline; never replace the user's current name or editable choices.
    void (async () => {
      for (const delay of [0, 1500, 3000]) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (!active || revision.current !== incomingRevision || busyRef.current) return;
        try {
          const {design} = await call<{design: SavedDesign}>('loop_get_design', {id: source.designId});
          if (!active || revision.current !== incomingRevision || busyRef.current) return;
          setPreview(current => current && !isSaved(current) ? reconcileSavedDesign(current, design) : current);
          if (isSaved(reconcileSavedDesign(source, design))) return;
        } catch { return; }
      }
    })();
    return () => {active = false;};
  }, [connected, incomingRevision]);
  useEffect(() => {
    if (!rawPreview || !connected) return;
    const current = ++contextRevision.current;
    void bridge.updateModelContext({ structuredContent: modelContext(rawPreview, language, checkout, order) })
      .then(() => { if (current === contextRevision.current) setSyncWarning(''); })
      .catch(() => { if (current === contextRevision.current) setSyncWarning('当前客户端未同步卡片状态；继续修改时，请在对话中说明要保留的配件。'); });
  }, [rawPreview, language, checkout, order, connected]);
  useEffect(() => {
    if (!connected) return;
    let active=true;
    void prepareInlineAssets(async path => {
      const result=await bridge.callServerTool({name:'loop_get_preview_asset',arguments:{path}});
      if(result.isError) throw new Error('Preview asset unavailable');
      return result._meta?.asset as {mime:string;base64:string};
    }, bag ? TOTE_PREVIEW_ASSETS : CHARM_PREVIEW_ASSETS).then(()=>{if(active)setAssetsReady(true);}).catch(error=>{
      console.warn('LOOP_PREVIEW_ASSETS_FAILED', error instanceof Error ? error.message : 'Asset unavailable');
      if(active)setSceneFailed(true);
    });
    return()=>{active=false;};
  }, [connected, assetAttempt, bag]);
  useEffect(() => {
    if (!rawPreview || !assetsReady || ready || sceneFailed) return;
    const timer = setTimeout(() => setSceneFailed(true), 25_000);
    return () => clearTimeout(timer);
  }, [!!rawPreview, assetsReady, ready, sceneFailed, sceneVersion]);
  useEffect(() => {
    if (!checkout) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    checkoutHeading.current?.focus();
    return () => clearInterval(timer);
  }, [checkout]);
  useEffect(() => { if (selectionSlot) { setSearch(''); pickerHeading.current?.focus(); } }, [selectionSlot]);
  useEffect(() => { if (order) receiptHeading.current?.focus(); }, [order]);
  async function run(action: Action, work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setPending(action); setError(''); setNotice('');
    try { await work(); } catch (e) { setError((e as Error).message || tr('连接暂时不可用，请重试。')); }
    finally { busyRef.current = false; setPending(undefined); }
  }
  if (!preview) return <main className="loop-card empty"><span className="wordmark">LOOP</span><LanguageSwitcher/><p role={error ? 'alert' : 'status'}>{tr(error) || tr('正在接收你的设计…')}</p><p>{tr('在对话中告诉我风格、颜色和预算，搭配会显示在这里。')}</p></main>;
  const config = preview.config, template = preview.catalog.templates.find(t => t.id === config.templateId)!;
  const disabled = !!pending || !connected, saved = isSaved(preview), expired = !!checkout && checkoutExpired(checkout, now);
  const selectedSlot = template.slots.find(slot => slot.id === selectionSlot);
  const selectedLocked = !!selectedSlot && config.lockedSlots.includes(selectedSlot.id);
  const currentPart = preview.catalog.parts.find(part => selectedSlot && part.id === config.slots[selectedSlot.id]);
  const validChoice = (slot: string, partId: string | null) => {
    try { validateConfig({ ...config, slots: { ...config.slots, [slot]: partId } }); return true; } catch { return false; }
  };
  const choices = selectedSlot ? preview.catalog.parts.filter(part => selectedSlot.categories.includes(part.category) && validChoice(selectedSlot.id, part.id))
    .sort((a, b) => selectedSlot.categories.indexOf(a.category) - selectedSlot.categories.indexOf(b.category)) : [];
  const query = search.trim().toLocaleLowerCase();
  const filteredChoices = choices.filter(part => [part.name, part.material, ...part.tags].join(' ').toLocaleLowerCase().includes(query));
  const actionText = pending ? tr({ quote: '正在更新搭配…', lock: '正在更新保留的位置…', save: '正在保存设计…', prepare: '正在核对配件与报价…', confirm: '正在确认测试订单…' }[pending]) : '';
  const openPicker = (slot: string) => { if (!disabled && !checkout) setSelectionSlot(slot); };
  const closePicker = () => { const slot = selectionSlot; setSelectionSlot(undefined); if (slot) slotButtons.current.get(slot)?.focus(); };
  const fallback = <CharmPreview config={config} catalog={preview.catalog} bag={bag} selectedSlot={selectionSlot} onSelectSlot={disabled || checkout ? undefined : openPicker}/>;
  const remember = () => setHistory(items => [...items.slice(-19), {name: preview.name, config: structuredClone(config)}]);
  const edited = (next: Preview) => { revision.current++; setPreview(next); setCheckout(undefined); setOrder(undefined); setReceiptCollapsed(false); };
  async function updateConfig(nextConfig: DesignConfig) {
    const current = preview!, rev = revision.current;
    const quoted = await call<{ config: DesignConfig; quote: Quote }>('loop_quote_design', { config: nextConfig });
    if (rev !== revision.current) return;
    remember(); edited({ ...current, ...quoted });
  }
  async function selectPart(slot: string, partId: string | null) {
    if (config.slots[slot] === partId) return;
    if (config.lockedSlots.includes(slot)) throw new Error(tr('请先解锁这个位置，再更换配件。'));
    await updateConfig({ ...config, slots: { ...config.slots, [slot]: partId } });
  }
  async function lock(slot: string) {
    const locked = config.lockedSlots;
    await updateConfig({ ...config, lockedSlots: locked.includes(slot) ? locked.filter(id => id !== slot) : [...locked, slot] });
  }
  async function undo() {
    const previous = history.at(-1), rev = revision.current;
    if (!previous) return;
    const quoted = await call<{config: DesignConfig; quote: Quote}>('loop_quote_design', {config: previous.config});
    if (rev !== revision.current) return;
    edited({...preview!, ...quoted, name: previous.name}); setHistory(items => items.slice(0, -1));
  }
  async function save() {
    if (isSaved(preview!)) return;
    const current = preview!, rev = revision.current;
    const result = await call<{design: SavedDesign}>('loop_save_design', {name: current.name, config: current.config, ...(current.designId ? {id: current.designId} : {})});
    if (rev !== revision.current) return;
    const design = result.design;
    setPreview({...current, name: design.name, config: design.config, designId: design.id, savedSignature: designSignature(design.config, design.name)});
    setNotice('设计已保存到当前对话的收藏。');
  }
  async function prepare() {
    const rev = revision.current;
    const prepared = await call<Checkout>('loop_prepare_test_order', {designName: preview!.name, config: preview!.config});
    if (rev === revision.current) { setNow(Date.now()); setCheckout(prepared); setOrder(undefined); setSelectionSlot(undefined); }
  }
  async function confirm() {
    const current = checkout!, rev = revision.current;
    if (checkoutExpired(current)) throw new Error(tr('报价确认已过期，请重新查看测试订单。'));
    const result = await call<{order: Order}>('loop_confirm_test_order', {confirmationToken: current.confirmationToken, confirmed: true});
    if (rev !== revision.current) return;
    setOrder(result.order); setReceiptCollapsed(false); setCheckout(undefined); setNotice('测试订单已确认，未扣款，不会发货。');
  }
  function rename() {
    try {
      const name = validateName(nameInput);
      if (name !== preview!.name) { remember(); edited({...preview!, name}); }
      setRenaming(false); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  const partPicker = selectedSlot && <section id="part-picker" className="part-picker" aria-label={tr('选择配件') + ' · ' + selectedSlot.name}>
        <div className="picker-heading"><div><small>{tr('替换配件')}</small><h2 ref={pickerHeading} tabIndex={-1}>{selectedSlot.name}</h2></div><button aria-label={tr('关闭配件选择')} onClick={closePicker}>{tr('完成')}</button></div>
        {selectedLocked ? <div className="picker-locked"><p>{tr('请先解锁这个位置，再更换配件。')}</p><button disabled={disabled || !!checkout} onClick={() => void run('lock', () => lock(selectedSlot.id))}>{tr('解锁并继续选择')}</button></div>
          : <p className="picker-hint">{tr('点选卡片，查看更新后的搭配与总价。')}</p>}
        <input className="part-search" aria-label={tr('搜索配件')} placeholder={tr('按名称或材质寻找配件')} value={search} onChange={event => setSearch(event.target.value)}/>
        <div className="part-options">{filteredChoices.map(part => {
          const selected = config.slots[selectedSlot.id] === part.id;
          return <button key={part.id} className={'part-option ' + (selected ? 'selected' : '')} disabled={disabled || selectedLocked || !!checkout || selected} aria-pressed={selected} aria-label={part.name} onClick={() => void run('quote', () => selectPart(selectedSlot.id, part.id))}>
            <span className="part-image"><PartImage part={part} metalTone={config.metalTone}/>{selected && <span className="selected-badge">{tr('当前')}</span>}</span>
            <span className="part-name">{part.name}</span><small className="part-material">{part.material}</small><span className="part-cost">{money(part.price, preview.quote.currency)}</span>
            {!selected && <small className="choice-total">{tr('搭配总价')} {money(preview.quote.total - (currentPart?.price ?? 0) + part.price, preview.quote.currency)}</small>}
          </button>;
        })}{!query && validChoice(selectedSlot.id, null) && <button className={'part-option empty-option ' + (config.slots[selectedSlot.id] === null ? 'selected' : '')} disabled={disabled || selectedLocked || !!checkout || config.slots[selectedSlot.id] === null} aria-pressed={config.slots[selectedSlot.id] === null} onClick={() => void run('quote', () => selectPart(selectedSlot.id, null))}>
          <span className="part-image"><span className="empty-symbol">—</span></span><span className="part-name">{tr('不加配件')}</span><small className="part-material">{tr('保留简洁')}</small><span className="part-cost">{money(0, preview.quote.currency)}</span><small className="choice-total">{tr('搭配总价')} {money(preview.quote.total - (currentPart?.price ?? 0), preview.quote.currency)}</small>
        </button>}</div>
        {query && filteredChoices.length === 0 && <div className="picker-empty"><p>{tr('没有找到匹配的配件。')}</p><button onClick={() => setSearch('')}>{tr('清除搜索')}</button></div>}
      </section>;
  return <main className="loop-card" aria-busy={!!pending}>
    <header><span className="wordmark">LOOP<span>CHARM STUDIO</span></span><LanguageSwitcher/><span className="tag">{tr('你的专属搭配')}</span></header>
    <div className={selectedSlot ? "preview-row choosing" : "preview-row"}><section className="preview" aria-label={tr('包挂设计预览')} data-render-state={sceneFailed ? 'failed' : ready ? 'ready' : 'loading'}>
      {!ready && !sceneFailed && <div className="preview-placeholder" aria-hidden="true">{fallback}</div>}
      {!sceneFailed && assetsReady ? <SceneBoundary key={sceneVersion} fallback={fallback} onError={() => setSceneFailed(true)}><Suspense fallback={null}>
        <Scene config={config} catalog={preview.catalog} bag={bag} bagStyle="tote" motion={false} physics={false} resetKey={resetKey}
          selectedSlot={selectionSlot} showMarkers={!!selectionSlot} onSelectSlot={disabled || checkout ? undefined : openPicker}
          onReady={() => { setReady(true); console.warn('LOOP_3D_READY inline-assets-v2'); }} onError={() => setSceneFailed(true)}/>
      </Suspense></SceneBoundary> : sceneFailed ? fallback : null}
      <div className="view-controls">
        {sceneFailed ? <button onClick={() => {setSceneFailed(false); setReady(false); if(!assetsReady)setAssetAttempt(attempt=>attempt+1); setSceneVersion(version => version + 1);}}>{tr('重试 3D 预览')}</button>
          : <button disabled={!ready} onClick={() => setResetKey(key => key + 1)}>{tr('复位视角')}</button>}
        <button aria-pressed={bag} disabled={!ready && !sceneFailed} onClick={() => {setReady(false); setAssetsReady(false); setSceneFailed(false); setSceneVersion(version => version + 1); setBag(!bag);}}>{bag ? tr('只看包挂') : tr('挂包效果')}</button>
      </div>
      <span className="preview-note" role={!ready && !sceneFailed ? 'status' : undefined}>{sceneFailed ? tr('3D 暂不可用，已展示设计插画') : !ready ? tr('正在加载 3D 预览…') : tr('拖动旋转 · 滚轮缩放 · 点选配件')}</span>
    </section>{partPicker}</div>
    <section className="details">
      <div className="title-row"><div>
        {renaming ? <div className="name-form" role="group" aria-label={tr('设计名称')}><label htmlFor="design-name">{tr('设计名称')}</label><input id="design-name" autoFocus value={nameInput} maxLength={50} onChange={event => setNameInput(event.target.value)} onKeyDown={event => {if(event.key === 'Enter' && !disabled) {event.preventDefault(); rename();}}}/><div><button type="button" disabled={disabled} onClick={rename}>{tr('使用这个名字')}</button><button type="button" onClick={() => setRenaming(false)}>{tr('取消')}</button></div></div>
          : <div className="design-name"><h1>{preview.name}</h1><button disabled={disabled || !!checkout} aria-label={tr('修改设计名称')} onClick={() => {setNameInput(preview.name); setRenaming(true);}}>{tr('改名')}</button></div>}
        <p>{template.name} · {config.metalTone === 'gold' ? tr('金色') : tr('银色')} {tr('五金')}</p>
      </div><strong className="price">{money(preview.quote.total, preview.quote.currency)}<small>{preview.quote.currency}</small></strong></div>
      <div className="design-status"><span>{saved ? tr('已保存到当前对话的收藏') : preview.designId ? tr('有未保存的修改') : tr('尚未保存这份设计')}</span><button disabled={disabled || !!checkout || history.length === 0} onClick={() => void run('quote', undo)}>{tr('撤销上一步')}</button></div>
      <div className="parts" aria-label={tr('保留配件')}>{template.slots.map(slot => {
        const part = preview.catalog.parts.find(p => p.id === config.slots[slot.id]), locked = config.lockedSlots.includes(slot.id);
        return <div className="slot-control" key={slot.id}><button ref={element => {if (element) slotButtons.current.set(slot.id, element); else slotButtons.current.delete(slot.id);}}
          disabled={disabled || !!checkout} className={'slot-change ' + (selectionSlot === slot.id ? 'active' : '')} aria-expanded={selectionSlot === slot.id} aria-controls="part-picker" aria-label={tr('更换') + ' ' + slot.name}
          onClick={() => selectionSlot === slot.id ? closePicker() : openPicker(slot.id)}>
          {part ? <PartImage part={part} metalTone={config.metalTone}/> : <span className="empty-part">—</span>}<span><small>{slot.name}</small>{part?.name || tr('留空')}</span><span className="change-label">{tr('更换')}</span>
        </button><button disabled={disabled || !!checkout} className={'slot-lock ' + (locked ? 'locked' : '')} aria-pressed={locked} aria-label={(locked ? tr('解锁') : tr('锁定')) + ' ' + slot.name} onClick={() => void run('lock', () => lock(slot.id))}>{locked ? tr('已锁定') : tr('锁定')}</button></div>;
      })}</div>
      <p className="hint">{tr('点击更换，预览不同配件；锁定想保留的位置。')}</p>
      <details open={!!checkout}><summary>{tr('价格明细')}</summary><ul className="quote-lines">{(checkout?.quote ?? preview.quote).lines.map(line => <li key={line.id}><span>{tr(line.name)}{line.quantity > 1 ? ' × ' + line.quantity : ''}</span><span>{money(line.subtotal, (checkout?.quote ?? preview.quote).currency)}</span></li>)}</ul></details>
      {checkout ? <section className="checkout" aria-label={tr('确认测试订单')}><h2 ref={checkoutHeading} tabIndex={-1}>{tr('确认这份测试订单')}</h2>
        <p>{checkout.designName} · {money(checkout.quote.total, checkout.quote.currency)}</p><p>{tr('请核对上方设计与价格明细。仅记录测试订单，不会扣款、锁定库存或发货。')}</p>
        <p className="quote-validity" role="status">{expired ? tr('这份报价已过期，请刷新后再确认。') : tr('报价保留至 {0}', new Date(checkout.expiresAt).toLocaleTimeString(locale, {hour:'2-digit', minute:'2-digit'}))}</p>
        <div className="actions"><button disabled={disabled} onClick={() => {setCheckout(undefined); setError('');}}>{tr('继续修改')}</button>
          <button className="primary" disabled={disabled} onClick={() => void run(expired ? 'prepare' : 'confirm', expired ? prepare : confirm)}>{pending === 'confirm' ? tr('正在确认测试订单…') : expired ? tr('刷新报价') : tr('确认创建测试订单')}</button></div>
      </section> : <div className="actions"><button disabled={disabled || saved || renaming} onClick={() => void run('save', save)}>{pending === 'save' ? tr('正在保存设计…') : saved ? tr('已保存') : preview.designId ? tr('保存修改') : tr('保存设计')}</button>
        <button className="primary" disabled={disabled || !!order || renaming} onClick={() => void run('prepare', prepare)}>{pending === 'prepare' ? tr('正在核对配件与报价…') : order ? tr('测试订单已确认') : tr('查看测试订单')}</button></div>}
      {order && !receiptCollapsed && <section className="order-receipt" aria-label={tr('测试订单回执')}><h2 ref={receiptHeading} tabIndex={-1}>{tr('测试订单已确认')}</h2><p>{tr('测试订单已确认，未扣款，不会发货。')}</p><dl><div><dt>{tr('订单编号')}</dt><dd>{order.id.slice(0, 8).toUpperCase()}</dd></div><div><dt>{tr('搭配总价')}</dt><dd>{money(order.quote.total, order.quote.currency)}</dd></div></dl><button onClick={() => {setReceiptCollapsed(true); openPicker(template.slots[0].id);}}>{tr('继续编辑这份搭配')}</button></section>}
      <p className="notice" role="status">{actionText || tr(notice)}</p>{syncWarning && <p className="sync-warning" role="status">{tr(syncWarning)}</p>}
      {error && <p className="error" role="alert">{tr(error)}</p>}
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Widget/></LanguageProvider>);
