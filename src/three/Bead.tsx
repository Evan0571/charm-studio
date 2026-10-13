import { useEffect, useMemo } from 'react';
import type { Part } from '../../shared/types';
import { Metal } from './materials';
import { createBeadBodyGeometry, createBeadCapGeometry } from './beadGeometry';
import { BeadMaterial } from './beadMaterials';

/** Finished jewelry bead, with the same centered body and y=.29 suspension point. */
export default function Bead({ part, tone = 'gold' }: { part: Part; tone?: string }) {
  const glass = part.shape === 'clear' || part.shape === 'amethyst';
  const geometry = useMemo(() => ({ body: createBeadBodyGeometry(part.shape), cap: createBeadCapGeometry() }), [part.shape]);
  useEffect(() => () => Object.values(geometry).forEach(item => item.dispose()), [geometry]);
  return <group>
    <mesh userData={{ colliderDensity: 1 }} geometry={geometry.body} castShadow receiveShadow><BeadMaterial shape={part.shape}/></mesh>
    <mesh geometry={geometry.cap} castShadow><Metal tone={tone} roughness={.27}/></mesh>
    <mesh position={[0, .287, 0]} castShadow><torusGeometry args={[.027, .0065, 10, 40]}/><Metal tone={tone} roughness={.22}/></mesh>
    {!glass && <mesh position={[0, -.004, 0]} castShadow><cylinderGeometry args={[.005, .005, .52, 10]}/><Metal tone={tone} roughness={.27}/></mesh>}
    <mesh position={[0, -.258, 0]} scale={[1, .34, 1]} castShadow><sphereGeometry args={[.026, 24, 12]}/><Metal tone={tone} roughness={.27}/></mesh>
  </group>;
}
