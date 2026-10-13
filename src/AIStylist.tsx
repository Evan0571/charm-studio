import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Bookmark, Check, ChevronDown, Plus, RotateCcw, SlidersHorizontal, Sparkles, Square } from 'lucide-react';
import { validateConfig } from '../shared/domain';
import type { Catalog, DesignConfig, Quote } from '../shared/types';
import type { StylistMessage, StylistProposal, StylistResponse } from '../shared/stylist';
import { useLanguage } from './Language';
import ProductPreview from './ProductPreview';
import './ai-atelier.css';

type Turn = StylistMessage & { proposal?: StylistProposal | null };
type Session = { version: 1; turns: Turn[]; draft: string; proposal: StylistProposal | null; suggestions: string[]; useCurrent: boolean };
type Props = {
  catalog: Catalog;
  currentConfig: DesignConfig;
  onEdit: (proposal: StylistProposal) => void;
  onCheckout: (proposal: StylistProposal) => void;
  onSave?: (proposal: StylistProposal) => void;
  onCapture?: (config: DesignConfig, url: string) => void;
  snapshot?: (config: DesignConfig) => string | undefined;
  active?: boolean;
};

const SESSION_KEY = 'loop.atelier-conversation.v1';
const MAX_TURNS = 24;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const boundedText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const emptySession = (): Session => ({ version: 1, turns: [], draft: '', proposal: null, suggestions: [], useCurrent: false });
const proposalKey = (value: StylistProposal | null | undefined) => value ? JSON.stringify([value.name, value.config]) : '';

function validateQuote(value: unknown): Quote {
  if (!object(value) || !Array.isArray(value.lines) || value.lines.length > 20 || typeof value.total !== 'number' || !Number.isFinite(value.total) || value.total < 0 || (value.currency !== 'USD' && value.currency !== 'CNY')) throw new Error('Invalid quote');
  const lines = value.lines.map(line => {
    if (!object(line) || !boundedText(line.id, 100) || !boundedText(line.name, 200) || typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20 || typeof line.unitPrice !== 'number' || !Number.isFinite(line.unitPrice) || line.unitPrice < 0 || typeof line.subtotal !== 'number' || !Number.isFinite(line.subtotal) || line.subtotal < 0 || Math.abs(line.quantity * line.unitPrice - line.subtotal) > .01) throw new Error('Invalid quote line');
    return { id: line.id, name: line.name, quantity: line.quantity, unitPrice: line.unitPrice, subtotal: line.subtotal };
  });
  if (Math.abs(lines.reduce((sum, line) => sum + line.subtotal, 0) - value.total) > .01) throw new Error('Invalid quote total');
  return { lines, total: value.total, currency: value.currency };
}

function validateStrings(value: unknown, maxLength = 200): string[] {
  if (!Array.isArray(value) || value.length > 3 || value.some(item => !boundedText(item, maxLength))) throw new Error('Invalid suggestions');
  return value as string[];
}

function validateProposal(value: unknown): StylistProposal | null {
  if (value === null || value === undefined) return null;
  if (!object(value) || !boundedText(value.name, 50)) throw new Error('Invalid proposal');
  return { name: value.name, config: validateConfig(value.config), quote: validateQuote(value.quote), reasons: validateStrings(value.reasons) };
}

function readSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw || raw.length > 150_000) return emptySession();
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1 || !Array.isArray(value.turns) || value.turns.length > MAX_TURNS || typeof value.draft !== 'string' || value.draft.length > 1600 || typeof value.useCurrent !== 'boolean') return emptySession();
    const turns: Turn[] = value.turns.map(turn => {
      if (!object(turn) || (turn.role !== 'user' && turn.role !== 'assistant') || !boundedText(turn.content, 3000)) throw new Error('Invalid conversation');
      return { role: turn.role, content: turn.content, ...(turn.role === 'assistant' ? { proposal: validateProposal(turn.proposal) } : {}) };
    });
    return { version: 1, turns, draft: value.draft, proposal: validateProposal(value.proposal), suggestions: validateStrings(value.suggestions), useCurrent: value.useCurrent };
  } catch { return emptySession(); }
}

// Stay within the server's message and character limits after a long conversation.
function recentHistory(turns: Turn[], message: string): StylistMessage[] {
  const recent: StylistMessage[] = [];
  let remaining = 20_000 - message.length;
  for (const turn of turns.slice(-18).reverse()) {
    if (turn.content.length > remaining) break;
    recent.unshift({ role: turn.role, content: turn.content });
    remaining -= turn.content.length;
  }
  return [...recent, { role: 'user', content: message }];
}

const inspirations = [
  { template: 'cord', en: 'Soft botanicals', zh: '自然三重奏', moodEn: 'Sage green · pearl · a touch of gold', moodZh: '鼠尾草绿 · 珍珠 · 温润金色', promptEn: 'Create a fresh, natural bag charm with sage cord, a pear charm, pearl beads and a small floral accent. Keep it balanced and under $20.', promptZh: '给我搭一个自然清新的包挂，鼠尾草绿编绳、青梨、珍珠和小花点缀，整体平衡，预算 20 美元以内。' },
  { template: 'chain', en: 'Everyday shine', zh: '日常微光', moodEn: 'Fine chain · pearl · a little sparkle', moodZh: '细金属链 · 珍珠 · 星光点缀', promptEn: 'Design a simple chain bag charm for an everyday black bag. Use a pearl and a small star, keep the gold finish and avoid too many parts.', promptZh: '帮我给黑色日常包搭一个简约的金属链包挂，用珍珠和小星星，保留金色五金，不要太多配件。' },
  { template: 'hero', en: 'Banana days', zh: '香蕉好日子', moodEn: 'Stitched leather · playful yellow', moodZh: '绣线皮革 · 明亮香蕉黄', promptEn: 'I want a playful banana bag charm for a cream bag, with a leather strap and a pearl accent. Let the banana be the main focus.', promptZh: '我想给奶白色包搭一个俏皮的香蕉包挂，用皮革挂带和一颗珍珠点缀，让香蕉成为主角。' },
] as const;

export default function AIStylist({ catalog, currentConfig, onEdit, onCheckout, onSave, onCapture, snapshot, active = true }: Props) {
  const { language, money } = useLanguage();
  const en = language === 'en';
  const copy = (english: string, chinese: string) => en ? english : chinese;
  const [initial] = useState(readSession);
  const [turns, setTurns] = useState<Turn[]>(initial.turns);
  const [draft, setDraft] = useState(initial.draft);
  const [proposal, setProposal] = useState<StylistProposal | null>(initial.proposal);
  const [suggestions, setSuggestions] = useState(initial.suggestions);
  const [useCurrent, setUseCurrent] = useState(initial.useCurrent);
  const [pending, setPending] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [longWait, setLongWait] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const pendingBrief = useRef('');
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const controller = new AbortController();
    const check = () => {
      void fetch('/api/ai/status', { signal: controller.signal }).then(response => response.ok ? response.json() : Promise.reject(new Error('Status unavailable'))).then(data => { if (!controller.signal.aborted) setConfigured(data.configured === true); }).catch(() => { if (!controller.signal.aborted) setConfigured(null); });
    };
    check();
    window.addEventListener('focus', check);
    return () => { controller.abort(); window.removeEventListener('focus', check); request.current?.abort(); };
  }, []);

  useEffect(() => {
    const session: Session = { version: 1, turns: turns.slice(-MAX_TURNS), draft: pending ? pendingText : draft, proposal, suggestions, useCurrent };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [turns, draft, proposal, suggestions, useCurrent, pending, pendingText]);

  useEffect(() => {
    if (!pending) { setLongWait(false); return; }
    const timer = window.setTimeout(() => setLongWait(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (active && (turns.length || pending)) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns.length, pending, active]);

  const capture = useCallback((url: string) => { if (proposal) onCapture?.(proposal.config, url); }, [proposal, onCapture]);

  async function send(text = draft) {
    const message = text.trim();
    if (!message || message.length > 1600 || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    pendingBrief.current = message;
    setPending(true); setPendingText(message); setError(''); setNotice(''); setDraft('');
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    try {
      const response = await fetch('/api/ai/design', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ language, messages: recentHistory(turns, message), ...((useCurrent || proposal) ? { currentConfig: useCurrent ? currentConfig : proposal!.config } : {}) }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? copy('The atelier is busy. Give it a moment, then try again.', '灵感搭配现在有点忙，请稍后再试。') : response.status === 503 ? copy('The stylist is currently unavailable. Your brief is saved; you can continue in the studio.', '灵感搭配暂时不可用。你的想法已保留，也可以进入工作室继续创作。') : response.status === 504 ? copy('This idea took a little too long. Your brief is ready to try again.', '这次搭配用时有点久。你的想法已保留，可以再试一次。') : copy('We couldn’t finish this idea. Your brief is still here; please try again.', '这次没有完成搭配。你的想法已保留，请再试一次。'));
        setDraft(message); return;
      }
      const raw: unknown = await response.json();
      if (!object(raw) || !boundedText(raw.message, 3000)) throw new Error('Invalid stylist response');
      const answer: StylistResponse = { message: raw.message, proposal: validateProposal(raw.proposal), suggestions: validateStrings(raw.suggestions) };
      if (request.current !== controller) return;
      setConfigured(true);
      setTurns(previous => [...previous, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: answer.message, proposal: answer.proposal }].slice(-MAX_TURNS));
      if (answer.proposal) { setProposal(answer.proposal); setUseCurrent(false); }
      setSuggestions(answer.suggestions);
    } catch {
      if (request.current !== controller) return;
      if (!controller.signal.aborted || timedOut) {
        setError(timedOut ? copy('This idea took a little too long. Your brief is ready to try again.', '这次搭配用时有点久。你的想法已保留，可以再试一次。') : copy('We couldn’t finish this idea. Your brief is still here; please try again.', '这次没有完成搭配。你的想法已保留，请再试一次。'));
        setDraft(message);
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setPending(false); setPendingText(''); pendingBrief.current = ''; }
    }
  }

  function stop() {
    request.current?.abort(); request.current = null;
    setDraft(pendingBrief.current || draftRef.current); setPending(false); setPendingText('');
    setNotice(copy('Stopped. Edit your brief and send it when you’re ready.', '已停止。可以修改想法，准备好后再发送。'));
    window.setTimeout(() => input.current?.focus(), 0);
  }

  function startOver() {
    request.current?.abort(); request.current = null; pendingBrief.current = '';
    setTurns([]); setProposal(null); setSuggestions([]); setDraft(''); setError(''); setNotice(''); setUseCurrent(false); setPending(false); setPendingText('');
    window.setTimeout(() => input.current?.focus(), 0);
  }

  const hasConversation = turns.length > 0 || pending;
  const selectedParts = proposal ? Object.values(proposal.config.slots).filter((id): id is string => !!id).map(id => catalog.parts.find(part => part.id === id)).filter((part): part is NonNullable<typeof part> => !!part) : [];
  const versions = turns.filter(turn => turn.proposal).map(turn => turn.proposal!);
  const selectedVersion = versions.findIndex(value => proposalKey(value) === proposalKey(proposal));
  const composer = <div className="atelier-brief-area">
    {useCurrent && <div className="atelier-context"><Check size={14}/><span>{copy('Starting from your studio design. Locked parts stay in place.', '从工作室当前设计开始，保留已锁定配件。')}</span><button type="button" disabled={pending} onClick={() => setUseCurrent(false)}>{copy('Remove', '取消')}</button></div>}
    {error && <div className="atelier-ai-error" role="alert"><p>{error}</p><button type="button" onClick={() => void send()} disabled={pending || !draft.trim()}><RotateCcw size={14}/>{copy('Try again', '重试')}</button></div>}
    {configured === false && !error && <p className="atelier-availability">{copy('The stylist is currently unavailable. Explore the studio to build a design at your own pace.', '灵感搭配暂时不可用。也可以进入工作室，按自己的节奏搭配。')}</p>}
    <form className="atelier-brief" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor="stylist-prompt">{proposal ? copy('What would you change?', '还想调整哪里？') : copy('Tell us what you have in mind', '说说你心里的搭配')}</label>
      <textarea id="stylist-prompt" ref={input} value={draft} onChange={event => { setDraft(event.target.value); if (error) setError(''); }} placeholder={proposal ? copy('Keep the pearl, switch to silver, simplify the rest…', '保留珍珠，换成银色，其他配件更简约一点…') : copy('A vintage charm for my brown leather bag, under $20…', '给我的棕色皮革包搭一个复古包挂，预算 20 美元以内…')} rows={3} maxLength={1600} disabled={pending} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/>
      <div className="atelier-brief-bottom"><span>{copy('Style, bag color, budget — start anywhere.', '风格、包的颜色、预算，都可以。')}</span>{pending ? <button className="atelier-stop" type="button" onClick={event => { event.preventDefault(); stop(); }}><Square size={12} fill="currentColor"/>{copy('Stop', '停止')}</button> : <button className="atelier-send" type="submit" disabled={!draft.trim()} aria-label={copy('Send your idea', '发送灵感')}><ArrowUp size={18}/></button>}</div>
    </form>
    {!pending && suggestions.length > 0 && <div className="atelier-followups" aria-label={copy('Ways to refine your design', '继续调整搭配')}>{suggestions.map(value => <button type="button" key={value} onClick={() => void send(value)}>{value}<ArrowRight size={12}/></button>)}</div>}
    {notice && <p className="atelier-notice" role="status">{notice}</p>}
    <div className="atelier-brief-note"><span>{copy('Every idea becomes an editable design.', '每份灵感都可以继续编辑。')}</span><button type="button" disabled={pending || useCurrent} onClick={() => { setUseCurrent(true); setNotice(''); input.current?.focus(); }}><SlidersHorizontal size={13}/>{copy('Use studio design', '从当前设计开始')}</button></div>
  </div>;

  return <section className={`atelier-ai ${proposal ? 'atelier-ai-designed' : ''}`} aria-label={copy('LOOP inspiration atelier', 'LOOP 灵感工坊')}>
    <div className="atelier-ai-top"><span className="atelier-ai-label"><Sparkles size={15}/>{copy('THE INSPIRATION ATELIER', '灵感工坊')}<i/>{copy('Your idea, made tangible.', '让想法，有了形状。')}</span><div className="atelier-session-tools">{(turns.length > 0 || draft) && <span><i/>{storageAvailable ? copy('Draft kept in this browser', '草稿已保存在此浏览器') : copy('Draft kept for this visit', '草稿保留在本次访问中')}</span>}<button onClick={startOver} disabled={!hasConversation && !draft && !useCurrent}><Plus size={15}/>{copy('New idea', '新灵感')}</button></div></div>
    {!hasConversation && !proposal ? <div className="atelier-welcome">
      <div className="atelier-welcome-copy"><span className="atelier-overline">01 / {copy('BEGIN WITH A FEELING', '从一种感觉开始')}</span><h1>{copy('Something good,', '把喜欢的日常，')}<br/><em>{copy('made yours.', '搭成你的样子。')}</em></h1><p>{copy('A color you love. A bag you carry. A mood for the day. Tell us the idea, and we’ll find the details that belong together.', '一个喜欢的颜色，一只常背的包，或今天的心情。说出想法，我们一起找到合适的细节。')}</p>{composer}<div className="atelier-how"><span>01 <b>{copy('Describe', '说出想法')}</b></span><ArrowRight size={12}/><span>02 <b>{copy('Refine', '调整细节')}</b></span><ArrowRight size={12}/><span>03 <b>{copy('Make it yours', '保存作品')}</b></span></div></div>
      <div className="atelier-inspirations"><div className="atelier-inspirations-heading"><span className="atelier-overline">{copy('A FEW STARTING POINTS', '从这些搭配找灵感')}</span><p>{copy('Find your direction.', '找到你的搭配方向。')}</p></div><div className="atelier-inspiration-cards">{inspirations.map((item, index) => <button type="button" className={`atelier-inspiration-card inspiration-${item.template}`} key={item.template} onClick={() => void send(en ? item.promptEn : item.promptZh)} disabled={pending}><div className="atelier-inspiration-art"><span>0{index + 1}</span><img src={`/assets/thumbnails/template-${item.template}.png`} alt={en ? item.en : item.zh}/></div><div className="atelier-inspiration-info"><h2>{en ? item.en : item.zh}</h2><p>{en ? item.moodEn : item.moodZh}</p><span>{copy('Try this direction', '试试这个灵感')}<ArrowRight size={14}/></span></div></button>)}</div><p className="atelier-inspiration-note">{copy('Starting points from our collection. Your design will follow your own brief.', '这些是系列搭配示例，你的方案将根据想法重新搭配。')}</p></div>
    </div> : <div className={`atelier-ai-workspace ${proposal ? 'has-design' : 'awaiting-design'}`}>
      {proposal && <article className="atelier-design" aria-label={copy('Your proposed design', '你的搭配方案')}><div className="atelier-design-heading"><div><span className="atelier-overline">{copy('YOUR DESIGN', '你的搭配')} {selectedVersion >= 0 ? ` / ${String(selectedVersion + 1).padStart(2, '0')}` : ''}</span><h1>{proposal.name}</h1></div><div className="atelier-design-price"><span>{copy('Design total', '搭配总价')}</span><strong>{money(proposal.quote.total, proposal.quote.currency)}</strong></div></div><div className={`atelier-design-art ${pending ? 'is-refining' : ''}`}>
        {active && <ProductPreview key={proposalKey(proposal)} config={proposal.config} catalog={catalog} snapshot={snapshot?.(proposal.config)} onCapture={capture}/>}<span className="atelier-design-preview-tag">{copy('Product preview', '成品预览')}</span>{pending && <div className="atelier-refining-label"><span className="atelier-status-dot"/>{copy('Refining your next version…', '正在调整下一版…')}</div>}
      </div><div className="atelier-design-details"><div className="atelier-design-materials"><span>{catalog.templates.find(template => template.id === proposal.config.templateId)?.name}</span><i/><span>{proposal.config.metalTone === 'gold' ? copy('Champagne gold', '香槟金') : copy('Soft silver', '柔光银')}</span><i/><span>{selectedParts.length} {copy('selected details', '件精选配件')}</span></div><div className="atelier-design-parts" aria-label={copy('Selected parts', '已选配件')}>{selectedParts.map((part, index) => <span key={`${part.id}-${index}`} title={`${part.name} · ${part.material}`}><img src={`/assets/thumbnails/part-${part.id}.png`} alt=""/><span>{part.name}</span></span>)}</div>{proposal.reasons.length > 0 && <details className="atelier-design-reasons"><summary>{copy('A closer look at the details', '看看搭配细节')}<ChevronDown size={14}/></summary><ul>{proposal.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}<div className="atelier-design-actions"><button className="atelier-primary" type="button" disabled={pending} onClick={() => onEdit(proposal)}>{copy('Refine in the studio', '进入工作室调整')}<ArrowRight size={17}/></button>{onSave && <button className="atelier-save" type="button" disabled={pending} onClick={() => onSave(proposal)}><Bookmark size={16}/>{copy('Save design', '保存设计')}</button>}</div><div className="atelier-design-order"><button type="button" disabled={pending} onClick={() => onCheckout(proposal)}>{copy('Review test order', '查看测试订单')}<ArrowRight size={13}/></button><span>{copy('No payment or shipping.', '不会扣款或发货。')}</span></div></div></article>}
      <aside className="atelier-conversation"><div className="atelier-conversation-heading"><span className="atelier-overline">{copy('THE CONVERSATION', '搭配对话')}</span><span>{copy('Find it. Fine-tune it.', '一起找到，再慢慢打磨。')}</span></div><div className="atelier-messages" role="log" aria-label={copy('Design conversation', '搭配对话')} aria-live="polite">{turns.map((turn, index) => <div key={index} className={`atelier-message ${turn.role}`}><small>{turn.role === 'assistant' ? <><Sparkles size={12}/>{copy('LOOP STYLIST', 'LOOP 灵感搭档')}</> : copy('YOUR BRIEF', '你的想法')}</small><p>{turn.content}</p>{turn.proposal && <button type="button" className={`atelier-version ${proposalKey(proposal) === proposalKey(turn.proposal) ? 'selected' : ''}`} onClick={() => { setProposal(turn.proposal!); setUseCurrent(false); }} disabled={pending}><span>{turn.proposal.name}</span>{proposalKey(proposal) === proposalKey(turn.proposal) ? <><Check size={13}/><small>{copy('In view', '正在预览')}</small></> : <><small>{copy('View version', '查看此版本')}</small><ArrowRight size={13}/></>}</button>}</div>)}{pending && <><div className="atelier-message user"><small>{copy('YOUR BRIEF', '你的想法')}</small><p>{pendingText}</p></div><div className="atelier-message assistant atelier-thinking" role="status"><small><Sparkles size={12}/>{copy('LOOP STYLIST', 'LOOP 灵感搭档')}</small><p><span className="atelier-status-dot"/>{longWait ? copy('Still finding the right balance. You can stop and edit your brief.', '还在寻找合适的搭配。可以随时停止，修改想法。') : copy('Choosing the shapes, colors and details…', '正在挑选形状、颜色和细节…')}</p></div></>}<div ref={end}/></div>{composer}</aside>
    </div>}
  </section>;
}
