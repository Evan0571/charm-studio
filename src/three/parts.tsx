import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { Part } from '../../shared/types';
import { Leather, Metal } from './materials';
import Orange from './Orange';
import Banana from './Banana';
import Pear from './Pear';
import Bead from './Bead';
import Cherry from './Cherry';
import Cupcake from './Cupcake';
import { MetalStar, EnamelHeart, EnamelFlower, NacreShell } from './JewelryCharms';

type XYZ = [number, number, number];
function useOwnedGeometry(geometry: THREE.BufferGeometry) { useEffect(() => () => geometry.dispose(), [geometry]); }
export function Tube({ points, radius = .02, color = '#aa9272', metal, leather = false, segments = 36 }: { points: XYZ[]; radius?: number; color?: string; metal?: string; leather?: boolean; segments?: number }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 7, false), [JSON.stringify(points), radius, segments]);
  useOwnedGeometry(geometry);
  return <mesh geometry={geometry} castShadow>{metal ? <Metal tone={metal} /> : leather ? <Leather color={color}/> : <meshStandardMaterial color={color} roughness={.85} />}</mesh>;
}
export function Ring({ radius = .12, thickness = .024, tone = 'gold', ...props }: { radius?: number; thickness?: number; tone?: string; position?: XYZ; rotation?: XYZ }) {
  return <mesh {...props} castShadow><torusGeometry args={[radius, thickness, 10, 48]} /><Metal tone={tone} /></mesh>;
}
export function PartModel({part,tone='gold'}:{part:Part;tone?:string}) {
  if(part.shape==='banana')return <Banana/>;
  if(part.shape==='pear')return <Pear/>;
  if(part.shape==='orange')return <Orange/>;
  if(part.shape==='cupcake')return <Cupcake tone={tone}/>;
  if(part.shape==='star')return <MetalStar tone={tone}/>;
  if(part.shape==='heart')return <EnamelHeart tone={tone}/>;
  if(part.shape==='cherry')return <Cherry/>;
  if(part.shape==='flower')return <EnamelFlower tone={tone}/>;
  if(part.shape==='shell')return <NacreShell tone={tone}/>;
  return <Bead part={part} tone={tone}/>;
}
