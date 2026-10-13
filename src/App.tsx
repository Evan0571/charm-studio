import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CheckCheck, ChevronDown, CircleAlert, CircleHelp, Clock3, Copy, Heart, LockKeyhole, Minus, Move, Pause, Play, Plus, RotateCcw, RotateCw, Search, ShoppingBag, SlidersHorizontal, Trash2, UnlockKeyhole, X } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from './Language';
import type { Catalog, DesignConfig, Order, Part, PartCategory, Quote, SavedDesign, TemplateId } from '../shared/types';
import type { StylistProposal } from '../shared/stylist';
import { createDefaultConfig } from '../shared/catalog';
import { localizeCatalog } from '../shared/localization';
import { CharmPreview, PartArt } from './CharmArt';
import LandingPage from './LandingPage';
import AIStylist from './AIStylist';
import ProductPreview from './ProductPreview';
import AmazonPayButton, { AMAZON_PAY_RETURN_KEY, clearAmazonPayReturnQuery, readAmazonPayReturn, type AmazonPayReturn } from './AmazonPayButton';
import type { AmazonPayStatus } from '../shared/amazon-pay';
import { featuredDesigns } from './featuredDesigns';
import { designSignature, readWorkspaceDraft, storeWorkspaceDraft, visualKey, type WorkspaceDraft } from './workspaceDraft';
import { BAG_COLOR_PRESETS, BAG_DEFAULT_COLORS, normalizeBagColor } from './three/bagColors';
import './styles.css';
import './discovery.css';
import './atelier.css';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || '暂时连接不上，请稍后重试。');
  }
  return response.status === 204 ? undefined as T : response.json();
}
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
type Page = 'home' | 'search' | 'studio' | 'saved';
type ModalName = 'save' | 'checkout' | 'receipt' | 'payment' | 'help' | 'delete' | 'saved' | null;
type BagStyle = 'tote' | 'shoulder' | 'mini';
const readPage = (): Page => {
  const route = location.hash.slice(2);
  return route === 'search' || route === 'studio' || route === 'saved' ? route : 'home';
};
const previewCacheKey = 'loop-3d-preview-stills-v3';
function readPreviewCache(): Record<string, string> {
  try {
    const values = Object.entries(JSON.parse(localStorage.getItem(previewCacheKey) || '{}'))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].startsWith('data:image/') && entry[1].length < 900000);
    return Object.fromEntries(values.slice(-12));
  } catch { return {}; }
}
function readPaymentReturn(): AmazonPayReturn | null {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(AMAZON_PAY_RETURN_KEY); } catch { /* The URL still works without session storage. */ }
  return readAmazonPayReturn(new URL(location.href), stored);
}
function rememberPaymentReturn(value: AmazonPayReturn | null) {
  try { if (value) sessionStorage.setItem(AMAZON_PAY_RETURN_KEY, JSON.stringify(value)); else sessionStorage.removeItem(AMAZON_PAY_RETURN_KEY); }
  catch { /* In-memory retries remain available. */ }
}

export default function App() {
  const { tr, language, locale, money } = useLanguage();
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  const [rawCatalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState('');
  const catalog = useMemo(() => rawCatalog ? localizeCatalog(rawCatalog, language) : null, [rawCatalog, language]);
  const [page, updatePage] = useState<Page>(readPage);
  const [workspace, setWorkspace] = useState<WorkspaceDraft>(readWorkspaceDraft);
  const { config } = workspace;
  const fallbackName = featuredDesigns.find(item => item.config.templateId === config.templateId)?.name;
  const name = workspace.name ?? (fallbackName ? fallbackName[language === 'en' ? 'en' : 'zh'] : text('My little design', '我的小小作品'));
  const [history, setHistory] = useState<WorkspaceDraft[]>([]);
  const [future, setFuture] = useState<WorkspaceDraft[]>([]);
  const templateDrafts = useRef(new Map<TemplateId, WorkspaceDraft>());
  const draftSavedVersions = useRef(new Map<string, Pick<WorkspaceDraft, 'savedId' | 'savedSignature'>>([[workspace.draftId, { savedId: workspace.savedId, savedSignature: workspace.savedSignature }]]));
  const [draftStored, setDraftStored] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState('main');
  const [editorStep, setEditorStep] = useState<'style' | 'finish' | 'details'>('details');
  const [bag, setBag] = useState(false), [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState(''), [category, setCategory] = useState<'all' | PartCategory>('all');
  const [quote, setQuote] = useState<Quote | null>(null), [quoting, setQuoting] = useState(true);
  const [quoteError, setQuoteError] = useState(''), [quoteKey, setQuoteKey] = useState('');
  const [modal, setModal] = useState<ModalName>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [toast, setToast] = useState('');
  const [designs, setDesigns] = useState<SavedDesign[]>([]), [orders, setOrders] = useState<Order[]>([]);
  const [listLoading, setListLoading] = useState(false), [listError, setListError] = useState('');
  const [savedTab, setSavedTab] = useState<'designs' | 'orders'>('designs');
  const [receipt, setReceipt] = useState<Order | null>(null), [deleteTarget, setDeleteTarget] = useState<SavedDesign | null>(null);
  const [savedResult, setSavedResult] = useState<SavedDesign | null>(null);
  const [checkoutSnapshot, setCheckoutSnapshot] = useState<{ config: DesignConfig; quote: Quote; name: string; key: string } | null>(null);
  const [amazonPayStatus, setAmazonPayStatus] = useState<AmazonPayStatus | null>(null);
  const [amazonReturn, setAmazonReturn] = useState<AmazonPayReturn | null>(readPaymentReturn);
  const returnStarted = useRef(false);
  const [snapshots, setSnapshots] = useState<Record<string, string>>(readPreviewCache);
  const quoteSeq = useRef(0), mutating = useRef(false);
  const reviewTarget = useRef<{ config: DesignConfig; name: string } | null>(null);
  const validQuote = !!quote && !quoting && !quoteError && quoteKey === JSON.stringify(config);
  const isSaved = !!workspace.savedId && workspace.savedSignature === designSignature(config, name);

  const capture = useCallback((snapshotConfig: DesignConfig, url: string) => {
    if (!url.startsWith('data:image/') || url.length > 900000) return;
    const key = visualKey(snapshotConfig);
    setSnapshots(previous => {
      if (previous[key] === url) return previous;
      const next = Object.fromEntries([...Object.entries(previous).filter(([item]) => item !== key).slice(-11), [key, url]]);
      try { localStorage.setItem(previewCacheKey, JSON.stringify(next)); } catch { /* A full image cache does not interrupt editing. */ }
      return next;
    });
  }, []);
  const setPage = (next: Page) => {
    updatePage(next);
    const hash = next === 'home' ? '#/' : `#/${next}`;
    if (location.hash !== hash) window.history.pushState(null, '', hash);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const announce = (message: string) => setToast(message);
  const openModal = (next: ModalName) => { setActionError(''); setModal(next); };
  const closeModal = () => { if (!busy) { setModal(null); setActionError(''); } };

  useEffect(() => { api<Catalog>('/catalog').then(setCatalog).catch(error => setLoadError(error.message)); }, []);
  useEffect(() => { api<AmazonPayStatus>('/payments/amazon-pay/status', { signal: AbortSignal.timeout(10000) }).then(setAmazonPayStatus).catch(() => setAmazonPayStatus({ configured: false, environment: 'sandbox' })); }, []);
  useEffect(() => {
    const navigate = () => { updatePage(readPage()); if (location.hash.startsWith('#/')) window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('popstate', navigate); window.addEventListener('hashchange', navigate);
    return () => { window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); };
  }, []);
  useEffect(() => { setDraftStored(storeWorkspaceDraft(workspace)); }, [workspace]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const seq = ++quoteSeq.current;
    setQuoting(true); setQuoteError('');
    const timer = window.setTimeout(() => {
      api<Quote>('/quote', post({ config })).then(result => {
        if (seq !== quoteSeq.current) return;
        setQuote(result); setQuoteKey(JSON.stringify(config)); setQuoting(false);
      }).catch(error => { if (seq === quoteSeq.current) { setQuoteError(error.message); setQuoting(false); } });
    }, 180);
    return () => { window.clearTimeout(timer); quoteSeq.current++; };
  }, [config]);
  const refreshSaved = async () => {
    setListLoading(true); setListError('');
    try { const [saved, placed] = await Promise.all([api<SavedDesign[]>('/designs'), api<Order[]>('/orders')]); setDesigns(saved); setOrders(placed); }
    catch (error) { setListError((error as Error).message); }
    finally { setListLoading(false); }
  };
  useEffect(() => { if (page === 'saved') void refreshSaved(); }, [page]);
  const change = (next: DesignConfig) => {
    setHistory(items => [...items.slice(-29), structuredClone(workspace)]); setFuture([]);
    setWorkspace(previous => ({ ...previous, config: next }));
  };
  const restore = (next: WorkspaceDraft) => {
    setWorkspace({ ...structuredClone(next), ...draftSavedVersions.current.get(next.draftId) }); setSearch(''); setCategory('all');
    setSelectedSlot(catalog?.templates.find(item => item.id === next.config.templateId)?.slots[0].id || 'main');
  };
  const undo = () => {
    if (!history.length) return;
    setFuture(items => [structuredClone(workspace), ...items].slice(0, 30)); restore(history[history.length - 1]);
    setHistory(items => items.slice(0, -1)); announce(tr('已撤销上一步'));
  };
  const redo = () => {
    if (!future.length) return;
    setHistory(items => [...items.slice(-29), structuredClone(workspace)]); restore(future[0]);
    setFuture(items => items.slice(1)); announce(text('Change restored.', '已恢复这一步修改。'));
  };
  const startDesign = (next: DesignConfig, designName?: string) => {
    setHistory(items => [...items.slice(-29), structuredClone(workspace)]); setFuture([]);
    restore({ draftId: crypto.randomUUID(), config: structuredClone(next), name: designName || null }); setZoom(1); setBag(false); setPage('studio');
  };
  const chooseTemplate = (id: TemplateId) => {
    if (id === config.templateId) return;
    templateDrafts.current.set(config.templateId, structuredClone(workspace));
    setHistory(items => [...items.slice(-29), structuredClone(workspace)]); setFuture([]);
    const remembered = templateDrafts.current.get(id);
    const featured = featuredDesigns.find(item => item.config.templateId === id);
    restore(remembered || { draftId: crypto.randomUUID(), config: structuredClone(featured?.config || createDefaultConfig(id)), name: featured ? featured.name[language === 'en' ? 'en' : 'zh'] : null });
    setZoom(1); announce(text('Your other style is kept while you explore.', '切换样式了，刚才的搭配也为你保留着。'));
  };
  const save = async (asCopy = false) => {
    if (mutating.current || !name.trim()) return;
    mutating.current = true; setBusy(true); setActionError('');
    try {
      const result = await api<SavedDesign>('/designs', post({ name: name.trim(), config, id: asCopy ? undefined : workspace.savedId }));
      draftSavedVersions.current.set(workspace.draftId, { savedId: result.id, savedSignature: designSignature(result.config, result.name) });
      setWorkspace(previous => previous.draftId === workspace.draftId ? ({ ...previous, name: result.name, savedId: result.id, savedSignature: designSignature(result.config, result.name) }) : previous);
      setSavedResult(result); setModal('saved'); void refreshSaved();
    } catch (error) { setActionError((error as Error).message); }
    finally { mutating.current = false; setBusy(false); }
  };
  const review = async (reviewConfig = config, reviewName = name) => {
    if (mutating.current) return;
    reviewTarget.current = { config: structuredClone(reviewConfig), name: reviewName };
    mutating.current = true; setBusy(true); setCheckoutSnapshot(null); openModal('checkout');
    try {
      const authoritative = await api<Quote>('/quote', post({ config: reviewConfig }));
      setCheckoutSnapshot({ config: structuredClone(reviewConfig), quote: authoritative, name: reviewName, key: crypto.randomUUID() });
    } catch (error) { setActionError((error as Error).message); }
    finally { mutating.current = false; setBusy(false); }
  };
  const placeOrder = async () => {
    if (!checkoutSnapshot || mutating.current) return;
    mutating.current = true; setBusy(true); setActionError('');
    try {
      const order = await api<Order>('/orders', post({ designName: checkoutSnapshot.name, config: checkoutSnapshot.config, idempotencyKey: checkoutSnapshot.key }));
      setReceipt(order); setModal('receipt'); void refreshSaved();
    } catch (error) { setActionError((error as Error).message); }
    finally { mutating.current = false; setBusy(false); }
  };
  const keepCheckoutDraft = () => {
    if (!checkoutSnapshot) return;
    const next = designSignature(config, name) === designSignature(checkoutSnapshot.config, checkoutSnapshot.name)
      ? workspace : { draftId: crypto.randomUUID(), config: structuredClone(checkoutSnapshot.config), name: checkoutSnapshot.name };
    setWorkspace(next); setDraftStored(storeWorkspaceDraft(next));
  };
  const verifyAmazonPayment = async (details: AmazonPayReturn | null = amazonReturn) => {
    if (mutating.current) return;
    mutating.current = true; setBusy(true); setActionError(''); setPage('studio'); setModal('payment');
    try {
      if (!details?.orderId) throw new Error('Incomplete return');
      let checkoutSessionId = details.checkoutSessionId;
      if (!checkoutSessionId) {
        const existing = await api<Order>(`/orders/${encodeURIComponent(details.orderId)}`, { signal: AbortSignal.timeout(10000) });
        if (existing.payment?.provider !== 'amazon_pay') throw new Error('Incomplete return');
        if (existing.status !== 'sandbox_pending') { setReceipt(existing); setModal('receipt'); rememberPaymentReturn(null); void refreshSaved(); return; }
        checkoutSessionId = existing.payment.checkoutSessionId || null;
      }
      if (!checkoutSessionId) throw new Error('Incomplete return');
      const completeDetails = { orderId: details.orderId, checkoutSessionId };
      setAmazonReturn(completeDetails); rememberPaymentReturn(completeDetails);
      const order = await api<Order>('/payments/amazon-pay/complete', { ...post(completeDetails), signal: AbortSignal.timeout(50000) });
      setReceipt(order); setModal('receipt');
      if (order.status !== 'sandbox_pending') rememberPaymentReturn(null);
      void refreshSaved();
    } catch {
      setActionError(text('We could not verify this sandbox payment yet. Try checking again, or continue with your saved draft.', '暂时无法核验这笔沙盒支付。可以重新核验，或继续已保留的草稿。'));
    } finally { mutating.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!amazonReturn || returnStarted.current) return;
    returnStarted.current = true; rememberPaymentReturn(amazonReturn);
    const cleaned = clearAmazonPayReturnQuery(new URL(location.href));
    window.history.replaceState(window.history.state, '', `${cleaned.pathname}${cleaned.search}${cleaned.hash}`);
    void verifyAmazonPayment(amazonReturn);
  }, [amazonReturn]);
  const orderStatusText = (order: Order) => {
    switch (order.status) {
      case 'sandbox_paid': return text('Sandbox payment verified', '沙盒支付已核验成功');
      case 'sandbox_pending': return text('Sandbox payment not yet confirmed', '沙盒支付尚未确认');
      case 'sandbox_failed': return text('Sandbox payment unsuccessful', '沙盒支付未成功');
      case 'sandbox_canceled': return text('Sandbox checkout canceled', '沙盒结账已取消');
      default: return text('Test order confirmed', '体验订单已确认');
    }
  };
  const receiptText = (order: Order) => {
    switch (order.status) {
      case 'sandbox_paid': return text('Amazon Pay verified this sandbox payment. No real charge or shipping.', 'Amazon Pay 已核验这笔沙盒付款，不会真实扣款或发货。');
      case 'sandbox_pending': return text('Amazon Pay has not confirmed a completed sandbox payment. You can check its status again.', 'Amazon Pay 尚未确认沙盒付款完成，可以再次核验状态。');
      case 'sandbox_failed': return text('This sandbox payment did not complete. Your design is kept; no real charge or shipping.', '这笔沙盒付款未完成。搭配已保留，不会真实扣款或发货。');
      case 'sandbox_canceled': return text('This sandbox checkout was canceled. Your design is kept; no real charge or shipping.', '这次沙盒结账已取消。搭配已保留，不会真实扣款或发货。');
      default: return text('No payment was taken. Your design is ready to revisit.', '没有产生任何扣款，这份搭配已为你记录。');
    }
  };
  const reopen = (design: SavedDesign) => {
    draftSavedVersions.current.set(design.id, { savedId: design.id, savedSignature: designSignature(design.config, design.name) });
    restore({ draftId: design.id, config: design.config, name: design.name, savedId: design.id, savedSignature: designSignature(design.config, design.name) });
    setHistory([]); setFuture([]); setPage('studio'); announce(text('Your design is ready to continue.', '已打开你的作品，可以接着搭配。'));
  };
  const remove = async () => {
    if (!deleteTarget || mutating.current) return;
    mutating.current = true; setBusy(true); setActionError('');
    try {
      await api(`/designs/${deleteTarget.id}`, { method: 'DELETE' });
      for (const [id, saved] of draftSavedVersions.current) if (saved.savedId === deleteTarget.id) draftSavedVersions.current.set(id, { savedId: undefined, savedSignature: undefined });
      setDesigns(items => items.filter(item => item.id !== deleteTarget.id));
      if (workspace.savedId === deleteTarget.id) setWorkspace(previous => ({ ...previous, savedId: undefined, savedSignature: undefined }));
      setModal(null); announce(text('Design removed from your collection.', '已从收藏中删除作品。'));
    } catch (error) { setActionError((error as Error).message); }
    finally { mutating.current = false; setBusy(false); }
  };
  const applyProposal = (proposal: StylistProposal) => { startDesign(proposal.config, proposal.name); announce(tr('已带入 AI 搭配，继续调整每一个细节')); };
  const saveProposal = (proposal: StylistProposal) => { startDesign(proposal.config, proposal.name); openModal('save'); };

  if (page === 'home') return <LandingPage logo={<Logo />} onStart={() => setPage('search')} onStudio={() => setPage('studio')} onSaved={() => setPage('saved')} onSelectDesign={startDesign} />;
  if (!catalog) return <div className="initial-loading"><Logo />{loadError ? <><p role="alert">{tr(loadError)}</p><button className="primary" onClick={() => location.reload()}>{tr('重新加载')}</button></> : <><span className="spinner" /><p>{tr('正在打开你的小小创作室…')}</p></>}</div>;
  const template = catalog.templates.find(item => item.id === config.templateId)!;
  const slot = template.slots.find(item => item.id === selectedSlot) || template.slots[0];
  const locked = config.lockedSlots.includes(slot.id), selectedPart = catalog.parts.find(item => item.id === config.slots[slot.id]);
  const available = catalog.parts.filter(part => slot.categories.includes(part.category) && (category === 'all' || category === part.category) &&
    (!search.trim() || `${part.name} ${part.material} ${part.tags.join(' ')} ${part.id} ${rawCatalog?.parts.find(item => item.id === part.id)?.name || ''}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale))));
  const lastCharm = selectedPart?.category === 'charm' && Object.values(config.slots).filter(id => catalog.parts.find(part => part.id === id)?.category === 'charm').length === 1;
  const selectSlot = (id: string) => { setSelectedSlot(id); setEditorStep('details'); setSearch(''); setCategory('all'); };
  const selectPart = (id: string | null) => { if (!locked) change({ ...config, slots: { ...config.slots, [slot.id]: id } }); };
  const toggleLock = () => change({ ...config, lockedSlots: locked ? config.lockedSlots.filter(id => id !== slot.id) : [...config.lockedSlots, slot.id] });
  const renderStill = (stillConfig: DesignConfig, stillName?: string) => <ProductPreview config={stillConfig} catalog={catalog} snapshot={snapshots[visualKey(stillConfig)]} alt={stillName} onCapture={url => capture(stillConfig, url)} />;

  return <div className="atelier-app">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>{text('Skip to content', '跳到主要内容')}</a>
    <header className="site-header atelier-header"><div className="header-inner">
      <button className="brand-button" onClick={() => setPage('home')} aria-label={tr('返回 LOOP 首页')}><Logo /></button>
      <nav aria-label={tr('主导航')}>
        <button className={page === 'search' ? 'active' : ''} aria-current={page === 'search' ? 'page' : undefined} onClick={() => setPage('search')}>{text('Find your inspiration', '寻找灵感')}</button>
        <button className={page === 'studio' ? 'active' : ''} aria-current={page === 'studio' ? 'page' : undefined} onClick={() => setPage('studio')}>{text('The studio', '创作工作室')}</button>
        <button className={page === 'saved' ? 'active' : ''} aria-current={page === 'saved' ? 'page' : undefined} onClick={() => setPage('saved')}>{text('Your collection', '我的收藏')}</button>
      </nav>
      <div className="header-end"><LanguageSwitcher /><button className="circle-button help-button" aria-label={text('Studio guide', '工作室指南')} onClick={() => openModal('help')}><CircleHelp size={18} /></button></div>
    </div></header>
    <main id="main-content" tabIndex={-1} className={`main-container atelier-main ${page === 'search' ? 'discovery-main' : ''}`}>
      <div hidden={page !== 'search'}><AIStylist catalog={catalog} currentConfig={config} active={page === 'search'} onEdit={applyProposal} onCheckout={proposal => void review(proposal.config, proposal.name)} onSave={saveProposal} onCapture={capture} snapshot={item => snapshots[visualKey(item)]} /></div>
      {page === 'studio' && <>
        <div className="studio-heading"><div><span className="eyebrow">THE LOOP ATELIER</span><h1>{name}</h1><p>{text('A few thoughtful details. Something entirely yours.', '认真挑选每一个细节，搭出属于你的那一件。')}</p></div>
          <div className="workspace-actions"><span className="draft-status"><span />{isSaved ? text('Saved to your collection', '已保存到收藏') : draftStored ? text('Draft kept on this browser', '草稿已在本浏览器保留') : text('Save to keep this design', '保存后即可保留这件作品')}</span><button className="secondary" onClick={() => openModal('save')}><Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />{isSaved ? text('Edit name', '修改名称') : tr('保存设计')}</button></div>
        </div>
        <div className="studio-grid atelier-workspace">
          <section className="preview-column" aria-label={tr('设计实时预览')}>
            <InteractivePreview config={config} catalog={catalog} bag={bag} setBag={setBag} zoom={zoom} setZoom={setZoom} selectedSlot={slot.id} onSelectSlot={selectSlot} onCapture={capture} />
            <div className="preview-caption"><div><strong>{template.name}</strong><span>{template.description}</span></div><div className="edit-actions"><button onClick={undo} disabled={!history.length}><RotateCcw size={15} />{tr('撤销')}</button><button onClick={redo} disabled={!future.length}><RotateCw size={15} />{text('Redo', '重做')}</button><button onClick={() => { change(createDefaultConfig(config.templateId)); setZoom(1); announce(text('Original arrangement restored. You can undo this.', '已恢复初始搭配，可以撤销。')); }}>{tr('重置')}</button></div></div>
            <div className="preview-footnote"><span>01 / THE OBJECT</span><p>{text('Explore the finish, the shape, and how it sits on a bag. Models are design previews.', '看看材质、轮廓和挂包比例。模型为设计预览。')}</p></div>
          </section>
          <aside className="editor-panel atelier-editor" aria-label={tr('定制配置')}>
            <div className="panel-title"><h2>{text('Make it yours', '搭成你的样子')}</h2><span>{Object.values(config.slots).filter(Boolean).length} {text('pieces', '件配件')}</span></div>
            <div className="editor-step-nav" role="tablist" aria-label={text('Design steps', '搭配步骤')}>{(['style', 'finish', 'details'] as const).map((step, index) => <button key={step} id={`step-${step}`} role="tab" aria-selected={editorStep === step} aria-controls={`panel-${step}`} onClick={() => setEditorStep(step)}><span>0{index + 1}</span>{step === 'style' ? text('Silhouette', '基础样式') : step === 'finish' ? text('Finish', '挂扣配色') : text('Details', '配件细节')}</button>)}</div>
            <div className="editor-options">
            <section id="panel-style" role="tabpanel" aria-labelledby="step-style" hidden={editorStep !== 'style'} className="options-section"><div className="section-label"><h3>{text('Choose a silhouette', '选择基础样式')}</h3></div>
              <div className="template-row studio-template-row" aria-label={tr('选择基础样式')}>{catalog.templates.map(item => <button key={item.id} className={`template-choice ${config.templateId === item.id ? 'selected' : ''}`} aria-pressed={config.templateId === item.id} onClick={() => chooseTemplate(item.id)}><div className="template-art"><img src={`/assets/thumbnails/template-${item.id}.png`} alt="" /></div><strong>{item.name}</strong></button>)}</div>
              <p className="option-description">{template.subtitle}</p>
              <p className="step-description">{text('Each style keeps its own arrangement while you explore.', '切换基础样式时，刚才的搭配也会保留。')}</p><button className="text-action step-next" onClick={() => setEditorStep('finish')}>{text('Choose the finish', '选择挂扣与配色')}<ArrowRight size={14}/></button>
            </section>
            <section id="panel-finish" role="tabpanel" aria-labelledby="step-finish" hidden={editorStep !== 'finish'} className="options-section"><div className="section-label"><h3>{text('Set the finish', '选择挂扣与配色')}</h3></div>
              <div className="base-options">{catalog.connectors.filter(item => template.connectorIds.includes(item.id)).map(item => <button key={item.id} className={`connector-choice ${config.connectorId === item.id ? 'selected' : ''}`} aria-pressed={config.connectorId === item.id} onClick={() => change({ ...config, connectorId: item.id })}><span className={`connector-icon ${item.id}`} /><span>{item.name}</span>{config.connectorId === item.id && <Check size={13} />}</button>)}</div>
              <div className="finish-row"><span>{tr('金属色')}</span><div className="metal-options">{(['gold', 'silver'] as const).map(tone => <button key={tone} className={config.metalTone === tone ? 'selected' : ''} aria-pressed={config.metalTone === tone} onClick={() => change({ ...config, metalTone: tone })}><i className={`metal-dot ${tone}`} />{tone === 'gold' ? tr('香槟金') : tr('月光银')}</button>)}</div></div>
              {config.templateId === 'cord' && <div className="cord-row"><div><span>{tr('编绳颜色')}</span><small>{catalog.cordColors.find(item => item.id === config.cordColor)?.name}</small></div><div className="swatches">{catalog.cordColors.map(item => <button key={item.id} className={config.cordColor === item.id ? 'selected' : ''} style={{ '--swatch': item.hex } as React.CSSProperties} aria-label={tr('编绳颜色：{0}', item.name)} aria-pressed={config.cordColor === item.id} onClick={() => change({ ...config, cordColor: item.id })}>{config.cordColor === item.id && <Check size={13} />}</button>)}</div></div>}
            </section>
            <section id="panel-details" role="tabpanel" aria-labelledby="step-details" hidden={editorStep !== 'details'} className="options-section parts-section"><div className="section-label"><h3>{text('Pick your little details', '搭配喜欢的小物')}</h3><small>{text('Choose a position', '先选择一个位置')}</small></div>
              <div className="slots-list" aria-label={tr('选择配件位置')}>{template.slots.map((item, index) => <button key={item.id} className={slot.id === item.id ? 'selected' : ''} aria-pressed={slot.id === item.id} onClick={() => selectSlot(item.id)}><span>{index + 1}</span>{item.name}{config.lockedSlots.includes(item.id) && <LockKeyhole size={11} />}</button>)}</div>
              <div className="current-part"><div><small>{slot.name}</small><strong>{selectedPart?.name || text('A little breathing room', '留一点空白')}</strong>{selectedPart && <span className="part-material">{selectedPart.material}</span>}</div><button className={`lock-button ${locked ? 'locked' : ''}`} aria-label={locked ? tr('解锁{0}', slot.name) : tr('锁定{0}', slot.name)} aria-pressed={locked} onClick={toggleLock}>{locked ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}<span>{locked ? tr('已锁定') : tr('锁定')}</span></button></div>
              {locked && <p className="locked-note">{tr('这件配件已被锁定。解锁后可以更换或移除。')}</p>}
              <div className="search-field"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Find a color, material, or little object', '寻找颜色、材质或小物')} aria-label={tr('搜索配件')} />{search && <button aria-label={tr('清空搜索')} onClick={() => setSearch('')}><X size={14} /></button>}</div>
              {slot.categories.length > 1 && <div className="category-filter">{(['all', ...slot.categories] as const).map(item => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'all' ? tr('全部') : item === 'bead' ? tr('珠子') : tr('挂饰')}</button>)}</div>}
              <div className={`parts-grid ${locked ? 'is-locked' : ''}`}>{available.map(part => <button key={part.id} className={`part-card ${config.slots[slot.id] === part.id ? 'selected' : ''}`} disabled={locked} aria-pressed={config.slots[slot.id] === part.id} aria-label={`${part.name}，${part.material}，${money(part.price)}`} onClick={() => selectPart(part.id)}><div className="part-image"><PartThumbnail part={part} metalTone={config.metalTone} />{config.slots[slot.id] === part.id && <span className="part-check"><Check size={10} /></span>}</div><strong>{part.name}</strong><span>{money(part.price)}</span></button>)}</div>
              {!available.length && <div className="empty-search"><Search size={20} /><p>{tr('还没有找到这个小物')}</p><button className="text-action" onClick={() => { setSearch(''); setCategory('all'); }}>{tr('看看全部配件')}</button></div>}
              {!(config.templateId === 'hero' && slot.id === 'main') && <button className="remove-part" disabled={locked || !config.slots[slot.id] || lastCharm} title={lastCharm ? text('Keep at least one charm in your design.', '搭配中需要至少保留一个挂饰。') : undefined} onClick={() => selectPart(null)}><Minus size={13} />{lastCharm ? text('Keep one charm in your design', '搭配中至少保留一个挂饰') : tr('这个位置先留空')}</button>}
            </section>
            </div>
            <div className="checkout-panel"><div className="price-line"><div><span>{text('Your one-of-a-kind', '这份专属搭配')}</span><strong aria-live="polite">{validQuote && quote ? money(quote.total) : quoting ? '…' : '—'}<small>{text('USD', '美元')}</small></strong></div><button className="text-action" disabled={!validQuote || busy} onClick={() => void review()}>{text('Price details', '价格明细')}<ChevronDown size={14} /></button></div>
              {quoteError && <p className="error-message" role="alert">{tr(quoteError)}</p>}
              <div className="studio-checkout-actions"><button className="secondary" onClick={() => openModal('save')}><Heart size={16} />{tr('保存设计')}</button><button className="primary" disabled={!validQuote || busy} onClick={() => void review()}>{text('Review design', '确认搭配')}<ArrowRight size={16} /></button></div><p className="checkout-note">{text('Test orders & sandbox checkout · No real charge or shipping', '体验订单与沙盒结账 · 不会真实扣款或发货')}</p>
            </div>
          </aside>
        </div>
      </>}
      {page === 'saved' && <section className="saved-page atelier-collection">
        <div className="studio-heading"><div><span className="eyebrow">YOUR LITTLE COLLECTION</span><h1>{text('A place for your favorites.', '把每一份喜欢，好好收藏。')}</h1><p>{text('Your designs, ready whenever inspiration returns.', '每一件作品，都可以继续成为新的灵感。')}</p></div><button className="secondary" onClick={() => setPage('studio')}><Plus size={16} />{text('Continue your draft', '继续当前草稿')}</button></div>
        <div className="saved-tabs" role="tablist" aria-label={text('Collection type', '收藏类别')}><button role="tab" aria-selected={savedTab === 'designs'} className={savedTab === 'designs' ? 'active' : ''} onClick={() => setSavedTab('designs')}>{text('Designs', '作品')}<span>{designs.length}</span></button><button role="tab" aria-selected={savedTab === 'orders'} className={savedTab === 'orders' ? 'active' : ''} onClick={() => setSavedTab('orders')}>{text('Test orders', '测试订单')}<span>{orders.length}</span></button></div>
        {listLoading ? <div className="empty-state"><span className="spinner" /><p>{tr('正在整理你的作品…')}</p></div> : listError ? <div className="empty-state"><p role="alert">{tr(listError)}</p><button className="secondary" onClick={refreshSaved}>{tr('重试')}</button></div> : savedTab === 'designs' ? designs.length ? <div className="saved-grid">{designs.map(design => <article className="saved-card" key={design.id}><button className="saved-art" aria-label={tr('继续编辑{0}', design.name)} onClick={() => reopen(design)}>{renderStill(design.config, design.name)}<span>{text('Make another little change', '接着搭配')}<ArrowRight size={15} /></span></button><div className="saved-card-info"><div><h3>{design.name}</h3><p>{catalog.templates.find(item => item.id === design.config.templateId)?.name} · {new Date(design.updatedAt).toLocaleDateString(locale)}</p></div><button className="circle-button" disabled={busy} aria-label={tr('删除{0}', design.name)} onClick={() => { setDeleteTarget(design); openModal('delete'); }}><Trash2 size={15} /></button></div></article>)}</div> : <div className="collection-empty"><div><span className="eyebrow">A COLLECTION STARTS WITH ONE</span><h2>{text('Your first favorite is waiting.', '第一件喜欢，等你来搭配。')}</h2><p>{text('Start with a considered pairing, change a detail, and save something that feels like you.', '从一组精选搭配开始，换一点细节，收藏一件属于你的作品。')}</p></div><div className="collection-starters">{featuredDesigns.map(item => <button key={item.id} onClick={() => startDesign(item.config, item.name[language === 'en' ? 'en' : 'zh'])}><img src={item.image} alt="" /><span>{item.name[language === 'en' ? 'en' : 'zh']}<ArrowRight size={16} /></span></button>)}</div></div> : orders.length ? <div className="order-list">{orders.map(order => <article className="order-card" key={order.id}><div className="order-art">{renderStill(order.config, order.designName)}</div><div><span className={`status-tag status-${order.status}`}><OrderStatusIcon order={order} />{orderStatusText(order)}</span><h3>{order.designName}</h3><p>{new Date(order.createdAt).toLocaleString(locale)}</p><small>{text('Reference', '编号')} {order.id.slice(0, 8).toUpperCase()}</small></div><div className="order-price"><strong>{money(order.quote.total, order.quote.currency)}</strong><button className="text-action" onClick={() => { setReceipt(order); openModal('receipt'); }}>{tr('查看订单')}<ArrowRight size={14} /></button></div></article>)}</div> : <EmptyState title={tr('还没有测试订单')} text={text('Review a finished design to experience the order confirmation.', '完成搭配后，可以体验订单确认流程。')} onAction={() => setPage('studio')} />}
        <p className="saved-footnote">{text('Saved designs belong to this browser. Keep its cookies to return to your collection.', '作品保存在当前浏览器的访客账户下，请保留 Cookie 以便再次访问。')}</p>
      </section>}
    </main>
    <footer className="atelier-footer"><div><Logo small /><p>{text('Small objects. Personal stories.', '小小物件，自己的故事。')}</p></div><nav aria-label={text('Footer navigation', '页脚导航')}><button onClick={() => setPage('home')}>{text('The collection', '精选搭配')}</button><button onClick={() => setPage('search')}>{text('Find inspiration', '寻找灵感')}</button><button onClick={() => openModal('help')}>{text('Studio guide', '工作室指南')}</button></nav><div><span>© {new Date().getFullYear()} LOOP Studio</span><small>{text('An interactive design preview.', '互动搭配创作体验。')}</small></div></footer>
    {toast && <div className="toast" role="status"><CheckCheck size={17} />{toast}<button aria-label={tr('关闭提示')} onClick={() => setToast('')}><X size={15} /></button></div>}
    {modal && <Modal key={modal} title={modal === 'save' ? text('Give it a little name.', '为它取一个名字。') : modal === 'saved' ? text('A new favorite, kept.', '这份喜欢，已经收藏。') : modal === 'checkout' ? text('The details of your design.', '确认你的专属搭配。') : modal === 'receipt' ? text('Your design, recorded.', '你的搭配，已被记录。') : modal === 'payment' ? text('Your Amazon Pay checkout.', '你的 Amazon Pay 结账。') : modal === 'delete' ? text('Remove this design?', '删除这件作品？') : text('Welcome to the atelier.', '欢迎来到 LOOP 工作室。')} onClose={closeModal} busy={busy}>
      {modal === 'save' && <><p className="modal-subtitle">{text('A name to find it by when you come back.', '起个名字，下次回来就能找到它。')}</p><div className="save-preview">{renderStill(config, name)}</div><label className="field-label" htmlFor="design-name">{tr('设计名称')}</label><input id="design-name" className="text-input" disabled={busy} value={name} maxLength={50} onChange={event => setWorkspace(previous => ({ ...previous, name: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void save(); }} /><p className="field-hint">{workspace.savedId ? text('Save changes to this design, or keep a separate copy.', '可以更新这件作品，也可以另存一份。') : text('Kept in your collection on this browser.', '保存到本浏览器的个人收藏中。')}</p><ActionError message={tr(actionError)} /><button className="primary full-width" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? tr('正在保存…') : workspace.savedId ? text('Save changes', '保存修改') : tr('保存这份设计')}<Heart size={16} /></button>{workspace.savedId && <button className="text-action modal-bottom-link" disabled={busy || !name.trim()} onClick={() => void save(true)}><Copy size={14} />{text('Save as a new design', '另存为新作品')}</button>}</>}
      {modal === 'saved' && savedResult && <><div className="save-preview">{renderStill(savedResult.config, savedResult.name)}</div><div className="saved-celebration"><span className="status-tag"><Check size={13} />{text('Saved to your collection', '已保存到我的收藏')}</span><h3>{savedResult.name}</h3><p>{text('Come back, change a detail, fall in love all over again.', '随时回来，换一点细节，收获新的喜欢。')}</p></div><button className="primary full-width" onClick={() => { setModal(null); setSavedTab('designs'); setPage('saved'); }}>{text('See your collection', '查看我的收藏')}<ArrowRight size={16} /></button><button className="secondary full-width" onClick={closeModal}>{text('Keep creating', '继续创作')}</button></>}
      {modal === 'checkout' && <>{!checkoutSnapshot ? <div className="review-loading">{busy && <span className="spinner" />}<p>{busy ? text('Checking the pieces and price…', '正在核对配件与明细…') : text('We could not load the details.', '暂时无法读取搭配明细。')}</p><ActionError message={tr(actionError)} />{!busy && <button className="secondary" onClick={() => void review(reviewTarget.current?.config, reviewTarget.current?.name)}>{tr('重试')}</button>}</div> : <>
        <p className="modal-subtitle">{text('Every piece, accounted for. Take a moment to review.', '每一件小物都列在这里，确认后再记录你的搭配。')}</p><div className="checkout-summary"><div className="mini-preview">{renderStill(checkoutSnapshot.config, checkoutSnapshot.name)}</div><div><span className="eyebrow">YOUR LITTLE ONE</span><h3>{checkoutSnapshot.name}</h3><p>{catalog.templates.find(item => item.id === checkoutSnapshot.config.templateId)?.subtitle}</p></div></div><div className="bill-lines">{checkoutSnapshot.quote.lines.map((line, index) => <div key={`${line.id}-${index}`}><span>{tr(line.name)}{line.quantity > 1 ? ` × ${line.quantity}` : ''}</span><span>{money(line.subtotal)}</span></div>)}</div><div className="bill-total"><strong>{tr('合计')}</strong><strong>{money(checkoutSnapshot.quote.total, checkoutSnapshot.quote.currency)}</strong></div>
        {amazonPayStatus?.configured ? <AmazonPayButton key={checkoutSnapshot.key} request={{ designName: checkoutSnapshot.name, config: checkoutSnapshot.config, idempotencyKey: `amazon-pay-${checkoutSnapshot.key}` }} disabled={busy} language={language} onStart={keepCheckoutDraft} onPrepared={order => { setCheckoutSnapshot(previous => previous ? { ...previous, quote: order.quote } : previous); setOrders(items => [order, ...items.filter(item => item.id !== order.id)]); }} onBusy={value => { mutating.current = value; setBusy(value); }} /> : <div className="amazon-pay-option amazon-pay-unavailable"><div className="payment-option-heading"><strong>Amazon Pay</strong><span>{text('SANDBOX', '沙盒测试')}</span></div><p role="status">{amazonPayStatus ? text('Amazon Pay sandbox is being set up.', 'Amazon Pay 沙盒正在配置中。') : text('Checking Amazon Pay availability…', '正在检查 Amazon Pay 是否可用…')}</p></div>}
        <div className="test-notice"><ShoppingBag size={18} /><p><strong>{text('Or record a studio test order', '也可以记录一笔体验订单')}</strong><span>{text('Save this design and price without opening a payment service. No payment or shipping.', '直接记录设计与价格，不会扣款或发货。')}</span></p></div><ActionError message={tr(actionError)} /><button className="primary full-width" disabled={busy} onClick={placeOrder}>{busy ? tr('正在提交…') : tr('确认测试下单')}<ArrowRight size={17} /></button>
      </>}</>}
      {modal === 'payment' && <><div className="review-loading" role={busy ? 'status' : undefined}>{busy && <span className="spinner" />}<p>{busy ? text('Verifying your sandbox payment with Amazon Pay…', '正在向 Amazon Pay 核验沙盒付款…') : text('No completed sandbox payment has been confirmed.', '尚未确认沙盒付款完成。')}</p></div><ActionError message={actionError} />{!busy && <>{amazonReturn?.orderId && <button className="primary full-width" onClick={() => void verifyAmazonPayment()}>{text('Check payment again', '重新核验支付')}<RotateCcw size={16} /></button>}<button className="secondary full-width" onClick={() => { rememberPaymentReturn(null); setAmazonReturn(null); closeModal(); }}>{text('Continue my draft', '继续当前草稿')}</button></>}<p className="payment-return-note">{text('Sandbox only · No real charge or shipping. Your design is kept on this browser.', '仅沙盒测试 · 不会真实扣款或发货。搭配已在本浏览器保留。')}</p></>}
      {modal === 'receipt' && receipt && <><div className="receipt-preview">{renderStill(receipt.config, receipt.designName)}</div><div className="saved-celebration"><span className={`status-tag status-${receipt.status}`}><OrderStatusIcon order={receipt} />{orderStatusText(receipt)}</span><h3>{receipt.designName}</h3><p>{receiptText(receipt)}</p></div><div className="receipt-details"><div><span>{text('Reference', '订单编号')}</span><code>{receipt.id}</code></div>{receipt.payment && <div><span>{text('Checkout', '结账方式')}</span><span>Amazon Pay · {text('Sandbox', '沙盒')}</span></div>}<div><span>{tr('搭配总价')}</span><strong>{money(receipt.quote.total, receipt.quote.currency)}</strong></div><div><span>{tr('创建时间')}</span><span>{new Date(receipt.createdAt).toLocaleString(locale)}</span></div></div>{receipt.status === 'sandbox_pending' && receipt.payment?.checkoutSessionId && <button className="secondary full-width" disabled={busy} onClick={() => void verifyAmazonPayment({ orderId: receipt.id, checkoutSessionId: receipt.payment!.checkoutSessionId! })}>{text('Check payment status', '核验支付状态')}<RotateCcw size={16} /></button>}<button className="primary full-width" onClick={() => { setModal(null); setSavedTab('orders'); setPage('saved'); }}>{text('View your test orders', '查看我的体验订单')}<ArrowRight size={16} /></button><button className="secondary full-width" onClick={() => { setModal(null); startDesign(receipt.config, receipt.designName); }}>{text('Keep working on this design', '继续编辑这份搭配')}</button></>}
      {modal === 'delete' && deleteTarget && <><p className="modal-subtitle">{text('This removes the saved design from your collection. An open draft and existing test orders are kept.', '这会从收藏中删除保存的作品。当前草稿和已有体验订单仍会保留。')}</p><div className="checkout-summary"><div className="mini-preview">{renderStill(deleteTarget.config, deleteTarget.name)}</div><h3>{deleteTarget.name}</h3></div><ActionError message={tr(actionError)} /><button className="danger-button full-width" disabled={busy} onClick={remove}>{busy ? text('Removing…', '正在删除…') : text('Remove saved design', '删除保存的作品')}</button><button className="secondary full-width" disabled={busy} onClick={closeModal}>{text('Keep this favorite', '保留这件喜欢')}</button></>}
      {modal === 'help' && <><p className="modal-subtitle">{text('A thoughtful little object, made your way.', '用喜欢的小物，组成一件属于自己的包挂。')}</p><div className="help-steps">{[[text('Start with a pairing', '从一组搭配开始'), text('Choose a curated design, describe an idea to your stylist, or explore a base in the studio.', '选择精选搭配、告诉灵感搭档你的想法，或在工作室挑选基础样式。')], [text('Follow the little details', '认真挑选每个细节'), text('Choose a position to replace a piece. Lock favorites, explore finishes, and rotate or try your design on a bag.', '选择位置替换配件，锁定喜欢的部分，调整配色，再旋转或试挂包型。')], [text('Keep what you love', '收藏这份喜欢'), text('Your working draft stays on this browser. Save a named design, record a test order, or try Amazon Pay sandbox when available.', '当前草稿会在本浏览器保留。命名后保存到收藏、记录体验订单，或体验可用的 Amazon Pay 沙盒结账。')]].map(([title, description], index) => <div key={title}><span>0{index + 1}</span><p><strong>{title}</strong><small>{description}</small></p></div>)}</div><div className="test-notice"><ShoppingBag size={18} /><p><strong>{text('An interactive studio preview', '互动创作体验版')}</strong><span>{text('Models, materials, dimensions and prices are illustrative. Test orders and sandbox checkout involve no real charge or shipping.', '模型、材质、尺寸与价格为设计示意。体验订单和沙盒结账不会真实扣款或发货。')}</span></p></div><button className="primary full-width" onClick={closeModal}>{text('Back to creating', '继续我的创作')}<ArrowRight size={16} /></button></>}
    </Modal>}
  </div>;
}

const bagStyles: { id: BagStyle; name: string; color: string }[] = [{ id: 'tote', name: '皮革托特', color: '#896247' }, { id: 'shoulder', name: '腋下肩包', color: '#e5ded0' }, { id: 'mini', name: '迷你包', color: '#d7c7b1' }];
function InteractivePreview({ config, catalog, bag, setBag, zoom, setZoom, selectedSlot, onSelectSlot, onCapture }: { config: DesignConfig; catalog: Catalog; bag: boolean; setBag: (value: boolean) => void; zoom: number; setZoom: React.Dispatch<React.SetStateAction<number>>; selectedSlot: string; onSelectSlot: (id: string) => void; onCapture: (config: DesignConfig, url: string) => void }) {
  const { tr, language } = useLanguage();
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  const [bagStyle, setBagStyle] = useState<BagStyle>('tote'), [autoRotate, setAutoRotate] = useState(false), [panMode, setPanMode] = useState(false);
  const [motion, setMotion] = useState(false), [guides, setGuides] = useState(false);
  const [bagColors, setBagColors] = useState<Partial<Record<BagStyle, string>>>({});
  const [resetKey, setResetKey] = useState(0), [attempt, setAttempt] = useState(0), [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const view = useRef({ key: visualKey(config), bag }); view.current = { key: visualKey(config), bag };
  const Scene = useMemo(() => lazy(() => import('./CharmScene')), [attempt]);
  useEffect(() => { setReady(false); }, [bag, bagStyle]);
  useEffect(() => { const preference = window.matchMedia('(prefers-reduced-motion: reduce)'); const reduce = () => { if (preference.matches) { setMotion(false); setAutoRotate(false); } }; preference.addEventListener('change', reduce); return () => preference.removeEventListener('change', reduce); }, []);
  const sceneReady = useCallback(() => setReady(true), []), sceneError = useCallback(() => { setFailed(true); setReady(false); }, []);
  const captureScene = useCallback((url: string) => { if (!view.current.bag && view.current.key === visualKey(config)) onCapture(config, url); }, [config, onCapture]);
  const resetView = () => { setZoom(1); setAutoRotate(false); setPanMode(false); setResetKey(key => key + 1); };
  const retry = () => { setFailed(false); setReady(false); setAttempt(value => value + 1); };
  const fallback = <div className="scene-fallback"><div className="fallback-art"><CharmPreview config={config} catalog={catalog} bag={bag} /></div><div className="fallback-message" role="alert"><strong>{tr('3D 预览暂时无法打开')}</strong><p>{text('You can continue editing with this arrangement illustration.', '可以通过当前搭配示意继续编辑。')}</p><button className="secondary" onClick={retry}><RotateCcw size={15} />{tr('重新加载 3D')}</button></div></div>;
  return <>
    <div className={`preview-stage preview-stage-3d ${bag ? 'on-bag' : ''}`}>
      <div className="preview-top"><span className="live-pill"><span />{failed ? text('Design illustration', '搭配示意') : text('The product view', '成品预览')}</span><div className="view-switch"><button className={!bag ? 'active' : ''} aria-pressed={!bag} onClick={() => { setBag(false); setZoom(1); }}>{text('The charm', '看挂饰')}</button><button className={bag ? 'active' : ''} aria-pressed={bag} onClick={() => { setBag(true); setZoom(1); }}>{text('On a bag', '挂包效果')}</button></div></div>
      <div className="scene-viewer" aria-label={bag ? tr('可旋转的挂包搭配预览') : tr('可旋转的挂饰预览')}>{failed ? fallback : <SceneBoundary key={attempt} fallback={fallback} onError={sceneError}><Suspense fallback={null}><Scene config={config} catalog={catalog} bag={bag} bagStyle={bagStyle} bagColor={bagColors[bagStyle]} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} showMarkers={guides} zoom={zoom} panMode={panMode} autoRotate={autoRotate} motion={motion} resetKey={resetKey} onReady={sceneReady} onError={sceneError} onCapture={bag ? undefined : captureScene} /></Suspense></SceneBoundary>}</div>
      {!ready && !failed && <div className="scene-ready-overlay scene-loading" role="status"><span className="spinner" /><strong>{tr('正在准备 3D 预览')}</strong></div>}
      <div className="preview-bottom scene-bottom"><span className="preview-hint">{ready && <Move size={13} />}{ready ? text('Drag to explore · Scroll to zoom', '拖动旋转 · 滚轮缩放') : text('Your object is coming into view', '正在准备成品预览')}</span><div className="zoom-controls"><button aria-label={tr('缩小预览')} disabled={!ready || zoom <= .7} onClick={() => setZoom(value => Math.max(.7, value - .15))}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label={tr('放大预览')} disabled={!ready || zoom >= 1.6} onClick={() => setZoom(value => Math.min(1.6, value + .15))}><Plus size={15} /></button></div></div>
    </div>
    <div className="scene-toolbar" aria-label={tr('3D 预览操作')}><button disabled={!ready} onClick={resetView}><RotateCcw size={14} />{tr('复位视角')}</button><button aria-pressed={autoRotate} disabled={!ready} onClick={() => setAutoRotate(value => !value)}>{autoRotate ? <Pause size={14} /> : <Play size={14} />}{text('Turntable', '自动旋转')}</button><button aria-pressed={guides} disabled={!ready} onClick={() => setGuides(value => !value)}><SlidersHorizontal size={14} />{text('Edit guides', '编辑标记')}</button><details className="scene-more"><summary aria-label={text('More preview controls', '更多预览控制')}><ChevronDown size={15} /></summary><div><button aria-pressed={panMode} onClick={() => { setPanMode(value => !value); setAutoRotate(false); }} disabled={!ready}><Move size={14} />{tr('平移')}</button><button aria-pressed={motion} onClick={() => setMotion(value => !value)} disabled={!ready}><span className={`motion-switch ${motion ? 'enabled' : ''}`} />{tr('动态效果')}</button></div></details></div>
    {bag && <div className="bag-styling"><div className="bag-selector"><span>{text('Try it with', '试挂包型')}</span><div role="group" aria-label={tr('选择试挂包型')}>{bagStyles.map(style => <button key={style.id} className={bagStyle === style.id ? 'selected' : ''} aria-pressed={bagStyle === style.id} onClick={() => setBagStyle(style.id)}><i style={{ backgroundColor: style.color }} />{tr(style.name)}</button>)}</div></div><BagColorPicker key={bagStyle} style={bagStyle} color={bagColors[bagStyle]} onChange={color => setBagColors(previous => ({ ...previous, [bagStyle]: color }))} /></div>}
  </>;
}
function BagColorPicker({ style, color, onChange }: { style: BagStyle; color?: string; onChange: (color: string | undefined) => void }) {
  const { tr, language } = useLanguage();
  const current = color || BAG_DEFAULT_COLORS[style], [hex, setHex] = useState(current);
  useEffect(() => setHex(current), [current]);
  return <div className="bag-color-controls"><div className="bag-color-heading"><span>{tr('包包颜色')}</span></div><div className="bag-color-options" role="group" aria-label={tr('选择包包颜色')}><button className="bag-original-color" aria-pressed={!color} onClick={() => onChange(undefined)}>{tr('原色')}</button>{BAG_COLOR_PRESETS.map(preset => <button key={preset.color} className="bag-color-swatch" aria-label={tr('包包颜色：{0}', tr(preset.name))} title={tr(preset.name)} aria-pressed={color === preset.color} onClick={() => onChange(preset.color)}><i style={{ backgroundColor: preset.color }} /></button>)}<details className="custom-color-details"><summary>{language === 'en' ? 'Custom' : '自定义'}</summary><div><input type="color" aria-label={tr('自定义包包颜色')} value={current} onChange={event => onChange(event.target.value)} /><input className="bag-color-hex" aria-label={tr('包包颜色 HEX 色值')} value={hex} maxLength={7} spellCheck={false} onChange={event => { setHex(event.target.value); const value = normalizeBagColor(event.target.value); if (value) onChange(value); }} onBlur={() => setHex(current)} /></div></details></div></div>;
}
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function PartThumbnail({ part, metalTone }: { part: Part; metalTone: 'gold' | 'silver' }) {
  const [failed, setFailed] = useState(false);
  return failed ? <PartArt part={part} metalTone={metalTone} /> : <img className="catalog-render" src={`/assets/thumbnails/part-${part.id}.png`} alt={part.name} loading="lazy" onError={() => setFailed(true)} />;
}
function Logo({ small = false }: { small?: boolean }) {
  return <span className={`logo ${small ? 'small' : ''}`}><svg width="29" height="29" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 5C8-4-4 10 7 20L18 30 29 20C40 10 28-4 18 5Z" transform="translate(0 3)" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M18 9C11 12 10 19 18 24C26 19 25 12 18 9Z" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg><span>loop<span className="logo-dot">.</span></span></span>;
}
function OrderStatusIcon({ order }: { order: Order }) {
  if (order.status === 'sandbox_pending') return <Clock3 size={13} />;
  if (order.status === 'sandbox_failed') return <CircleAlert size={13} />;
  if (order.status === 'sandbox_canceled') return <Minus size={13} />;
  return <Check size={13} />;
}
function ActionError({ message }: { message: string }) { return message ? <p role="alert" className="error-message">{message}</p> : null; }
function EmptyState({ title, text, onAction }: { title: string; text: string; onAction: () => void }) {
  const { tr } = useLanguage();
  return <div className="empty-state"><span className="empty-icon"><Heart size={28} /></span><h2>{title}</h2><p>{text}</p><button className="primary" onClick={onAction}>{tr('去创作一件')}<ArrowRight size={16} /></button></div>;
}
function Modal({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy: boolean }) {
  const { tr } = useLanguage(); const ref = useRef<HTMLDivElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement, prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; const root = ref.current;
    const selector = 'button:not([disabled]),input:not([disabled]),summary,[tabindex="0"]';
    const frame = requestAnimationFrame(() => (root?.querySelector<HTMLInputElement>('input:not([disabled])') || root?.querySelector<HTMLElement>(selector) || root)?.focus());
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') { const elements = Array.from(root?.querySelectorAll<HTMLElement>(selector) || []); const first = elements[0], last = elements[elements.length - 1]; if (!root?.contains(document.activeElement) || document.activeElement === root || !elements.length) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    document.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = prior; document.removeEventListener('keydown', key); if (before?.isConnected) before.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal atelier-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="circle-button" disabled={busy} aria-label={tr('关闭弹窗')} onClick={onClose}><X size={19} /></button></div>{children}</div></div>;
}
