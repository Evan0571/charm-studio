import { Cache, DefaultLoadingManager } from 'three';
import assets from './inlineAssets.generated';

declare global { interface Window { __LOOP_INLINE_ASSETS__?: boolean } }
const key = (path: string) => `loop-inline:${path}`;

export async function prepareInlineAssets() {
  Cache.enabled = true;
  window.__LOOP_INLINE_ASSETS__ = true;
  DefaultLoadingManager.setURLModifier(url => {
    if (!url.startsWith('/assets/')) return url;
    const path = url.split('?')[0];
    if (!(path in assets)) throw new Error(`Missing bundled 3D asset: ${path}`);
    return key(path);
  });
  await Promise.all(Object.entries(assets).map(async ([path, asset]) => {
    if (asset.mime.startsWith('image/')) {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve(); image.onerror = () => reject(new Error(`Could not decode bundled texture: ${path}`));
        image.src = `data:${asset.mime};base64,${asset.base64}`;
      });
      Cache.add(`image:${key(path)}`, image);
    } else {
      const bytes = Uint8Array.from(atob(asset.base64), char => char.charCodeAt(0));
      Cache.add(`file:${key(path)}`, bytes.buffer);
    }
  }));
}
