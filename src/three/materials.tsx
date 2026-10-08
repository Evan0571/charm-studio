import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import { RepeatWrapping, SRGBColorSpace, Vector2 } from 'three';

export const gold = '#d6b56b';
export const silver = '#c5cbd1';
export function Metal({ tone = 'gold', roughness = .23 }: { tone?: string; roughness?: number }) {
  return <meshStandardMaterial color={tone === 'gold' ? gold : silver} metalness={1} roughness={roughness} envMapIntensity={1.1} />;
}
export function Leather({ color = '#926744', brown = false }: { color?: string; brown?: boolean }) {
  const source = useTexture(['/assets/materials/brown-leather-color.jpg', '/assets/materials/brown-leather-normal.jpg', '/assets/materials/brown-leather-roughness.jpg']);
  const maps = useMemo(() => source.map((texture, i) => { const t = texture; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(2.2, 2.2); if (i === 0) t.colorSpace = SRGBColorSpace; t.needsUpdate = true; return t; }), [source]);
  return <meshStandardMaterial color={brown ? '#dfcbbb' : color} map={brown ? maps[0] : undefined} normalMap={maps[1]} normalScale={new Vector2(.32, .32)} roughnessMap={maps[2]} roughness={.84} metalness={.02} envMapIntensity={.65} />;
}
