import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { Part } from '../../shared/types';
import { Leather, Metal } from './materials';

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
function SewnEdge({ points, color = '#d8b874', radius = .003 }: { points: XYZ[]; color?: string; radius?: number }) {
  const paths = useMemo(() => { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), true); const length = curve.getLength(); const count = Math.ceil(length / .046); return Array.from({ length: count }, (_, i) => [curve.getPointAt(i / count), curve.getPointAt((i + .5) / count)]); }, [JSON.stringify(points)]);
  const geometry = useMemo(() => { const positions: number[] = []; for (const [a, b] of paths) positions.push(a.x, a.y, a.z, b.x, b.y, b.z); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); return g; }, [paths]);
  useOwnedGeometry(geometry);
  return <lineSegments geometry={geometry}><lineBasicMaterial color={color} linewidth={radius} /></lineSegments>;
}
function Banana() {
  // Swept, flattened leather volume. The depth closes continuously at the two ends.
  const geometry = useMemo(() => {
    const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [];
    const a = 48, b = 28;
    for (let i = 0; i <= a; i++) {
      const t = i / a, angle = -.32 + t * 1.82, center = new THREE.Vector3(.11 + Math.sin(angle) * .58, .38 - (1 - Math.cos(angle)) * .84, 0);
      const tangent = new THREE.Vector3(Math.cos(angle) * .58, -Math.sin(angle) * .84, 0).normalize();
      const side = new THREE.Vector3(-tangent.y, tangent.x, 0); const width = .014 + Math.pow(Math.sin(Math.PI * t), .65) * .135;
      for (let j = 0; j <= b; j++) { const v = j / b * Math.PI * 2; const p = center.clone().addScaledVector(side, Math.cos(v) * width); p.z = Math.sin(v) * width * .52; positions.push(p.x - .34, p.y, p.z); normals.push(0, 0, 1); uv.push(t, j / b); if (i < a && j < b) { const n = i * (b + 1) + j; indices.push(n, n + 1, n + b + 1, n + 1, n + b + 2, n + b + 1); } }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }, []);
  const seam = useMemo(() => {
    const edge = (out: boolean) => Array.from({ length: 36 }, (_, i) => { const t = i / 35, a = -.32 + t * 1.82; const dx = Math.cos(a) * .58, dy = -Math.sin(a) * .84, len = Math.hypot(dx, dy); const width=.014+Math.pow(Math.sin(Math.PI*t),.65)*.135,w=width*.78*(out?1:-1); return [.11 + Math.sin(a) * .58 - dy / len * w - .34, .38 - (1 - Math.cos(a)) * .84 + dx / len * w, width*.52*Math.sqrt(1-.78**2)+.0015] as XYZ; });
    return [...edge(true), ...edge(false).reverse()];
  }, []);
  useOwnedGeometry(geometry);
  return <group position={[.16,-.03,0]} rotation={[0, 0, -.55]}><mesh geometry={geometry} castShadow receiveShadow><Leather color="#e8b934" /></mesh><SewnEdge points={seam} color="#8f6d26" /><mesh position={[-.41, .357, 0]} rotation={[0, 0, -.3]} castShadow><capsuleGeometry args={[.027, .068, 4, 8]} /><Leather color="#7b6540" /></mesh><group position={[-.36, .32, -.008]} rotation={[0, 0, -.8]}><mesh scale={[.075, .19, .024]} castShadow><sphereGeometry args={[1, 24, 16]} /><Leather color="#50703c" /></mesh><Tube points={[[0,-.16,.025],[0,0,.03],[0,.16,.01]]} radius={.0025} color="#a4b475" /></group></group>;
}
function Pear() {
  const geometry = useMemo(() => {
    const pts = [[0,-.42],[.12,-.42],[.25,-.34],[.31,-.19],[.285,-.02],[.205,.16],[.135,.31],[.105,.4],[0,.42]].map(([r,y]) => new THREE.Vector2(r,y)); return new THREE.LatheGeometry(pts,48);
  }, []);
  const outline: XYZ[] = Array.from({length:96},(_,i)=>{
    const a=i/96*Math.PI*2,y=-.015+Math.cos(a)*.375;
    const profile=[[-.42,.12],[-.34,.25],[-.19,.31],[-.02,.285],[.16,.205],[.31,.135],[.4,.105],[.42,0]];
    const j=profile.findIndex(p=>p[0]>=y),lo=profile[Math.max(0,j-1)],hi=profile[j];
    const radius=THREE.MathUtils.lerp(lo[1],hi[1],(y-lo[0])/(hi[0]-lo[0]));
    const ratio=Math.sin(a)*.86;
    return [radius*ratio,y,radius*.42*Math.sqrt(1-ratio*ratio)+.0015];
  });
  useOwnedGeometry(geometry);
  return <group><mesh geometry={geometry} scale={[1,1,.42]} castShadow receiveShadow><Leather color="#9aaa57" /></mesh><SewnEdge points={outline} color="#6d7837" /><Tube points={[[0,.41,0],[.015,.47,0],[.04,.52,.01]]} radius={.027} color="#7a583d" /><mesh position={[.13,.43,0]} rotation={[0,0,-.7]} scale={[.075,.16,.017]} castShadow><sphereGeometry args={[1,24,16]} /><Leather color="#536f42" /></mesh></group>;
}
function Orange() {
  const seam: XYZ[] = Array.from({ length: 56 }, (_,i) => { const a=i/56*Math.PI*2;return [Math.cos(a)*.328,Math.sin(a)*.335,.14*Math.sqrt(1-(Math.cos(a)*.328/.36)**2-(Math.sin(a)*.335/.37)**2)+.0015]; });
  return <group><mesh scale={[.36,.37,.14]} castShadow receiveShadow><sphereGeometry args={[1,48,32]} /><Leather color="#dc7d25" /></mesh><SewnEdge points={seam} color="#a15922"/><mesh position={[.1,.38,0]} rotation={[0,0,-.85]} scale={[.072,.17,.019]} castShadow><sphereGeometry args={[1,24,16]}/><Leather color="#45693c"/></mesh><Tube points={[[0,.34,0],[0,.45,0],[.04,.49,0]]} radius={.02} color="#715132"/></group>;
}
function RoundedSymbol({ shape, color, tone, isMetal = false }: { shape: 'star'|'heart'; color: string; tone: string; isMetal?: boolean }) {
  const geometry = useMemo(() => {
    const path=new THREE.Shape();
    if(shape==='star') { for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.18:.36; const x=Math.cos(a)*r,y=Math.sin(a)*r;i?path.lineTo(x,y):path.moveTo(x,y);} path.closePath(); }
    else { path.moveTo(0,-.32);path.bezierCurveTo(-.65,.08,-.28,.55,0,.25);path.bezierCurveTo(.28,.55,.65,.08,0,-.32); }
    const g=new THREE.ExtrudeGeometry(path,{depth:.055,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.036,bevelThickness:.025,curveSegments:24});g.translate(0,0,-.0275);g.computeVertexNormals();return g;
  },[shape]);
  useOwnedGeometry(geometry);
  return <mesh geometry={geometry} castShadow receiveShadow>{isMetal?<Metal tone={tone} roughness={.2}/>:<meshPhysicalMaterial color={color} roughness={.2} metalness={.3} clearcoat={1} clearcoatRoughness={.14}/>}</mesh>;
}
function Cupcake({tone}:{tone:string}) {
  return <group>
    <mesh position={[0,-.18,0]} castShadow receiveShadow><cylinderGeometry args={[.31,.235,.37,36]}/><Leather color="#bd9066"/></mesh>
    {Array.from({length:20},(_,i)=>{const a=i/20*Math.PI*2;return <Tube key={i} points={[[Math.cos(a)*.244,-.33,Math.sin(a)*.244],[Math.cos(a)*.2725,-.18,Math.sin(a)*.2725],[Math.cos(a)*.302,-.035,Math.sin(a)*.302]]} radius={.009} color="#a87952" leather/>;})}
    {[[.3,0],[.248,.115],[.17,.235],[.077,.32]].map(([r,y],i)=><mesh key={i} position={[i%2?.015:0,y,0]} scale={[1,.48,1]} castShadow receiveShadow><sphereGeometry args={[r,32,20]}/><Leather color="#d491a4"/></mesh>)}
    <mesh position={[0,.39,0]} castShadow><sphereGeometry args={[.071,20,16]}/><Leather color="#a72f44"/></mesh>
    <Ring radius={.044} thickness={.009} position={[0,.48,0]} tone={tone}/>
    {Array.from({length:10},(_,i)=>{
      const a=i*2.39,layer=i%3,r=[.3,.248,.17][layer],y=[0,.115,.235][layer];
      const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-Math.sin(a),0,Math.cos(a)));
      return <mesh key={i} position={[(layer%2?.015:0)+Math.cos(a)*r*.88,y+r*.48*Math.sqrt(1-.88**2)+.002,Math.sin(a)*r*.88]} quaternion={orientation} castShadow><capsuleGeometry args={[.009,.037,2,5]}/><Leather color={i%3?'#e6cc7c':'#efe6d9'}/></mesh>;
    })}
  </group>;
}
function Cherry() {
  return <group>{[-1,1].map((s,i)=><group key={s}>
    <Tube points={[[0,.38,0],[s*.13,.18,0],[s*.18,-.12,0]]} radius={.017} color="#697541" leather/>
    <mesh position={[s*.17,-.16-i*.035,0]} scale={[1,1.06,.88]} castShadow receiveShadow><sphereGeometry args={[.175,32,24]}/><Leather color="#9f263f"/></mesh>
    <SewnEdge color="#722c39" points={Array.from({length:56},(_,j)=>{const a=j/56*Math.PI*2;return [s*.17+.175*.86*Math.cos(a),-.16-i*.035+.175*1.06*.86*Math.sin(a),.175*.88*Math.sqrt(1-.86**2)+.001];})}/>
  </group>)}<mesh position={[-.14,.29,0]} rotation={[0,0,.8]} scale={[.063,.18,.02]} castShadow><sphereGeometry args={[1,24,16]}/><Leather color="#467145"/></mesh></group>;
}
function Flower({tone}:{tone:string}) {return <group>{Array.from({length:6},(_,i)=>{const a=i/6*Math.PI*2;return <mesh key={i} position={[Math.sin(a)*.2,Math.cos(a)*.2,0]} rotation={[0,0,-a]} scale={[.12,.21,.066]} castShadow><sphereGeometry args={[1,24,16]}/><meshPhysicalMaterial color="#ece6d7" roughness={.27} metalness={.08} clearcoat={1}/></mesh>;})}<mesh position={[0,0,.063]} scale={[1,1,.55]} castShadow><sphereGeometry args={[.104,24,16]}/><Metal tone={tone}/></mesh></group>;}
function Shell() {return <group>{Array.from({length:9},(_,i)=>{const a=(i-4)*.16;return <mesh key={i} position={[Math.sin(a)*.23,Math.cos(a)*.15-.08,Math.abs(i-4)*-.012]} rotation={[0,0,-a]} scale={[.068,.33,.06]} castShadow><sphereGeometry args={[1,24,16]}/><meshPhysicalMaterial color="#d9c9ad" roughness={.26} metalness={.14} clearcoat={.7} iridescence={.4} iridescenceIOR={1.3}/></mesh>;})}</group>;}
export function PartModel({part,tone='gold'}:{part:Part;tone?:string}) {
  if(part.shape==='banana')return <Banana/>;
  if(part.shape==='pear')return <Pear/>;
  if(part.shape==='orange')return <Orange/>;
  if(part.shape==='cupcake')return <Cupcake tone={tone}/>;
  if(part.shape==='star'||part.shape==='heart')return <RoundedSymbol shape={part.shape} color="#be6e7d" tone={tone} isMetal={part.shape==='star'}/>;
  if(part.shape==='cherry')return <Cherry/>;
  if(part.shape==='flower')return <Flower tone={tone}/>;
  if(part.shape==='shell')return <Shell/>;
  const glass=part.shape==='clear'||part.shape==='amethyst';
  return <group><mesh castShadow receiveShadow>{glass?<icosahedronGeometry args={[.26,1]}/>:<sphereGeometry args={[.26,36,24]}/>}<meshPhysicalMaterial color={part.shape==='pearl'?'#f5eee2':part.color} metalness={part.shape==='pearl'?.1:0} roughness={glass?.07:part.shape==='wood'?.64:.23} transmission={glass?.82:0} thickness={glass?.52:0} ior={glass?1.5:1.4} clearcoat={part.shape==='pearl'?1:.35} iridescence={part.shape==='pearl'?.27:0} iridescenceIOR={1.32} envMapIntensity={1.2}/></mesh>{part.shape==='wood'&&Array.from({length:6},(_,i)=><Ring key={i} radius={Math.sqrt(.26*.26-((i-2.5)*.071)**2)} thickness={.002} tone="gold" position={[0,(i-2.5)*.071,0]} rotation={[Math.PI/2,.1,0]}/>)}<Ring radius={.04} thickness={.008} tone={tone} position={[0,.265,0]} rotation={[Math.PI/2,0,0]}/></group>;
}
