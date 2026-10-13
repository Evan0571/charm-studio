import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { Metal, PebbledLeather } from './materials';
import { joinGeometry, tubeGeometry } from './leatherGeometry';
import { createCherryBodyGeometry, cherrySurface } from './cherryGeometry';
import { createCupcakeFrostingGeometry, createCupcakeStitchDetails, createCupcakeWrapperGeometry, cupcakeFrostingNormal, cupcakeFrostingNormalAtPoint, cupcakeFrostingSeam, cupcakeFrostingStitchPaths, cupcakeFrostingSurface, cupcakeWrapperStitchPaths, cupcakeWrapperSurface } from './cupcakeGeometry';

export default function Cupcake({ tone }: { tone: string }) {
  const geometry = useMemo(() => {
    const wrapperDetails = createCupcakeStitchDetails(cupcakeWrapperStitchPaths(), point => new Vector3(point.x, -.204 * Math.hypot(point.x, point.z), point.z).normalize());
    const frostingDetails = createCupcakeStitchDetails(cupcakeFrostingStitchPaths(), cupcakeFrostingNormalAtPoint);
    const sprinkles = Array.from({ length: 11 }, (_, index) => {
      const t = .13 + (index % 4) * .145, angle = .34 + index * 2.39;
      return tubeGeometry(Array.from({ length: 7 }, (_, step) => {
        const u = t + (step / 6 - .5) * .049, a = angle + (step / 6 - .5) * .065 * (index % 2 ? 1 : -1);
        return cupcakeFrostingSurface(u, a).addScaledVector(cupcakeFrostingNormal(u, a), .0035);
      }), .0048, false, 10);
    });
    return {
      wrapper: createCupcakeWrapperGeometry(), frosting: createCupcakeFrostingGeometry(),
      wrapperStitches: wrapperDetails.stitches, wrapperHoles: wrapperDetails.holes,
      frostingStitches: frostingDetails.stitches, frostingHoles: frostingDetails.holes,
      rims: joinGeometry([-.328, -.054].map(y => tubeGeometry(Array.from({ length: 128 }, (_, i) => cupcakeWrapperSurface(y, i / 128 * Math.PI * 2)), .0017, true))),
      panelSeam: tubeGeometry(Array.from({ length: 400 }, (_, i) => cupcakeFrostingSeam(i / 399).point), .00165, false, 480),
      ivorySprinkles: joinGeometry(sprinkles.filter((_, index) => index % 2 === 0)),
      goldSprinkles: joinGeometry(sprinkles.filter((_, index) => index % 2 === 1)),
      cherry: createCherryBodyGeometry().scale(.32, .32, .32),
      cherryEdge: tubeGeometry(Array.from({ length: 64 }, (_, i) => cherrySurface(1, i / 64 * Math.PI * 2).multiplyScalar(.32)), .0011, true),
    };
  }, []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return <group>
    <mesh userData={{ colliderDensity: 1 }} geometry={geometry.wrapper} castShadow receiveShadow><PebbledLeather color="#b88152" grain={1.25} relief={.36} roughness={.77}/></mesh>
    <mesh geometry={geometry.rims}><meshStandardMaterial color="#92603b" roughness={.73}/></mesh>
    <mesh geometry={geometry.wrapperHoles}><meshStandardMaterial color="#6e4930" roughness={.95}/></mesh>
    <mesh geometry={geometry.wrapperStitches} castShadow><meshStandardMaterial color="#e6c593" roughness={.87}/></mesh>
    <mesh userData={{ colliderDensity: .8 }} geometry={geometry.frosting} castShadow receiveShadow><PebbledLeather color="#c78397" grain={1.2} relief={.3} roughness={.74}/></mesh>
    <mesh geometry={geometry.panelSeam}><meshStandardMaterial color="#99596f" roughness={.78}/></mesh>
    <mesh geometry={geometry.frostingHoles}><meshStandardMaterial color="#83465e" roughness={.94}/></mesh>
    <mesh geometry={geometry.frostingStitches} castShadow><meshStandardMaterial color="#e6b2bc" roughness={.86}/></mesh>
    <mesh geometry={geometry.ivorySprinkles} castShadow><meshStandardMaterial color="#f0dfc7" roughness={.77}/></mesh>
    <mesh geometry={geometry.goldSprinkles} castShadow><meshStandardMaterial color="#d8b370" roughness={.79}/></mesh>
    <group position={[.012, .389, 0]}>
      <mesh userData={{ colliderDensity: .8 }} geometry={geometry.cherry} castShadow receiveShadow><PebbledLeather color="#99263b" fine relief={.22} roughness={.62}/></mesh>
      <mesh geometry={geometry.cherryEdge}><meshStandardMaterial color="#6e2030" roughness={.68}/></mesh>
    </group>
    <mesh position={[0, .48, 0]} castShadow><torusGeometry args={[.044, .0085, 12, 56]}/><Metal tone={tone}/></mesh>
    <mesh position={[.008, .432, .008]} castShadow><sphereGeometry args={[.012, 16, 12]}/><Metal tone={tone} roughness={.24}/></mesh>
  </group>;
}
