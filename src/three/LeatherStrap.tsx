import { useEffect, useMemo } from 'react';
import { createLeatherBandGeometry, leatherBandEdgePaths, leatherBandStitchPaths } from './connectorGeometry';
import { Leather, Metal } from './materials';
import { joinGeometry, tubeGeometry } from './leatherGeometry';

/** Saddle stitches sit just above the existing folded strap's outer faces. */
export function LeatherStrap({ tone }: { tone: string }) {
  const geometry = useMemo(() => {
    const stitches = leatherBandStitchPaths().map(points => tubeGeometry(points, .0018));
    const edges = leatherBandEdgePaths().map(points => tubeGeometry(points, .0018));
    return { band: createLeatherBandGeometry(), stitches: joinGeometry(stitches), edges: joinGeometry(edges) };
  }, []);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return <group>
    <mesh geometry={geometry.band} castShadow receiveShadow><Leather color="#985c2e"/></mesh>
    <mesh geometry={geometry.edges}><meshStandardMaterial color="#643e24" roughness={.7}/></mesh>
    <mesh geometry={geometry.stitches} castShadow><meshStandardMaterial color="#ebd3a5" roughness={.82}/></mesh>
    <mesh position={[0, 1.30, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.02, .02, .165, 32]}/><Metal tone={tone} roughness={.18}/></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[0, 1.30, side * .085]} scale={[1, 1, .3]} castShadow><sphereGeometry args={[.021, 24, 12]}/><Metal tone={tone} roughness={.16}/></mesh>)}
    <mesh position={[0, 1.08, 0]} castShadow><torusGeometry args={[.095, .019, 16, 64]}/><Metal tone={tone} roughness={.18}/></mesh>
  </group>;
}
