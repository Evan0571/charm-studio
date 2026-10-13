import { useLanguage, LanguageSwitcher } from './Language';
import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { localizeCatalog } from '../shared/localization';
import { catalog as rawCatalog, createDefaultConfig } from '../shared/catalog';
import { PartModel } from './three/parts';
import CharmScene from './CharmScene';
import { ProductLighting } from './three/ProductLighting';

// Asset authoring tool: catalog images are rendered from the very same meshes
// and material maps used in the interactive configurator.
function Capture({ id, onCapture }: { id: string; onCapture: (id: string, url: string) => void }) {
  const { gl, scene, camera } = useThree();
  const captured = useRef('');
  const frames = useRef(0);
  const previous = useRef(id);
  useFrame(() => {
    if (previous.current !== id) { previous.current = id; frames.current = 0; }
    if (captured.current === id || ++frames.current < 8) return;
    gl.render(scene, camera);
    captured.current = id;
    onCapture(id, gl.domElement.toDataURL('image/png'));
  });
  return null;
}

export default function AssetStudio() {
 const { tr, language } = useLanguage();
  const catalog = localizeCatalog(rawCatalog, language);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const part = catalog.parts[templates ? 0 : index];
  const template = catalog.templates[templates ? index : 0];
  const done = Object.keys(images).length === catalog.parts.length + catalog.templates.length;
  function capture(id: string, url: string) {
    setImages(old => ({ ...old, [`part-${id}`]: url }));
    if (index < catalog.parts.length - 1) setIndex(index + 1);
    else { setIndex(0); setTemplates(true); }
  }
  function captureTemplate(url: string) {
    if (!running) return;
    const id = template.id;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      setImages(old => ({ ...old, [`template-${id}`]: canvas.toDataURL('image/png') }));
      if (index < catalog.templates.length - 1) setIndex(index + 1);
      else setRunning(false);
    };
    img.src = url;
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(images)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'loop-3d-thumbnails.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return <main style={{ fontFamily: 'system-ui', maxWidth: 880, margin: '48px auto', color: '#222' }}>
    <LanguageSwitcher/><h1>{tr("LOOP · 3D 素材工作台")}</h1>
    <p>{tr("使用互动预览中的相同模型、材质和棚拍光照，输出目录缩略图。")}</p>
    <div style={{ width: 320, height: 320, borderRadius: 24, overflow: 'hidden', background: '#f8f5ef' }}>
      {templates ? <CharmScene config={createDefaultConfig(template.id)} catalog={catalog} bag={false} bagStyle="tote" motion={false} onCapture={captureTemplate} /> : <Canvas dpr={2} shadows camera={{ position: [0.9, 0.5, 3.25], fov: 25 }} gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#f8f5ef']} />
        <Suspense fallback={null}>
          <ProductLighting/>
          <group position={[0, -.01, 0]} rotation={[0, -.18, 0]}><PartModel part={part} /></group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.53, 0]} receiveShadow><planeGeometry args={[200, 200]} /><shadowMaterial color="#776756" opacity={.13} /></mesh>
          {running && <Capture id={part.id} onCapture={capture} />}
        </Suspense>
      </Canvas>}
    </div>
    <p role="status">{running ? tr("正在渲染：{0}", templates ? template.name : part.name) : done ? tr("17 张 3D 缩略图已完成") : tr("等待开始")}</p>
    <button onClick={() => { setImages({}); setTemplates(false); setIndex(0); setRunning(true); }} disabled={running}>{tr("渲染全部缩略图")}</button>
    <button onClick={download} disabled={!done} style={{ marginLeft: 12 }}>{tr("下载缩略图数据")}</button>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>{[...catalog.parts.map(p => ({...p, key: `part-${p.id}`})), ...catalog.templates.map(t => ({...t, key: `template-${t.id}`}))].map(p => images[p.key] && <figure key={p.key} style={{ margin: 0 }}><img src={images[p.key]} alt={p.name} width={128} height={128} /><figcaption>{p.name}</figcaption></figure>)}</div>
    <p><a href="/">{tr("返回工作室")}</a></p>
  </main>;
}
