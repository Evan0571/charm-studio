import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { PebbledLeather } from './materials';
import { createOrangeBodyGeometry, createOrangeNeedleHoles, createOrangeStitches, orangeSurface } from './orangeGeometry';
import { tubeGeometry } from './leatherGeometry';
import { LeatherLeaf } from './LeatherLeaf';
import { FRUIT_LEAF_POSES } from './fruitAssembly';

export default function Orange() {
  const geometry = useMemo(() => ({
    body: createOrangeBodyGeometry(), stitches: createOrangeStitches(), holes: createOrangeNeedleHoles(),
    edge: tubeGeometry(Array.from({ length: 128 }, (_, i) => orangeSurface(1, i / 128 * Math.PI * 2)), .003, true),
    stem: tubeGeometry([new Vector3(0, .342, 0), new Vector3(-.005, .399, .005), new Vector3(.01, .458, .005)], .019, false, 24),
  }), []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return <group>
    <mesh userData={{colliderDensity: 1}} geometry={geometry.body} castShadow receiveShadow><PebbledLeather color="#df7c16"/></mesh>
    <mesh geometry={geometry.edge} castShadow><meshStandardMaterial color="#ad5a16" roughness={.62}/></mesh>
    <mesh geometry={geometry.holes}><meshStandardMaterial color="#8d4c19" roughness={.95}/></mesh>
    <mesh geometry={geometry.stitches} castShadow><meshStandardMaterial color="#f4c477" roughness={.83}/></mesh>
    <mesh userData={{colliderDensity: .45}} geometry={geometry.stem} castShadow receiveShadow><PebbledLeather color="#714323" fine/></mesh>
    <group {...FRUIT_LEAF_POSES.orange}>
      <LeatherLeaf/>
    </group>
  </group>;
}
