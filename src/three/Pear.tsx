import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { PebbledLeather } from './materials';
import { LeatherLeaf } from './LeatherLeaf';
import { createSaddleDetails, tubeGeometry } from './leatherGeometry';
import { createPearBodyGeometry, pearStitchPaths, pearSurface } from './pearGeometry';
import { FRUIT_LEAF_POSES } from './fruitAssembly';

export default function Pear() {
  const geometry = useMemo(() => ({
    body: createPearBodyGeometry(), ...createSaddleDetails(pearStitchPaths()),
    edge: tubeGeometry(Array.from({ length: 128 }, (_, i) => pearSurface(1, i / 128 * Math.PI * 2)), .0028, true),
    stem: tubeGeometry([new Vector3(0, .405, 0), new Vector3(.005, .46, .003), new Vector3(.03, .505, .005)], .022, false, 24),
  }), []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return <group>
    <mesh userData={{colliderDensity: 1}} geometry={geometry.body} castShadow receiveShadow><PebbledLeather color="#8b9f45" grain={1.1} relief={.48} roughness={.79}/></mesh>
    <mesh geometry={geometry.edge} castShadow><meshStandardMaterial color="#667631" roughness={.76}/></mesh>
    <mesh geometry={geometry.holes}><meshStandardMaterial color="#4e602b" roughness={.95}/></mesh>
    <mesh geometry={geometry.stitches} castShadow><meshStandardMaterial color="#d6d09a" roughness={.86}/></mesh>
    <mesh userData={{colliderDensity: .45}} geometry={geometry.stem} castShadow receiveShadow><PebbledLeather color="#6c4429" fine/></mesh>
    <mesh position={[.03,.505,.005]} scale={[1,.3,1]}><sphereGeometry args={[.022,16,8]}/><meshStandardMaterial color="#583c25" roughness={.85}/></mesh>
    <group {...FRUIT_LEAF_POSES.pear}><LeatherLeaf color="#3e582e" thread="#a3ab72"/></group>
  </group>;
}
