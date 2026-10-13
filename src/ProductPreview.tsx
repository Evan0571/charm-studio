import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Catalog, DesignConfig } from '../shared/types';
import { useLanguage } from './Language';
import { featuredDesigns } from './featuredDesigns';
import { visualKey } from './workspaceDraft';
import type { BagStyle } from './three/bagAttachment';
import './product-preview.css';

const Scene = lazy(() => import('./CharmScene'));
const snapshots = new Map<string, string>();
const MAX_CACHED_PREVIEWS = 48;

// Product cards take turns rendering, then immediately become stills. A full
// collection therefore never leaves a row of continuously running 3D canvases.
type RenderTicket = { start: () => void; cancelled: boolean };
const pendingRenders: RenderTicket[] = [];
let activeRender: RenderTicket | null = null;
function startNextRender() {
  if (activeRender) return;
  let next = pendingRenders.shift();
  while (next?.cancelled) next = pendingRenders.shift();
  if (next) { activeRender = next; next.start(); }
}
function reserveRenderer(start: () => void) {
  const ticket: RenderTicket = { start, cancelled: false };
  pendingRenders.push(ticket);
  startNextRender();
  return () => {
    ticket.cancelled = true;
    if (activeRender === ticket) { activeRender = null; startNextRender(); }
  };
}
function cacheSnapshot(key: string, url: string) {
  snapshots.delete(key);
  snapshots.set(key, url);
  if (snapshots.size > MAX_CACHED_PREVIEWS) snapshots.delete(snapshots.keys().next().value!);
}

class PreviewBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export interface ProductPreviewProps {
  config: DesignConfig;
  catalog: Catalog;
  snapshot?: string;
  bag?: boolean;
  bagStyle?: BagStyle;
  interactive?: boolean;
  zoom?: number;
  className?: string;
  alt?: string;
  onCapture?: (url: string) => void;
}

export default function ProductPreview({ config, catalog, snapshot, bag = false, bagStyle = 'tote', interactive = false, zoom = 1, className = '', alt, onCapture }: ProductPreviewProps) {
  const { language } = useLanguage();
  const en = language === 'en';
  const key = JSON.stringify([config.templateId, config.connectorId, config.cordColor, config.metalTone, config.slots, bag, bagStyle, zoom]);
  const root = useRef<HTMLDivElement>(null);
  const callback = useRef(onCapture);
  callback.current = onCapture;
  const [visible, setVisible] = useState(false);
  const [captured, setCaptured] = useState<{ key: string; url: string } | null>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const release = useRef<(() => void) | null>(null);
  const sceneState = useRef({ visible, active });
  sceneState.current = { visible, active };
  const featuredImage = !bag && zoom === 1 ? featuredDesigns.find(item => visualKey(item.config) === visualKey(config))?.image : undefined;
  const image = snapshot || (captured?.key === key ? captured.url : snapshots.get(key)) || featuredImage;
  const staticImage = interactive ? undefined : image;
  const fallback = `/assets/thumbnails/template-${config.templateId}.png`;
  const imageAlt = alt || (en ? 'Your finished bag charm design' : '你的包挂搭配成品');

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setReady(false);
    setFailure(null);
    setActive(false);
  }, [key, attempt]);

  useEffect(() => { if (!visible) setReady(false); }, [visible]);

  const fail = useCallback(() => {
    if (!sceneState.current.visible || !sceneState.current.active) return;
    setFailure(en ? '3D preview unavailable' : '3D 预览暂时不可用');
    setActive(false);
    release.current?.();
    release.current = null;
  }, [en]);

  useEffect(() => {
    if (!visible || failure || staticImage) return;
    if (interactive) {
      setActive(true);
      return () => setActive(false);
    }
    const done = reserveRenderer(() => setActive(true));
    release.current = done;
    return () => { done(); if (release.current === done) release.current = null; setActive(false); };
  }, [key, visible, interactive, staticImage, failure, attempt]);

  useEffect(() => {
    if (!active || (!interactive && image) || (interactive && ready)) return;
    const timer = window.setTimeout(fail, 18000);
    return () => window.clearTimeout(timer);
  }, [active, interactive, image, fail, ready]);

  const capture = useCallback((url: string) => {
    cacheSnapshot(key, url);
    setCaptured({ key, url });
    callback.current?.(url);
    if (!interactive) { setActive(false); release.current?.(); release.current = null; }
  }, [key, interactive]);

  return <div ref={root} className={`product-preview${interactive ? ' is-interactive' : ''}${image && !interactive ? ' has-still' : ''} ${className}`}>
    {(image && !interactive) ? <img className="product-preview-image" src={image} alt={imageAlt} /> : <>
      <img className={`product-preview-reference${ready && active ? ' is-hidden' : ''}`} src={image || fallback} alt={image ? imageAlt : en ? 'Template reference while the design preview loads' : '搭配加载期间的基础样式参考'} />
      {active && <div className={`product-preview-scene${ready ? ' is-ready' : ''}`}>
        <PreviewBoundary key={`${key}-${attempt}`} onError={fail}><Suspense fallback={null}>
          <Scene config={config} catalog={catalog} bag={bag} bagStyle={bagStyle} zoom={zoom} motion={false} showMarkers={false} onReady={() => setReady(true)} onError={fail} onCapture={capture} />
        </Suspense></PreviewBoundary>
      </div>}
      {failure ? <div className="product-preview-status is-error" role="status">
        <span>{failure}<small>{en ? 'Showing a template reference' : '当前显示基础样式参考'}</small></span>
        <button type="button" aria-label={en ? 'Retry the 3D preview' : '重新加载 3D 预览'} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={13} /><span>{en ? 'Retry' : '重试'}</span></button>
      </div> : !ready && !image && <div className="product-preview-status" role="status"><span className="product-preview-loading-dot" /><span>{visible ? (en ? 'Preparing your design' : '正在呈现你的搭配') : (en ? 'Design preview' : '搭配预览')}</span></div>}
    </>}
  </div>;
}
