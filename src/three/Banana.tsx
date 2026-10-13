import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { PebbledLeather } from './materials';
import { LeatherLeaf } from './LeatherLeaf';
import { createSaddleDetails, joinGeometry, tubeGeometry } from './leatherGeometry';
import { bananaStitchPaths, bananaSurface, createBananaBodyGeometry } from './bananaGeometry';
import { BANANA_POSE, FRUIT_LEAF_POSES } from './fruitAssembly';

export default function Banana() {
  const geometry = useMemo(() => ({
    body: createBananaBodyGeometry(), ...createSaddleDetails(bananaStitchPaths(), .0013),
    edges: joinGeometry([0, Math.PI].map(angle => tubeGeometry(Array.from({ length: 100 }, (_, i) => bananaSurface(i / 99, angle)), .0025))),
    stem: tubeGeometry([new Vector3(-.409,.329,0),new Vector3(-.416,.355,0),new Vector3(-.424,.386,0)], .021, false, 18),
  }), []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  const tip = bananaSurface(1, Math.PI / 2);
  return <group {...BANANA_POSE}>
    <mesh userData={{colliderDensity: 1}} geometry={geometry.body} castShadow receiveShadow><PebbledLeather color="#dcb329" grain={1.55} relief={.30} roughness={.8}/></mesh>
    <mesh geometry={geometry.edges} castShadow><meshStandardMaterial color="#a98728" roughness={.76}/></mesh>
    <mesh geometry={geometry.holes}><meshStandardMaterial color="#897127" roughness={.95}/></mesh>
    <mesh geometry={geometry.stitches} castShadow><meshStandardMaterial color="#eee0a4" roughness={.86}/></mesh>
    <mesh userData={{colliderDensity: .45}} geometry={geometry.stem} castShadow><PebbledLeather color="#756037" fine/></mesh>
    <mesh position={[-.424,.386,0]} scale={[1,.3,1]}><sphereGeometry args={[.021,16,8]}/><meshStandardMaterial color="#59402b" roughness={.86}/></mesh>
    <mesh position={[tip.x,tip.y,0]} scale={[1,.65,.65]} castShadow><sphereGeometry args={[.0135,16,8]}/><meshStandardMaterial color="#70522e" roughness={.84}/></mesh>
    <group {...FRUIT_LEAF_POSES.banana}><LeatherLeaf color="#546d34" thread="#b7b67d"/></group>
  </group>;
}
