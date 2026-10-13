import { useEffect, useMemo } from 'react';
import { createLeatherLeafDetails, createLeatherLeafGeometry } from './leatherGeometry';
import { PebbledLeather } from './materials';

export function LeatherLeaf({ color = '#365327', thread = '#b2a36a' }: { color?: string; thread?: string }) {
  const geometry = useMemo(() => ({ body: createLeatherLeafGeometry(), ...createLeatherLeafDetails() }), []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return <group>
    <mesh userData={{colliderDensity: .2}} geometry={geometry.body} castShadow receiveShadow><PebbledLeather color={color} fine/></mesh>
    <mesh geometry={geometry.veins}><meshStandardMaterial color="#273d1b" roughness={.84}/></mesh>
    <mesh geometry={geometry.leafStitches}><meshStandardMaterial color={thread} roughness={.87}/></mesh>
  </group>;
}
