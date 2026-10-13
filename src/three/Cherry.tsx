import { useEffect, useMemo } from 'react';
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
import { PebbledLeather } from './materials';
import { LeatherLeaf } from './LeatherLeaf';
import { createSaddleDetails, joinGeometry, tubeGeometry } from './leatherGeometry';
import { CHERRY_FRUITS, CHERRY_LEAF_POSE, cherryStitchPaths, cherrySurface, createCherryBodyGeometry } from './cherryGeometry';

export default function Cherry() {
  const geometry = useMemo(() => {
    const stems = CHERRY_FRUITS.map(({ position: [x, y, z], scale }) => new CatmullRomCurve3([
      new Vector3(0, .38, 0), new Vector3(x * .5, .237, z * .35), new Vector3(x * .91, .098, z * .75), new Vector3(x, y + .173 * scale, z),
    ]));
    return {
    body: createCherryBodyGeometry(), ...createSaddleDetails(cherryStitchPaths(), .0012),
    edge: tubeGeometry(Array.from({ length: 112 }, (_, i) => cherrySurface(1, i / 112 * Math.PI * 2)), .0021, true),
    leftStem: new TubeGeometry(stems[0], 44, .014, 10, false),
    rightStem: new TubeGeometry(stems[1], 44, .014, 10, false),
    stemSeams: joinGeometry(stems.map(curve => tubeGeometry(Array.from({ length: 40 }, (_, i) => curve.getPoint(.04 + i / 39 * .94).add(new Vector3(0, 0, .0135))), .0011, false, 44))),
  }; }, []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return <group>
    {CHERRY_FRUITS.map(({ position, scale }, index) => <group key={index} position={position} scale={scale}>
      <mesh userData={{ colliderDensity: 1 }} geometry={geometry.body} castShadow receiveShadow><PebbledLeather color={index ? '#9a2940' : '#a82b43'} grain={1.45} relief={.43} roughness={.64}/></mesh>
      <mesh geometry={geometry.edge} castShadow><meshStandardMaterial color="#622432" roughness={.66}/></mesh>
      <mesh geometry={geometry.holes}><meshStandardMaterial color="#541c29" roughness={.96}/></mesh>
      <mesh geometry={geometry.stitches} castShadow><meshStandardMaterial color="#cd7580" roughness={.84}/></mesh>
    </group>)}
    {[geometry.leftStem, geometry.rightStem].map((stem, index) => <mesh key={index} userData={{ colliderDensity: .3 }} geometry={stem} castShadow receiveShadow><PebbledLeather color="#58613a" fine roughness={.79}/></mesh>)}
    <mesh position={[0, .38, 0]} castShadow><sphereGeometry args={[.014, 16, 12]}/><PebbledLeather color="#58613a" fine roughness={.79}/></mesh>
    <mesh geometry={geometry.stemSeams}><meshStandardMaterial color="#3e4b29" roughness={.86}/></mesh>
    <group {...CHERRY_LEAF_POSE}><LeatherLeaf color="#365630" thread="#97a16a"/></group>
  </group>;
}
