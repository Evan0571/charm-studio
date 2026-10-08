import { ConvexHullCollider, RoundCuboidCollider } from '@react-three/rapier';
import { RoundedBox, useGLTF } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Leather, Metal } from './materials';
import { Ring, Tube } from './parts';
import { bagAttachmentPose, type BagStyle } from './bagAttachment';
import { createMiniBodyGeometry, createMiniFlapGeometry, miniQuiltLines, MINI_FLAP_THICKNESS } from './miniBagGeometry';
import { cloneBagMaterial, miniBagPalette } from './bagMaterials';
export { bagAnchor, bagAttachmentPose } from './bagAttachment';
export type { BagStyle, BagAttachmentPose } from './bagAttachment';
type XYZ=[number,number,number];
function LeatherStrap({points,width=.17,depth=.028,color='#836149'}:{points:XYZ[];width?:number;depth?:number;color?:string}){
  const geometry=useMemo(()=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const shape=new THREE.Shape(); shape.moveTo(-width/2,-depth);shape.lineTo(width/2,-depth);shape.lineTo(width/2,depth);shape.lineTo(-width/2,depth);shape.closePath();return new THREE.ExtrudeGeometry(shape,{steps:64,bevelEnabled:false,extrudePath:curve});
  },[JSON.stringify(points),width,depth]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><Leather color={color}/></mesh>;
}
function QuiltStitches({color}:{color:string}){
  const lines=useMemo(miniQuiltLines,[]);
  return <group>{lines.map((points,i)=><Tube key={i} points={points} radius={.0025} color={color} segments={points.length}/>)}</group>;
}
function MiniAttachment({color,thread}:{color:string;thread:string}) {
  const pose = bagAttachmentPose('mini'), surfaceZ = .41 + MINI_FLAP_THICKNESS;
  const { ringBarCenter: [x, y, z], ringRadius: r, wireRadius } = pose;
  const ringGeometry = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>(), k = .55228475;
    path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, -r * k, 0), new THREE.Vector3(-r * k, -r, 0), new THREE.Vector3(0, -r, 0)));
    path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, -r, 0), new THREE.Vector3(r * k, -r, 0), new THREE.Vector3(r, -r * k, 0), new THREE.Vector3(r, 0, 0)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(r, 0, 0), new THREE.Vector3(-r, 0, 0)));
    return new THREE.TubeGeometry(path, 64, wireRadius, 10, true);
  }, [r, wireRadius]);
  const keeperGeometry = useMemo(() => {
    const path: [number, number][] = [[y + .19, surfaceZ + .02], [y + .105, surfaceZ + .024], [y, z - .052]];
    for (let i = 1; i <= 20; i++) { const a = Math.PI + Math.PI * i / 20; path.push([y + Math.sin(a) * .052, z + Math.cos(a) * .052]); }
    path.push([y + .105, surfaceZ + .058], [y + .19, surfaceZ + .048]);
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    path.forEach(([py, pz], i) => {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ny = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length;
      for (const [sx, side] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { positions.push(x + sx * .065, py + ny * .009 * side, pz + nz * .009 * side); uv.push((sx + 1) / 2, i / path.length); }
      if (i < path.length - 1) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4; indices.push(a, b, b + 4, a, b + 4, a + 4); }
    });
    indices.push(3, 2, 1, 3, 1, 0); const end = (path.length - 1) * 4; indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }, [x, y, z]);
  useEffect(() => () => { ringGeometry.dispose(); keeperGeometry.dispose(); }, [ringGeometry, keeperGeometry]);
  return <group name="mini-structural-charm-mount">
    <RoundedBox position={[x, y + .11, surfaceZ + .014]} args={[.175, .16, .032]} radius={.012} smoothness={4} castShadow><Leather color={color}/></RoundedBox>
    <mesh geometry={keeperGeometry} castShadow receiveShadow><Leather color={color}/></mesh>
    <mesh geometry={ringGeometry} position={[x, y, z]} castShadow><Metal/></mesh>
    {[-.047, .047].flatMap(dx => [0, 2].map(i => <Tube key={`${dx}-${i}`} points={[[x + dx, y + .10 + i * .024, surfaceZ + .064], [x + dx, y + .124 + i * .024, surfaceZ + .064]]} radius={.004} color={thread} segments={2}/>))}
  </group>;
}
function Mini({color}:{color?:string}){
  const body=useMemo(createMiniBodyGeometry,[]),flap=useMemo(createMiniFlapGeometry,[]),palette=miniBagPalette(color);
  useEffect(()=>()=>{body.dispose();flap.dispose();},[body,flap]);
  return <group>
    <mesh geometry={body} castShadow receiveShadow><Leather color={palette.body}/></mesh>
    <QuiltStitches color={palette.thread}/>
    <mesh geometry={flap} castShadow receiveShadow><Leather color={palette.flap}/></mesh>
    <mesh position={[0,-.49,.461]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.13,.13,.04,28]}/><Metal/></mesh>
    <LeatherStrap points={[[-.92,.21,0],[-.7,1.05,0],[0,1.38,0],[.7,1.05,0],[.92,.21,0]]} width={.14} color={palette.handle}/>
    {[-.92,.92].map(x=><Ring key={x} radius={.088} thickness={.02} position={[x,.24,.04]}/>)}
    <MiniAttachment color={palette.flap} thread={palette.keeperThread}/>
  </group>;
}
function ImportedBag({style,color}:{style:'tote'|'shoulder';color?:string}){
  const {scene}=useGLTF(`/assets/models/atelier-${style}.glb?v=surface-3`);
  const {model,materials}=useMemo(()=>{
    const model=scene.clone(true),materials=new Map<THREE.Material,THREE.Material>();
    const clone=(m:THREE.Material)=>{if(!materials.has(m))materials.set(m,m instanceof THREE.MeshStandardMaterial?cloneBagMaterial(m,color):m.clone());return materials.get(m)!;};
    model.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);}});
    return {model,materials};
  },[scene,color]);
  useEffect(()=>()=>materials.forEach(m=>m.dispose()),[materials]);
  return <primitive object={model}/>;
}
export function BagModel({style,color}:{style:BagStyle;color?:string}){return <group>{style==='mini'?<Mini color={color}/>:<ImportedBag style={style} color={color}/>}</group>;}

function ImportedBagCollision({style}:{style:'tote'|'shoulder'}) {
  const {scene}=useGLTF(`/assets/models/atelier-${style}.glb?v=surface-3`);
  const hull=useMemo(()=>{
    const points:number[]=[];
    scene.updateMatrixWorld(true);
    scene.traverse(node=>{
      if(!(node instanceof THREE.Mesh)||!node.name.toLowerCase().includes('hollow'))return;
      const position=node.geometry.getAttribute('position'),v=new THREE.Vector3();
      for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld);points.push(v.x,v.y,v.z);}
    });
    return new Float32Array(points);
  },[scene]);
  return hull.length?<ConvexHullCollider args={[hull]} friction={.45}/>:null;
}
function MiniBagCollision(){
  const flapHull=useMemo(()=>{const geometry=createMiniFlapGeometry(),points=new Float32Array(geometry.getAttribute('position').array);geometry.dispose();return points;},[]);
  return <><RoundCuboidCollider args={[.90,.565,.16,.25]} position={[0,-.56,0]} friction={.45}/><ConvexHullCollider args={[flapHull]} friction={.45}/></>;
}
export function BagCollision({style}:{style:BagStyle}) {
  return style==='mini'?<MiniBagCollision/>:<ImportedBagCollision style={style}/>;
}
