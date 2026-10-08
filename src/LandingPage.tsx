import { useLanguage, LanguageSwitcher } from './Language';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, Check, Move3D, SlidersHorizontal, Sparkles } from 'lucide-react';
import './discovery.css';

export default function LandingPage({ logo, onStart, onStudio }: { logo: ReactNode; onStart: () => void; onStudio: () => void }) {
 const { tr, language } = useLanguage();
  return <div className="landing-page">
    <header className="landing-header"><a href="#/" aria-label={tr("LOOP 首页")}>{logo}</a><nav aria-label={tr("首页导航")}><a href="#possibilities">{tr("创作的可能")}</a><a href="#how-it-works">{tr("如何开始")}</a></nav><div className="landing-header-actions"><LanguageSwitcher/><button className="landing-start" onClick={onStart}>{language === 'en' ? 'Get Started' : '开始创作'} <ArrowRight size={16}/></button></div></header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy"><span className="landing-eyebrow"><span/> A LITTLE CHARM, A LOT OF YOU.</span><h1>{tr("一点喜欢，")}<br/>{tr("就很")}<span>{tr("不一样。")}</span></h1><p>{tr("把脑海里的小灵感，变成包上的小个性。")}<br/>{tr("和 AI 聊聊、亲手搭配，让日常多一点你的样子。")}</p><div className="landing-hero-actions"><button className="primary" onClick={onStart}>{language === 'en' ? 'Get Started' : '开始创作'} <ArrowRight size={19}/></button><button className="landing-text-link" onClick={onStudio}>{tr("自己动手搭配")} <ArrowRight size={16}/></button></div><div className="landing-reassurance"><Check size={14}/>{tr("无需注册，灵感随时开始")}<span>·</span>{tr("可编辑的真实搭配")}</div></div>
        <div className="landing-editorial" aria-label={tr("LOOP 棕色皮革包与包挂搭配示意")}>
          <span className="editorial-index">THE EVERYDAY, REIMAGINED.</span><span className="editorial-orbit"/><img className="editorial-bag" src="/assets/landing/tote.png" alt={tr("棕色皮革托特包的 3D 渲染示意")}/>
          <div className="editorial-charm"><span>YOUR LITTLE LOOP</span><img src="/assets/thumbnails/template-cord.png" alt={tr("编绳珠子与水果挂饰搭配")}/><small>{tr("一点小物，一点自己。")}</small></div>
          <div className="editorial-prompt"><span><Sparkles size={15}/>{tr("一点想法，就能开始")}</span><p>{tr("“想要一点复古感，")}<br/>{tr("配我的棕色包。”")}</p><i><span/><span/><span/></i></div>
          <div className="editorial-tag"><span className="editorial-tag-icon"><Sparkles size={17}/></span><div><strong>{tr("你的风格，没有标准答案。")}</strong><span>{tr("想法 → 搭配 → 日常")}</span></div></div>
          <span className="editorial-caption">LOOP OBJECTS / 01 <span>{tr("模型与搭配示意")}</span></span>
        </div>
      </section>
      <div className="landing-divider"><span>{tr("小物件，大一点的表达。")}</span><a href="#possibilities">{tr("往下看看")} <ArrowDown size={14}/></a></div>
      <section className="landing-possibilities" id="possibilities"><div className="landing-section-heading"><div><span className="landing-eyebrow">MADE OF LITTLE POSSIBILITIES</span><h2>{tr("从一句“我想要”，")}<br/>{tr("到一件“这就是我”。")}</h2></div><p>{tr("不用从空白开始，也不必止步于推荐。")}<br/>{tr("每一份灵感，都能继续被你改写。")}</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature feature-ai"><div className="feature-visual"><span className="feature-chat-user">{tr("复古一点，搭配棕色包。")}</span><span className="feature-chat-ai"><Sparkles size={18}/><span>{tr("从暖木、珍珠和香槟金开始，")}<br/>{tr("让细节慢慢有了你的样子。")}</span></span><div className="feature-parts">{['wood','pearl','star'].map(id=><img key={id} src={`/assets/thumbnails/part-${id}.png`} alt={id==='wood'?tr("暖木圆珠"):id==='pearl'?tr("柔光珍珠"):tr("口袋星光")}/>)}</div></div><span className="feature-number">01 / FIND YOUR IDEA</span><h3>{tr("和灵感，聊一聊。")}</h3><p>{tr("说说风格、颜色或预算。AI 从现有配件中，为你组合一份能继续编辑的初稿。")}</p><button onClick={onStart}>{tr("试试 AI 灵感搜索")} <ArrowRight size={16}/></button></article>
          <article className="landing-feature feature-3d"><div className="feature-visual"><img src="/assets/thumbnails/template-chain.png" alt={tr("金属垂链配件组合的 3D 渲染")}/><span className="feature-rotation"><Move3D size={15}/>{tr("每一面，都看得见")}</span></div><span className="feature-number">02 / MAKE IT YOURS</span><h3>{tr("细节，由你做主。")}</h3><p>{tr("在 3D 工作室旋转查看、替换配件、调整配色，再试试挂在不同包型上的效果。")}</p><button onClick={onStudio}>{tr("走进创作工作室")} <ArrowRight size={16}/></button></article>
          <article className="landing-feature feature-save"><div className="feature-visual"><div className="feature-mini-design"><img src="/assets/thumbnails/template-hero.png" alt={tr("香蕉主题挂坠")}/><div><span>MY LITTLE COLLECTION</span><strong>{tr("属于周五的好心情")}</strong><small><Check size={12}/>{tr("每一份喜欢，都有归处")}</small></div></div><span className="feature-saved-stamp"><Check size={15}/>  {tr("设计 · 预览 · 确认")}</span></div><span className="feature-number">03 / KEEP THE FEELING</span><h3>{tr("把喜欢，留下来。")}</h3><p>{tr("保存你的专属搭配，随时回来继续创作。确认配件与明细后，体验完整的测试下单流程。")}</p><button onClick={onStudio}>{tr("开始我的第一件")} <ArrowRight size={16}/></button></article>
        </div>
      </section>
      <section className="landing-how" id="how-it-works"><span className="landing-eyebrow">YOUR IDEA. YOUR LITTLE LOOP.</span><h2>{tr("创作的第一步，")}<br/>{tr("只需要一点喜欢。")}</h2><div className="landing-steps">{[{Icon:Sparkles,title:tr("说出你的想法"),text:tr("一种风格、一只包，或今天的心情。")},{Icon:SlidersHorizontal,title:tr("调成你的样子"),text:tr("保留喜欢的，再改一点点细节。")},{Icon:Check,title:tr("收好这份喜欢"),text:tr("保存设计，或确认搭配后测试下单。")}].map(({Icon,title,text},i)=><div key={title}><span><Icon size={23}/></span><small>0{i+1}</small><h3>{title}</h3><p>{text}</p></div>)}</div><button className="primary" onClick={onStart}>{language === 'en' ? 'Get Started' : '开始创作'} <ArrowRight size={18}/></button><p className="landing-test-note">{tr("当前为创作体验版，测试订单不会扣款或发货。")}</p></section>
    </main><footer className="landing-footer">{logo}<span>{tr("一点喜欢，随你同行。")}</span><span>© {new Date().getFullYear()} LOOP Studio</span></footer>
  </div>;
}
