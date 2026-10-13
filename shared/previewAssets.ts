// Only these public product assets may be read by the conversation renderer.
export const PREVIEW_ASSETS = {
  '/assets/environment/studio-small-09-1k.hdr': 'application/octet-stream',
  '/assets/materials/brown-leather-color.jpg': 'image/jpeg',
  '/assets/materials/brown-leather-normal.jpg': 'image/jpeg',
  '/assets/materials/brown-leather-roughness.jpg': 'image/jpeg',
  '/assets/materials/pebbled-leather-color.webp': 'image/webp',
  '/assets/materials/pebbled-leather-normal.webp': 'image/webp',
  '/assets/materials/pebbled-leather-roughness.webp': 'image/webp',
  '/assets/models/atelier-tote.glb': 'model/gltf-binary',
  '/assets/models/atelier-shoulder.glb': 'model/gltf-binary',
} as const;
export type PreviewAssetPath = keyof typeof PREVIEW_ASSETS;

export const CHARM_PREVIEW_ASSETS: PreviewAssetPath[] = [
  '/assets/environment/studio-small-09-1k.hdr',
  '/assets/materials/brown-leather-color.jpg',
  '/assets/materials/brown-leather-normal.jpg',
  '/assets/materials/brown-leather-roughness.jpg',
  '/assets/materials/pebbled-leather-color.webp',
  '/assets/materials/pebbled-leather-normal.webp',
  '/assets/materials/pebbled-leather-roughness.webp',
];
export const TOTE_PREVIEW_ASSETS: PreviewAssetPath[] = [...CHARM_PREVIEW_ASSETS, '/assets/models/atelier-tote.glb'];
