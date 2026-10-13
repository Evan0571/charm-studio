import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, Bookmark, Check, ChevronDown, Move3D, Sparkles } from 'lucide-react';
import { catalog as rawCatalog } from '../shared/catalog';
import { quoteConfig } from '../shared/domain';
import { localizeCatalog } from '../shared/localization';
import type { DesignConfig } from '../shared/types';
import { useLanguage, LanguageSwitcher } from './Language';
import { featuredDesigns } from './featuredDesigns';
import ProductPreview from './ProductPreview';
import './landing-editorial.css';

export interface LandingPageProps {
  logo: ReactNode;
  onStart: () => void;
  onStudio: () => void;
  onSelectDesign?: (config: DesignConfig, name: string) => void;
  onSaved?: () => void;
}

export default function LandingPage({ logo, onStart, onStudio, onSelectDesign, onSaved }: LandingPageProps) {
  const { language, money } = useLanguage();
  const en = language === 'en';
  const t = (english: string, chinese: string) => en ? english : chinese;
  const catalog = useMemo(() => localizeCatalog(rawCatalog, language), [language]);
  const [showBag, setShowBag] = useState(true);
  const hero = featuredDesigns.find(design => design.id === 'golden-hour') ?? featuredDesigns[0];
  const label = (name: { en: string; zh: string }) => en ? name.en : name.zh;
  const choose = (design: typeof hero) => onSelectDesign ? onSelectDesign(structuredClone(design.config), label(design.name)) : onStudio();
  const heroQuote = quoteConfig(hero.config);
  const faqs = [
    {
      question: t('Do I need an account to start?', '需要注册才能开始吗？'),
      answer: t('You can explore, customize and save a design without signing up. Your saved collection belongs to this browser’s guest account.', '无需注册，就能浏览、搭配和保存作品。你的收藏关联当前浏览器的访客账户。'),
    },
    {
      question: t('Can I change a design from the collection?', '精选搭配可以修改吗？'),
      answer: t('Every featured design is a starting point. Open it in the studio, change the charms, beads, cord color or metal finish, and see the itemized price update as you go.', '每件精选搭配都是一个起点。进入工作室，就能替换挂饰和珠子、调整绳色与金属色，并看到随搭配更新的价格明细。'),
    },
    {
      question: t('Where can I find my saved designs?', '保存的作品在哪里？'),
      answer: t('Open My collection to return to a saved design and continue editing. Use the same browser; clearing its cookies removes access to your guest collection.', '从「我的作品」打开已保存的搭配，就能继续编辑。请使用同一个浏览器；清除 Cookie 后，将无法再次访问这个访客账户下的作品。'),
    },
    {
      question: t('What happens when I place an order?', '下单后会发生什么？'),
      answer: t('LOOP is currently a design experience. A test order records your configuration, itemized price and confirmation. It does not charge you or ship a product.', 'LOOP 当前为创作体验版。测试订单会记录你的搭配、价格明细与确认结果，不会扣款或发货。'),
    },
    {
      question: t('What does the 3D preview show?', '3D 预览能说明什么？'),
      answer: t('The preview helps you explore shape, color, texture and how a design looks on a bag. Dimensions, materials and prices are experience examples, rather than specifications for a physical product.', '预览帮助你比较外形、配色、材质表现与挂包效果。模型尺寸、材质和价格属于体验样例，不代表实物商品规格。'),
    },
  ];

  return <div className="loop-home" id="loop-top">
    <div className="loop-home-note"><span/>{t('Your next signature detail starts here.', '从这里，找到你的随身个性。')}<span className="loop-note-divider">/</span><span>{t('The LOOP design experience', 'LOOP 创作体验版')}</span></div>
    <header className="loop-home-header">
      <a className="loop-home-brand" href="#/" aria-label={t('LOOP home', 'LOOP 首页')}>{logo}</a>
      <nav aria-label={t('Main navigation', '首页导航')}>
        <a href="#loop-collection">{t('The collection', '精选系列')}</a>
        <button onClick={onStudio}>{t('Design studio', '创作工作室')}</button>
        <a href="#loop-details">{t('The details', '细节之美')}</a>
        <a href="#loop-faq">{t('Good to know', '常见问题')}</a>
      </nav>
      <div className="loop-home-header-actions"><LanguageSwitcher/>{onSaved && <button className="loop-collection-button" onClick={onSaved} aria-label={t('Open my collection', '打开我的作品')} title={t('My collection', '我的作品')}><Bookmark size={19}/></button>}</div>
    </header>

    <main>
      <section className="loop-home-hero" aria-labelledby="loop-hero-title">
        <div className="loop-hero-copy">
          <span className="loop-kicker">CUSTOM BAG CHARMS / DESIGNED BY YOU</span>
          <h1 id="loop-hero-title">{t('A little detail.', '一件小配饰。')}<br/><em>{t('All your own.', '一眼，是你。')}</em></h1>
          <p>{t('Turn the bag you take everywhere into something unmistakably yours. Start with a favorite, then make every detail your own.', '让每天随身的包，带上你的个性。从一件喜欢的搭配开始，让颜色、质感与细节慢慢成为你的样子。')}</p>
          <div className="loop-hero-actions"><button className="loop-button" onClick={() => choose(hero)}>{t('Make it yours', '搭配我的第一件')}<ArrowRight size={18}/></button><button className="loop-link" onClick={onStart}><Sparkles size={16}/>{t('Describe your idea', '从一句灵感开始')}</button></div>
          <div className="loop-hero-assurance"><span><Check size={13}/>{t('No signup needed', '无需注册')}</span><span><Check size={13}/>{t('Every detail is editable', '每个细节，都能调整')}</span></div>
          <a className="loop-hero-scroll" href="#loop-collection"><span className="loop-scroll-icon"><ArrowDown size={17}/></span>{t('Find your starting point', '找到喜欢的起点')}</a>
        </div>
        <div className="loop-hero-object">
          <div className="loop-hero-object-top"><span className="loop-kicker">OBJECT STUDY / 01</span><div className="loop-hero-view" role="group" aria-label={t('Preview view', '选择预览视角')}><button className={showBag ? 'active' : ''} aria-pressed={showBag} onClick={() => setShowBag(true)}>{t('On a bag', '整体搭配')}</button><button className={!showBag ? 'active' : ''} aria-pressed={!showBag} onClick={() => setShowBag(false)}>{t('The charm', '挂饰近景')}</button></div></div>
          <ProductPreview config={hero.config} catalog={catalog} bag={showBag} bagStyle="tote" zoom={showBag ? 1.18 : 1.04} interactive className="loop-hero-preview"/>
          <div className="loop-hero-object-bottom"><div><span>{t('THE DAILY EDIT', '日常精选')}</span><strong>{label(hero.name)}<i> / </i>{money(heroQuote.total, heroQuote.currency)}</strong></div><span className="loop-hero-drag"><Move3D size={15}/>{t('Drag to explore', '拖动，看看每一面')}</span></div>
        </div>
      </section>

      <div className="loop-home-values"><span>{t('Your style, in every detail.', '一份搭配，是创作的起点。')}</span><div><span>{t('Curated combinations', '精选搭配')}</span><i/><span>{t('Live 3D preview', '实时 3D 预览')}</span><i/><span>{t('Clear, itemized prices', '清晰价格明细')}</span></div></div>

      <section className="loop-home-collection" id="loop-collection" aria-labelledby="loop-collection-title">
        <div className="loop-section-heading"><div><span className="loop-kicker">THE COLLECTION / THREE WAYS TO BEGIN</span><h2 id="loop-collection-title">{t('Find your kind of charm.', '从一件喜欢的开始。')}</h2></div><p>{t('Three considered combinations.\nA thousand ways to make them yours.', '三组有个性的搭配，\n等待你的下一点灵感。')}</p></div>
        <div className="loop-featured-grid">{featuredDesigns.map((design, index) => {
          const quote = quoteConfig(design.config);
          return <article className={`loop-featured loop-featured-${index + 1}`} key={design.id}>
            <div className="loop-featured-visual"><span className="loop-product-index">0{index + 1} / LOOP OBJECTS</span><ProductPreview config={design.config} catalog={catalog} className="loop-featured-preview"/><button className="loop-featured-hit" onClick={() => choose(design)} aria-label={t(`Customize ${design.name.en}`, `定制${design.name.zh}`)}><span className="loop-featured-open"><ArrowRight size={19}/></span></button></div>
            <div className="loop-featured-heading"><h3>{label(design.name)}</h3><span>{money(quote.total, quote.currency)}</span></div><p>{label(design.description)}</p><button className="loop-link loop-featured-cta" onClick={() => choose(design)}>{t('Start with this design', '以这款开始设计')}<ArrowRight size={16}/></button>
          </article>;
        })}</div>
        <p className="loop-collection-footnote">{t('Sample configuration prices in USD. Your total updates as you customize.', '以上为美元计价的样例搭配。调整配件时，总价随之更新。')}</p>
      </section>

      <section className="loop-home-details" id="loop-details" aria-labelledby="loop-details-title">
        <div className="loop-material-study"><span className="loop-kicker">A CLOSER LOOK</span><img src="/assets/thumbnails/part-banana.png" alt={t('Close-up 3D study of a leather-textured banana charm with stitched edges', '香蕉挂饰的皮革纹理与缝线边缘 3D 近景')} loading="lazy"/><div><span>{t('Texture. Stitch. Character.', '纹理。缝线。个性。')}</span><span>MODEL STUDY / 02</span></div></div>
        <div className="loop-details-copy"><span className="loop-kicker">IT’S ALL IN THE DETAILS</span><h2 id="loop-details-title">{t('Small objects.', '小小的配饰。')}<br/><em>{t('A world of texture.', '细节自有天地。')}</em></h2><p>{t('Stitched edges, warm wood, a soft pearl finish. Different textures bring a different rhythm to the same bag. See how they sit together before you settle on a combination.', '缝线边缘、温润木珠、柔和珠光。不同的质感，让同一只包有了不同的节奏。在决定之前，先看看它们搭在一起的样子。')}</p><div className="loop-materials"><div><img src="/assets/thumbnails/part-wood.png" alt="" loading="lazy"/><span>{t('Warm wood', '温润木色')}<small>{t('Beech bead', '榉木圆珠')}</small></span></div><div><img src="/assets/thumbnails/part-pearl.png" alt="" loading="lazy"/><span>{t('Soft luster', '柔和珠光')}<small>{t('Imitation pearl', '仿珍珠')}</small></span></div><div><img src="/assets/thumbnails/part-pear.png" alt="" loading="lazy"/><span>{t('Stitched texture', '缝线肌理')}<small>{t('Leather study', '皮革表现')}</small></span></div></div><button className="loop-link" onClick={onStudio}>{t('Explore the details in 3D', '在 3D 中，细看每一处')}<ArrowRight size={17}/></button><small className="loop-material-note">{t('Material appearances are 3D visualizations.', '以上为模型材质的 3D 表现。')}</small></div>
      </section>

      <section className="loop-home-process" id="loop-process" aria-labelledby="loop-process-title"><div className="loop-section-heading"><div><span className="loop-kicker">FROM AN IDEA TO YOUR OWN</span><h2 id="loop-process-title">{t('A simple way to create.', '创作，可以很简单。')}</h2></div><button className="loop-link" onClick={onStart}>{t('Let’s begin', '从灵感开始')}<ArrowRight size={17}/></button></div><div className="loop-process-grid">{[
        { number: '01', title: t('Find a starting point', '找到一个起点'), text: t('Choose a design you love, or tell the AI your style, colors and budget. You’ll get a combination you can keep editing.', '选一款喜欢的搭配，或告诉 AI 你的风格、颜色与预算。得到一份可以继续编辑的初稿。') },
        { number: '02', title: t('Make the details yours', '调成你的样子'), text: t('Swap a charm, try a different finish and see it on a bag. Explore every angle, with a price that follows your choices.', '替换挂饰、试试不同配色，再看看挂包效果。每一面都能看清，价格也随选择更新。') },
        { number: '03', title: t('Keep your creation', '把作品留下来'), text: t('Name and save your design to come back to it. Review the itemized details and complete a test order when you’re ready.', '取名并保存，随时回来继续创作。准备好后，查看明细并体验一次完整的测试下单。') },
      ].map(step => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>

      <section className="loop-home-faq" id="loop-faq" aria-labelledby="loop-faq-title"><div><span className="loop-kicker">GOOD TO KNOW</span><h2 id="loop-faq-title">{t('Before you begin.', '开始之前。')}</h2><p>{t('A few things to make\nthe experience feel effortless.', '几件小事，\n让创作更加从容。')}</p></div><div className="loop-faq-list">{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18}/></summary><p>{faq.answer}</p></details>)}</div></section>

      <section className="loop-home-invitation"><div><span className="loop-kicker">YOUR EVERYDAY, WITH A SIGNATURE</span><h2>{t('What will you make yours?', '下一件作品，会是什么样？')}</h2></div><button className="loop-button" onClick={onStudio}>{t('Enter the studio', '走进创作工作室')}<ArrowRight size={18}/></button></section>
    </main>

    <footer className="loop-home-footer"><div className="loop-footer-main"><div className="loop-footer-brand">{logo}<p>{t('Objects for your everyday.\nDetails that feel like you.', '日常随身。\n细节随心。')}</p></div><div className="loop-footer-links"><div><span>{t('Explore', '探索')}</span><a href="#loop-collection">{t('The collection', '精选系列')}</a><a href="#loop-details">{t('The details', '细节之美')}</a><a href="#loop-faq">{t('Good to know', '常见问题')}</a></div><div><span>{t('Create', '创作')}</span><button onClick={onStart}>{t('Find an idea', '寻找灵感')}</button><button onClick={onStudio}>{t('Design studio', '创作工作室')}</button>{onSaved && <button onClick={onSaved}>{t('My collection', '我的作品')}</button>}</div></div><div className="loop-footer-experience"><span>{t('An open design experience', '开放的创作体验')}</span><p>{t('Explore and save without signing up. Test orders record your design; no payment or shipping takes place.', '无需注册，就能探索与保存。测试订单只记录搭配，不会扣款或发货。')}</p></div></div><div className="loop-footer-bottom"><span>© {new Date().getFullYear()} LOOP Studio</span><span>{t('3D previews and sample prices. Made for exploring.', '3D 搭配预览与样例价格，为创作探索而设。')}</span><a href="#loop-top">{t('Back to top', '回到顶部')}<ArrowDown size={13}/></a></div></footer>
  </div>;
}
