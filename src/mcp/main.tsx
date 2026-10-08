import { useLanguage, LanguageSwitcher, LanguageProvider } from '../Language';
import { Component, Suspense, lazy, useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { localizeCatalog } from '../../shared/localization';
import type { Catalog, DesignConfig, Order, Quote, SavedDesign } from '../../shared/types';
import type { StylistMessage, StylistProposal, StylistResponse } from '../../shared/stylist';
import { CharmPreview } from '../CharmArt';
import { LoopMcpClient, type McpTrace } from './client';
import './styles.css';

const Scene = lazy(() => import('../CharmScene'));
type Prepared = { designName: string; config: DesignConfig; quote: Quote; confirmationToken: string; expiresAt: string; notice: string };
type CatalogResult = { catalog: Catalog; examples: { name: string; config: DesignConfig }[] };
class PreviewBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Demo() {
 const { tr, language, locale, money } = useLanguage();
  const client = useRef<LoopMcpClient | undefined>(undefined);
  const [connected, setConnected] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [catalogData, setCatalogData] = useState<CatalogResult>(), [toolCount, setToolCount] = useState(0);
  const [traces, setTraces] = useState<McpTrace[]>([]), [messages, setMessages] = useState<StylistMessage[]>([]);
  const [draft, setDraft] = useState(''), [proposal, setProposal] = useState<StylistProposal>(), [suggestions, setSuggestions] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string>(), [notice, setNotice] = useState(''), [prepared, setPrepared] = useState<Prepared>();
  const [designs, setDesigns] = useState<SavedDesign[]>([]), [orders, setOrders] = useState<Order[]>([]), [historyLoaded, setHistoryLoaded] = useState(false);
  const [showConnection, setShowConnection] = useState(false), [sceneFailed, setSceneFailed] = useState(false), [now, setNow] = useState(Date.now());
  const active = useRef(false), chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => () => { void client.current?.close(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!prepared) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [prepared]);
  const trace = (entry: McpTrace) => setTraces(items => [...items.filter(item => item.id !== entry.id), entry].sort((a, b) => a.id - b.id).slice(-40));
  async function run(action: () => Promise<void>) {
    if (active.current) return;
    active.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : tr("操作失败，请重试。")); }
    finally { active.current = false; setBusy(false); }
  }
  const call = <T,>(name: string, args: Record<string, unknown> = {}) => {
    if (!client.current || !connected) throw new Error(tr("请先连接工作室。"));
    return client.current.call<T>(name, args);
  };
  const connect = () => run(async () => {
    setConnected(false); setShowConnection(false); setPrepared(undefined); setTraces([]);
    await client.current?.close();
    const next = new LoopMcpClient(trace); client.current = next;
    try {
      const tools = await next.connect();
      const data = await next.call<CatalogResult>('loop_get_catalog');
      setToolCount(tools.length); setCatalogData(data); setConnected(true);
      setNotice(tr("已连接。现在可以描述你的搭配想法，或载入一份目录示例。"));
    } catch (error) { await next.close(); throw error; }
  });
  const send = (idea = draft) => run(async () => {
    if (!idea.trim()) return;
    setPrepared(undefined);
    const next: StylistMessage[] = [...messages, { role: 'user' as const, content: idea.trim() }].slice(-19);
    const response = await call<StylistResponse>('loop_suggest_design', { language, messages: next, ...(proposal ? { currentConfig: proposal.config } : {}) });
    setMessages([...next, { role: 'assistant', content: response.message }]); setDraft(''); setSuggestions(response.suggestions);
    if (response.proposal) { setProposal(response.proposal); setPrepared(undefined); }
  });
  const example = () => run(async () => {
    const first = catalogData!.examples.find(item => item.config.templateId === 'hero')!;
    const priced = await call<{ config: DesignConfig; quote: Quote }>('loop_quote_design', { config: first.config });
    setProposal({ ...priced, name: tr("{0} · 目录示例", tr(first.name)), reasons: [tr("这是一份固定目录示例，可用来测试保存和下单，无需调用 AI。")] });
    setSavedId(undefined); setPrepared(undefined); setMessages([]); setSuggestions([]);
  });
  const lock = (slot: string) => run(async () => {
    const config = { ...proposal!.config, lockedSlots: proposal!.config.lockedSlots.includes(slot) ? proposal!.config.lockedSlots.filter(id => id !== slot) : [...proposal!.config.lockedSlots, slot] };
    const priced = await call<{ config: DesignConfig; quote: Quote }>('loop_quote_design', { config });
    setProposal({ ...proposal!, ...priced }); setPrepared(undefined);
  });
  const save = () => run(async () => {
    const result = await call<{ design: SavedDesign }>('loop_save_design', { name: proposal!.name, config: proposal!.config, ...(savedId ? { id: savedId } : {}) });
    setSavedId(result.design.id); setHistoryLoaded(false); setNotice(tr("设计已保存。打开「我的收藏」即可在原工作室继续调整。"));
  });
  const checkout = () => run(async () => {
    const result = await call<Prepared>('loop_prepare_test_order', { designName: proposal!.name, config: proposal!.config });
    setPrepared(result); setNow(Date.now());
  });
  const confirm = () => run(async () => {
    const result = await call<{ order: Order; notice: string }>('loop_confirm_test_order', { confirmationToken: prepared!.confirmationToken, confirmed: true });
    setPrepared(undefined); setHistoryLoaded(false); setNotice(tr("{0} 订单编号：{1}", result.notice, result.order.id));
  });
  const history = () => run(async () => {
    const drafts = await call<{ designs: SavedDesign[] }>('loop_list_designs', { limit: 50 });
    const purchases = await call<{ orders: Order[] }>('loop_list_orders', { limit: 50 });
    setDesigns(drafts.designs); setOrders(purchases.orders); setHistoryLoaded(true);
  });
  const load = (id: string) => run(async () => {
    const result = await call<{ design: SavedDesign; quote: Quote }>('loop_get_design', { id });
    setProposal({ name: result.design.name, config: result.design.config, quote: result.quote, reasons: [tr("已载入保存的设计，可以继续对话调整。")] });
    setSavedId(id); setPrepared(undefined); setMessages([]); setSuggestions([]);
  });
  const catalog = useMemo(() => catalogData ? localizeCatalog(catalogData.catalog, language) : undefined, [catalogData, language]);
  const expired = prepared && now >= Date.parse(prepared.expiresAt);
  const fallback = proposal && catalog ? <div className="fallback"><CharmPreview config={proposal.config} catalog={catalog}/><span>{tr("2D 结构示意 · 3D 预览不可用")}</span></div> : null;
  return <>
    <header><a className="logo" href="/">loop<span>.</span></a><LanguageSwitcher/><span className="badge">{tr("MCP 搭配演示")}</span><a className="back" href="/#/studio" target="_blank" rel="noreferrer">{tr("进入工作室 ↗")}</a></header>
    <main>
      <div className="intro"><div className="eyebrow">A LITTLE IDEA. A CHARM OF YOUR OWN.</div><h1>{tr("把一句灵感，变成随身的小欢喜。")}</h1><p>{tr("说说你的包、喜欢的风格和预算，一起搭配、调整，再留住喜欢的那一版。")}</p></div>
      <div className="connection"><span className={connected ? 'status connected' : 'status'}>{connected ? tr("已连接 · {0} 个工具", toolCount) : tr("尚未连接工作室")}</span><button onClick={connect} disabled={busy}>{connected ? tr("重新连接") : tr("连接工作室")}</button><small>{tr("Alexa+ 参赛模拟体验 · 不连接真实 Alexa+ 设备 · 所有订单均为测试")}</small></div>
      {error && <p className="error" role="alert">{tr(error)}</p>}{notice && <p className="notice" role="status">{tr(notice)}</p>}
      <div className="workspace">
        <section className="chat"><div className="section-heading"><h2>{tr("从你的想法开始")}</h2><span>LOOP STYLIST</span></div>
          <div className="messages" aria-live="polite">{!messages.length && <div className="welcome"><span className="spark">✳</span><h3>{tr("今天想带一点什么出门？")}</h3><p>{tr("告诉我包的颜色、搭配场景，或者一件想保留的小物。")}</p></div>}{messages.map((message, i) => <div key={i} className={`message ${message.role}`}><small>{message.role === 'user' ? tr("你") : 'LOOP'}</small><p>{message.content}</p></div>)}{busy && <p className="working" role="status">{tr("正在处理…")}</p>}<div ref={chatEnd}/></div>
          <div className="suggestions">{(suggestions.length ? suggestions : [tr("我想要复古风的包挂，搭配棕色包，预算 15 美元"), tr("奶白色包，想要珍珠和一点金色"), tr("选一个简约的水果挂饰")]).map(idea => <button key={idea} disabled={!connected || busy} onClick={() => { setDraft(idea); }}>{idea}</button>)}</div>
          <form onSubmit={event => { event.preventDefault(); void send(); }}><label htmlFor="idea">{tr("描述或调整你的搭配")}</label><textarea id="idea" maxLength={3000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={tr("比如：保留珍珠，其他部分换得简约一点…")} disabled={!connected || busy}/><div className="composer-actions"><button type="button" className="quiet" disabled={!connected || busy} onClick={example}>{tr("先试试目录示例")}</button><button className="primary" disabled={!connected || busy || !draft.trim()}>{tr("发送想法 ↗")}</button></div></form>
        </section>
        <section className="design"><div className="section-heading"><h2>{tr("你的搭配")}</h2><span>{proposal ? 'LIVE PREVIEW' : 'WAITING FOR AN IDEA'}</span></div>
          {proposal && catalog ? <>
            <div className="preview">{sceneFailed ? fallback : <PreviewBoundary fallback={fallback}><Suspense fallback={<p>{tr("正在准备 3D 预览…")}</p>}><Scene config={proposal.config} catalog={catalog} bag={false} bagStyle="tote" motion={false} onError={() => setSceneFailed(true)}/></Suspense></PreviewBoundary>}</div>
            <div className="design-info"><div className="design-title"><h3>{proposal.name}</h3><strong>{money(proposal.quote.total, proposal.quote.currency)}</strong></div><p>{proposal.reasons.join(' ')}</p>
              <div className="locks"><span>{tr("保留喜欢的配件，再继续对话调整")}</span>{catalog.templates.find(t => t.id === proposal.config.templateId)?.slots.map(slot => <label key={slot.id}><input type="checkbox" checked={proposal.config.lockedSlots.includes(slot.id)} disabled={busy || !connected} onChange={() => lock(slot.id)}/>{slot.name} · {catalog.parts.find(part => part.id === proposal.config.slots[slot.id])?.name ?? tr("留空")}</label>)}</div>
              <div className="design-actions"><button disabled={busy || !connected} onClick={save}>{savedId ? tr("更新已保存设计") : tr("保存设计")}</button><button className="primary" disabled={busy || !connected} onClick={checkout}>{tr("查看报价，测试下单")}</button></div><a href="/#/saved" target="_blank" rel="noreferrer">{tr("打开我的收藏，继续 3D 调整 ↗")}</a>
            </div>
          </> : <div className="empty-design"><span>✧</span><p>{tr("你的下一件小欢喜，会出现在这里。")}</p><small>{tr("支持旋转查看，搭配和报价来自同一份配置。")}</small></div>}
        </section>
      </div>
      {prepared && <section className="checkout" aria-label={tr("确认测试订单")}><div><div className="eyebrow">ONE LAST LOOK</div><h2>{tr("确认这份搭配")}</h2><p>{prepared.designName}</p><p>{tr(prepared.notice)}</p><p className="configuration">{catalog?.templates.find(t => t.id === prepared.config.templateId)?.name} · {catalog?.connectors.find(c => c.id === prepared.config.connectorId)?.name} · {prepared.config.metalTone === 'gold' ? tr("金色") : tr("银色")} · {catalog?.cordColors.find(c => c.id === prepared.config.cordColor)?.name}</p>{catalog?.templates.find(t => t.id === prepared.config.templateId)?.slots.map(slot => <p className="configuration" key={slot.id}>{slot.name}：{catalog.parts.find(part => part.id === prepared.config.slots[slot.id])?.name ?? tr("留空")}</p>)}</div><div><ul>{prepared.quote.lines.map(line => <li key={line.id}><span>{tr(line.name)} × {line.quantity}</span><span>{money(line.subtotal)}</span></li>)}</ul><div className="total"><span>{tr("测试订单总额")}</span><strong>{money(prepared.quote.total, prepared.quote.currency)} USD</strong></div><small>{expired ? tr("报价确认已过期，请重新查看报价。") : tr("请核对配置和价格。此确认在 10 分钟后过期。")}</small><div className="design-actions"><button disabled={busy} onClick={() => setPrepared(undefined)}>{tr("取消")}</button><button className="primary" disabled={busy || !!expired || !connected} onClick={confirm}>{tr("确认创建测试订单")}</button></div></div></section>}
      <section className="history"><div className="section-heading"><h2>{tr("留住的灵感与测试订单")}</h2><button disabled={!connected || busy} onClick={history}>{tr("读取已保存记录")}</button></div>{historyLoaded ? <div className="history-grid"><div><h3>{tr("设计 · 最近 50 份")}</h3>{!designs.length && <p>{tr("还没有保存设计。")}</p>}{designs.map(design => <button key={design.id} disabled={busy || !connected} onClick={() => load(design.id)}>{design.name}<span>{tr("继续搭配 →")}</span></button>)}</div><div><h3>{tr("测试订单 · 最近 50 笔")}</h3>{!orders.length && <p>{tr("还没有测试订单。")}</p>}{orders.map(order => <p key={order.id}><strong>{order.designName}</strong> · {money(order.quote.total, order.quote.currency)}<small>{tr("测试已确认 ·")} {order.id}</small></p>)}</div></div> : <p>{tr("读取当前浏览器访客的记录，与原工作室保持同步。")}</p>}</section>
      <details className="technical"><summary>{tr("MCP 调用记录与连接设置")}</summary><p>{tr("这个页面通过官方 SDK 执行 initialize、tools/list 和 tools/call，业务操作使用 Streamable HTTP。")}</p><ol>{traces.map(entry => <li key={entry.id}><code>{entry.method}</code><span>{entry.state === 'pending' ? tr("处理中") : entry.state === 'ok' ? tr("成功") : tr("失败")}{entry.elapsedMs !== undefined ? ` · ${entry.elapsedMs} ms` : ''}</span></li>)}</ol><button disabled={!connected || busy} onClick={() => setShowConnection(value => !value)}>{showConnection ? tr("隐藏连接凭证") : tr("显示外部 MCP 客户端连接信息")}</button>{showConnection && client.current?.connectionInfo() && <div className="credentials"><p>{tr("此凭证可访问当前访客的设计和测试订单，有效期 24 小时。只粘贴到你信任的 MCP 客户端；不要放进演示录像或代码仓库。")}</p><label>{tr("Streamable HTTP 地址")}<input readOnly value={client.current.connectionInfo()!.endpoint}/></label><label>{tr("Authorization 请求头")}<input readOnly type="password" value={`Bearer ${client.current.connectionInfo()!.token}`} onFocus={event => event.target.select()}/></label><small>{tr("到期时间：")}{new Date(client.current.connectionInfo()!.expiresAt).toLocaleString(locale)}</small></div>}</details>
      <footer>{tr("LOOP · 自托管 MCP + 网页模拟体验。没有真实支付、库存预留或物流履约。")}<a href="https://amazonappdev2026.devpost.com/details/faqs" target="_blank" rel="noreferrer">{tr("比赛接入说明 ↗")}</a></footer>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider title="LOOP · MCP 搭配演示"><Demo/></LanguageProvider>);
