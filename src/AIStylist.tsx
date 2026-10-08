import { useLanguage } from './Language';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, MessageCircle, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Catalog, DesignConfig } from '../shared/types';
import type { StylistMessage, StylistProposal, StylistResponse } from '../shared/stylist';
import { CharmPreview } from './CharmArt';
import './discovery.css';

type Turn = StylistMessage & { proposal?: StylistProposal | null };
const prompts = [
  { tag: 'VINTAGE MOOD', title: '给棕色包一点复古感', text: '我想要一个复古风格的包挂，搭配我的棕色皮革包，预算 20 美元以内。', parts: ['wood', 'pearl'] },
  { tag: 'LESS, BUT LOVELY', title: '通勤，也想有点小个性', text: '帮我给黑色通勤包搭一个简约的包挂，银色金属，不要太多配件。', parts: ['star', 'clear'] },
  { tag: 'A LITTLE JOY', title: '把好心情挂在包上', text: '想给奶白色小包搭一个可爱的水果包挂，颜色活泼一点。', parts: ['cherry', 'pear'] },
];

export default function AIStylist({ catalog, currentConfig, onEdit, onCheckout }: { catalog: Catalog; currentConfig: DesignConfig; onEdit: (proposal: StylistProposal) => void; onCheckout: (proposal: StylistProposal) => void }) {
 const { tr, language, money } = useLanguage();
  const [turns, setTurns] = useState<Turn[]>([]), [draft, setDraft] = useState('');
  const [proposal, setProposal] = useState<StylistProposal | null>(null), [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, setPending] = useState(false), [pendingText, setPendingText] = useState(''), [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null), [useCurrent, setUseCurrent] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null), end = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null);
  useEffect(() => {
    const check = () => { void fetch('/api/ai/status').then(r => r.ok ? r.json() : Promise.reject()).then(data => setConfigured(data.configured)).catch(() => setConfigured(null)); };
    check(); window.addEventListener('focus', check);
    return () => { window.removeEventListener('focus', check); request.current?.abort(); };
  }, []);
  useEffect(() => { if (turns.length || pending) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns, pending]);
  async function send(text = draft) {
    if (!text.trim() || request.current) return;
    const message = text.trim();
    const controller = new AbortController(); request.current = controller;
    setPending(true); setPendingText(message); setError(''); setDraft('');
    try {
      const history: StylistMessage[] = [...turns.map(({ role, content }) => ({ role, content })).slice(-18), { role: 'user', content: message }];
      const response = await fetch('/api/ai/design', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ language, messages: history, ...((proposal || useCurrent) ? { currentConfig: proposal?.config ?? currentConfig } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || tr("暂时连接不上 AI，请重试。"));
      const answer = result as StylistResponse;
      setConfigured(true);
      setTurns(previous => [...previous, { role: 'user', content: message }, { role: 'assistant', content: answer.message, proposal: answer.proposal }]);
      if (answer.proposal) setProposal(answer.proposal);
      setSuggestions(answer.suggestions);
    } catch (reason) {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : tr("暂时连接不上 AI，请重试。")); setDraft(message); }
    } finally { if (!controller.signal.aborted) { setPending(false); setPendingText(''); } request.current = null; }
  }
  function startOver() { setTurns([]); setProposal(null); setSuggestions([]); setDraft(''); setError(''); setUseCurrent(false); input.current?.focus(); }
  function choosePrompt(value: string) { setDraft(value); input.current?.focus(); }
  return <section className={`ai-page ${turns.length ? 'has-conversation' : ''}`} aria-label={tr("AI 灵感搜索")}>
    <div className="ai-page-top"><span><Sparkles size={16}/> LOOP AI <i/>{tr("你的灵感搭档")}</span><button onClick={startOver} disabled={pending || (!turns.length && !draft && !useCurrent)}><Plus size={16}/>{tr("新灵感")}</button></div>
    <div className={`ai-layout ${proposal ? 'with-proposal' : ''}`}>
      <div className="ai-conversation">
        {!turns.length && !pending ? <div className="ai-welcome"><span className="ai-welcome-icon"><Sparkles size={29}/></span><span className="landing-eyebrow">A CONVERSATION, A LITTLE CREATION.</span><h1>{tr("今天，想把什么")}<br/><em>{tr("喜欢")}</em>{tr("挂在包上？")}</h1><p>{tr("说说你的想法，剩下的，我们一起搭。")}<br/>{tr("从风格和配色开始，找到属于你的第一份灵感。")}</p><div className="ai-inspiration-grid">{prompts.map(prompt => <button key={prompt.tag} onClick={() => choosePrompt(tr(prompt.text))}><span className="ai-prompt-parts">{prompt.parts.map(id => <img key={id} src={`/assets/thumbnails/part-${id}.png`} alt=""/>)}</span><small>{prompt.tag}</small><strong>{tr(prompt.title)}</strong><span>{tr("试试这个灵感")} <ArrowRight size={14}/></span></button>)}</div></div> : <div className="ai-messages" role="log" aria-label={tr("搭配对话")} aria-live="polite">
          {turns.map((turn, i) => <div key={i} className={`ai-message ${turn.role}`}><span className="ai-message-avatar">{turn.role === 'assistant' ? <Sparkles size={17}/> : tr("你")}</span><div><small>{turn.role === 'assistant' ? tr("LOOP · 灵感搭档") : tr("我的想法")}</small><p>{turn.content}</p>{turn.proposal && <button className={`ai-version ${proposal === turn.proposal ? 'selected' : ''}`} onClick={() => setProposal(turn.proposal!)} disabled={pending}><Check size={15}/>{turn.proposal.name}<span>{proposal === turn.proposal ? tr("正在预览") : tr("查看这个版本")}</span></button>}</div></div>)}
          {pending && <><div className="ai-message user"><span className="ai-message-avatar">{tr("你")}</span><div><small>{tr("我的想法")}</small><p>{pendingText}</p></div></div><div className="ai-message assistant"><span className="ai-message-avatar"><Sparkles size={17}/></span><div><small>{tr("LOOP · 灵感搭档")}</small><p className="ai-thinking"><span/><span/><span/>{tr("正在挑选配件，整理你的搭配…")}</p></div></div></>}
          <div ref={end}/>
        </div>}
        <div className="ai-composer-area">
          {!pending && suggestions.length > 0 && <div className="ai-followups">{suggestions.map(value => <button key={value} onClick={() => choosePrompt(value)}>{value}<ArrowRight size={12}/></button>)}</div>}
          {useCurrent && !proposal && <div className="ai-context"><Check size={13}/>{tr("已带入工作室当前搭配和锁定配件")}<button onClick={() => setUseCurrent(false)} disabled={pending}>{tr("取消")}</button></div>}
          {error && <div className="ai-error" role="alert"><p>{tr(error)}</p><button onClick={() => void send()} disabled={pending}><RotateCcw size={14}/>{tr("重试")}</button></div>}
          {configured === false && !error && <p className="ai-setup-note">{tr("AI 尚未启用：在项目根目录的 .env 中配置 OPENAI_API_KEY 后，重启服务即可开始。也可以先进入创作工作室。")}</p>}
          <form className="ai-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label className="visually-hidden" htmlFor="stylist-prompt">{tr("描述你的包挂想法")}</label><textarea id="stylist-prompt" ref={input} value={draft} onChange={event => setDraft(event.target.value)} placeholder={proposal ? tr("再调整一点？比如：保留珍珠，换成银色…") : tr("想要一个复古一点的包挂，搭配我的棕色包…")} rows={2} maxLength={1600} disabled={pending} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/><div className="ai-composer-bottom"><span><Search size={14}/>{proposal ? tr("继续打磨这份搭配") : tr("风格、包的颜色、预算，都可以聊")}</span><button className="ai-send" type="submit" disabled={pending || !draft.trim()} aria-label={tr("发送灵感")}>{pending ? <span className="spinner"/> : <ArrowUp size={21}/>}</button></div></form>
          <div className="ai-composer-note"><span>{tr("AI 从现有配件中搭配 · 每份初稿都可以继续编辑")}</span>{!turns.length && !useCurrent && <button onClick={() => { setUseCurrent(true); input.current?.focus(); }} disabled={pending}><SlidersHorizontal size={12}/>{tr("从当前设计开始")}</button>}</div>
        </div>
      </div>
      {proposal && <aside className="ai-proposal" aria-label={tr("AI 搭配初稿")}><div className="ai-proposal-top"><span><Sparkles size={14}/>{tr("为你搭配")}</span><small>{tr("可继续编辑")}</small></div><div className="ai-proposal-art"><CharmPreview catalog={catalog} config={proposal.config}/><span>{tr("方案示意 · 工作室内查看 3D")}</span></div><div className="ai-proposal-details"><span className="landing-eyebrow">YOUR LITTLE FIRST DRAFT</span><h2>{proposal.name}</h2><p className="ai-proposal-subtitle">{catalog.templates.find(item => item.id === proposal.config.templateId)?.name} · {proposal.config.metalTone === 'gold' ? tr("香槟金") : tr("月光银")}</p><ul>{proposal.reasons.map(reason => <li key={reason}><Check size={13}/>{reason}</li>)}</ul><div className="ai-selected-parts">{Object.entries(proposal.config.slots).filter(([, id]) => id).map(([slot, id]) => <span key={slot} title={catalog.parts.find(part => part.id === id)?.name}><img src={`/assets/thumbnails/part-${id}.png`} alt={catalog.parts.find(part => part.id === id)?.name}/></span>)}</div><div className="ai-proposal-price"><span>{tr("这份搭配的价格")}</span><strong>{money(proposal.quote.total, proposal.quote.currency)}</strong></div><button className="primary full-width" onClick={() => onEdit(proposal)}><SlidersHorizontal size={16}/>{tr("进入 3D 工作室调整")}<ArrowRight size={16}/></button><button className="secondary full-width" onClick={() => onCheckout(proposal)}>{tr("喜欢这版，去确认订单")} <ArrowRight size={15}/></button><p className="ai-order-note">{tr("测试订单，不会扣款或发货")}</p></div></aside>}
      {!proposal && turns.length > 0 && !pending && <div className="ai-awaiting"><MessageCircle size={20}/><p>{tr("再聊一点，")}<br/>{tr("让初稿更接近你的想法。")}</p></div>}
    </div>
  </section>;
}
