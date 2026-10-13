import { Cache, DefaultLoadingManager } from 'three';
import { PREVIEW_ASSETS, type PreviewAssetPath } from '../../shared/previewAssets';

declare global { interface Window { __LOOP_INLINE_ASSETS__?: boolean } }
const key = (path: string) => 'loop-inline:' + path;
const pending = new Map<string, Promise<void>>();
type Asset = {mime:string;base64:string};

export async function prepareInlineAssets(readAsset: (path: PreviewAssetPath) => Promise<Asset>) {
  Cache.enabled = true;
  window.__LOOP_INLINE_ASSETS__ = true;
  DefaultLoadingManager.setURLModifier(url => {
    if (!url.startsWith('/assets/')) return url;
    const path = url.split('?')[0];
    if (!(path in PREVIEW_ASSETS)) throw new Error('Missing bundled 3D asset: ' + path);
    return key(path);
  });
  await Promise.all((Object.keys(PREVIEW_ASSETS) as PreviewAssetPath[]).map(path => {
    const mime=PREVIEW_ASSETS[path], cacheKey=(mime.startsWith('image/')?'image:':'file:')+key(path);
    if (Cache.get(cacheKey)) return Promise.resolve();
    if (pending.has(path)) return pending.get(path);
    const loading=(async()=>{
      const asset=await readAsset(path);
      if (asset.mime!==mime || typeof asset.base64!=='string') throw new Error('Invalid preview asset: '+path);
      if(mime.startsWith('image/')) {
        const image=new Image();
        await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not decode preview texture: '+path));image.src='data:'+mime+';base64,'+asset.base64;});
        Cache.add(cacheKey,image);
      } else {
        const bytes=Uint8Array.from(atob(asset.base64),char=>char.charCodeAt(0));
        Cache.add(cacheKey,bytes.buffer);
      }
    })().finally(()=>pending.delete(path));
    pending.set(path,loading);
    return loading;
  }));
}
