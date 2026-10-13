import { useEffect, useMemo } from 'react';
import { SphereGeometry } from 'three';
import { Metal } from './materials';
import { createJewelryBody, createJewelryInlay, createShellBody, jewelryRimPaths, type JewelryOutline } from './jewelryGeometry';
import { joinGeometry, tubeGeometry } from './leatherGeometry';

function useCasting(kind: JewelryOutline) {
  const geometry = useMemo(() => ({
    body: createJewelryBody(kind), inlay: createJewelryInlay(kind),
    rim: joinGeometry(jewelryRimPaths(kind).map(path => tubeGeometry(path, kind === 'petal' ? .0026 : .0033, true, kind === 'petal' ? 96 : 240))),
  }), [kind]);
  useEffect(() => () => Object.values(geometry).forEach(value => value.dispose()), [geometry]);
  return geometry;
}

export function MetalStar({ tone }: { tone: string }) {
  const geometry = useCasting('star');
  return <group>
    <mesh userData={{ colliderDensity: 1 }} geometry={geometry.body} castShadow receiveShadow><Metal tone={tone} roughness={.21}/></mesh>
    <mesh geometry={geometry.inlay} castShadow receiveShadow><Metal tone={tone} roughness={.38}/></mesh>
    <mesh geometry={geometry.rim} castShadow><Metal tone={tone} roughness={.18}/></mesh>
  </group>;
}

export function EnamelHeart({ tone }: { tone: string }) {
  const geometry = useCasting('heart');
  return <group>
    <mesh userData={{ colliderDensity: 1 }} geometry={geometry.body} castShadow receiveShadow><Metal tone={tone} roughness={.24}/></mesh>
    <mesh geometry={geometry.inlay} castShadow receiveShadow><meshPhysicalMaterial color="#cd8a94" metalness={0} roughness={.24} clearcoat={.92} clearcoatRoughness={.13} ior={1.48} envMapIntensity={.9}/></mesh>
    <mesh geometry={geometry.rim} castShadow><Metal tone={tone} roughness={.19}/></mesh>
  </group>;
}

export function EnamelFlower({ tone }: { tone: string }) {
  const geometry = useCasting('petal');
  const center = useMemo(() => {
    const body = new SphereGeometry(1, 64, 40), position = body.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const hammer = 1 + .010 * Math.sin(x * 42 + Math.sin(y * 19)) * Math.sin(y * 38 + z * 7) * Math.abs(z);
      position.setXYZ(i, x * .101 * hammer, y * .101 * hammer, z * .078 * hammer);
    }
    body.computeVertexNormals(); return body;
  }, []);
  useEffect(() => () => center.dispose(), [center]);
  return <group>
    {Array.from({ length: 6 }, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 3]}>
      <group position={[0, .203, 0]}>
        <mesh userData={{ colliderDensity: .75 }} geometry={geometry.body} castShadow receiveShadow><Metal tone={tone} roughness={.26}/></mesh>
        <mesh geometry={geometry.inlay} castShadow receiveShadow><meshPhysicalMaterial color="#eee5d4" roughness={.28} metalness={0} clearcoat={.82} clearcoatRoughness={.18} ior={1.46}/></mesh>
        <mesh geometry={geometry.rim} castShadow><Metal tone={tone} roughness={.23}/></mesh>
      </group>
    </group>)}
    <mesh userData={{ colliderDensity: 1 }} geometry={center} castShadow receiveShadow><Metal tone={tone} roughness={.37}/></mesh>
  </group>;
}

export function NacreShell({ tone }: { tone: string }) {
  const geometry = useMemo(createShellBody, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group>
    <mesh userData={{ colliderDensity: .85 }} geometry={geometry} castShadow receiveShadow><meshPhysicalMaterial color="#ffffff" vertexColors metalness={.05} roughness={.3} clearcoat={.72} clearcoatRoughness={.22} iridescence={.32} iridescenceIOR={1.31} iridescenceThicknessRange={[190, 340]} envMapIntensity={.85}/></mesh>
    <mesh position={[0, .304, 0]} scale={[.058, .034, .024]} castShadow receiveShadow><sphereGeometry args={[1, 32, 20]}/><Metal tone={tone} roughness={.26}/></mesh>
    <mesh position={[0, .362, 0]} castShadow><torusGeometry args={[.031, .007, 12, 48]}/><Metal tone={tone} roughness={.23}/></mesh>
  </group>;
}
