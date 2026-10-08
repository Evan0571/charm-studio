import { Color, MeshStandardMaterial } from 'three';

export function miniBagPalette(color?: string) {
  if (!color) return { body: '#b7a793', flap: '#c3b39f', handle: '#b3a18a', thread: '#96836e', keeperThread: '#ded2bf' };
  const base = new Color(color);
  return { body: color, flap: color, handle: color, thread: `#${base.clone().multiplyScalar(.68).getHexString()}`, keeperThread: `#${base.clone().lerp(new Color('#eee5d6'), .35).getHexString()}` };
}

/** Clone before tinting: GLTF materials and maps belong to the shared loader cache. */
export function cloneBagMaterial(source: MeshStandardMaterial, color?: string) {
  const material = source.clone();
  material.envMapIntensity = .85;
  if (!color) return material;
  const name = source.name.toLowerCase();
  const base = new Color(color);
  if (name.includes('stitch')) material.color.copy(base).lerp(new Color('#eee5d6'), .28);
  else if (name.includes('edge')) material.color.copy(base).multiplyScalar(.5);
  else if (name.includes('leather')) {
    material.color.copy(base);
    // The tote albedo is brown. Keep its scanned normal/roughness, but do not
    // multiply a chosen white/green/etc. by the original brown pigment.
    material.map = null;
  }
  return material;
}
