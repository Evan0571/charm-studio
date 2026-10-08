import { RoundedBox, useGLTF } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Leather, Metal } from './materials';
import { Ring, Tube } from './parts';
import { bagAttachmentPose, type BagStyle } from './bagAttachment';
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
function QuiltStitches(){
  const lines=useMemo(()=>{const result:XYZ[][]=[];for(const slope of [-1,1])for(let d=-2.6;d<2.6;d+=.38){const pts:XYZ[]=[];for(const x of [-1.04,1.04]){const y=slope*x+d;if(y>=-1.26&&y<=.06)pts.push([x,y,.434]);}for(const y of [-1.26,.06]){const x=(y-d)/slope;if(x>=-1.04&&x<=1.04)pts.push([x,y,.434]);}if(pts.length===2)result.push(pts);}return result;},[]);
  return <group>{lines.map((points,i)=><Tube key={i} points={points} radius={.003} color="#96836e" segments={3}/>)}</group>;
}
function MiniAttachment() {
  const pose = bagAttachmentPose('mini'), surfaceZ = .515;
  const { ringBarCenter: [x, y, z], ringRadius: r, wireRadius } = pose;
  const ringGeometry = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>(), k = .55228475;
    path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, -r * k, 0), new THREE.Vector3(-r * k, -r, 0), new THREE.Vector3(0, -r, 0)));
    path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, -r, 0), new THREE.Vector3(r * k, -r, 0), new THREE.Vector3(r, -r * k, 0), new THREE.Vector3(r, 0, 0)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(r, 0, 0), new THREE.Vector3(-r, 0, 0)));
    return new THREE.TubeGeometry(path, 64, wireRadius, 10, true);
  }, [r, wireRadius]);
  const keeperGeometry = useMemo(() => {
    const path: [number, number][] = [[y + .21, surfaceZ + .02], [y + .105, surfaceZ + .024], [y, z - .052]];
    for (let i = 1; i <= 20; i++) { const a = Math.PI + Math.PI * i / 20; path.push([y + Math.sin(a) * .052, z + Math.cos(a) * .052]); }
    path.push([y + .105, surfaceZ + .058], [y + .21, surfaceZ + .048]);
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
    <RoundedBox position={[x, y + .125, surfaceZ + .016]} args={[.175, .20, .032]} radius={.023} smoothness={4} castShadow><Leather color="#c3b39f"/></RoundedBox>
    <mesh geometry={keeperGeometry} castShadow receiveShadow><Leather color="#c3b39f"/></mesh>
    <mesh geometry={ringGeometry} position={[x, y, z]} castShadow><Metal/></mesh>
    {[-.047, .047].flatMap(dx => [0, 2].map(i => <Tube key={`${dx}-${i}`} points={[[x + dx, y + .10 + i * .024, surfaceZ + .064], [x + dx, y + .124 + i * .024, surfaceZ + .064]]} radius={.004} color="#ded2bf" segments={2}/>))}
  </group>;
}
function Mini(){return <group><RoundedBox args={[2.3,1.63,.82]} radius={.25} smoothness={7} position={[0,-.56,0]} castShadow receiveShadow><Leather color="#b7a793"/></RoundedBox><QuiltStitches/><RoundedBox args={[2.19,.86,.11]} radius={.2} smoothness={6} position={[0,-.17,.46]} castShadow><Leather color="#c3b39f"/></RoundedBox><mesh position={[0,-.49,.54]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.13,.13,.04,28]}/><Metal/></mesh><LeatherStrap points={[[-.92,.21,0],[-.7,1.05,0],[0,1.38,0],[.7,1.05,0],[.92,.21,0]]} width={.14} color="#b3a18a"/>{[-.92,.92].map(x=><Ring key={x} radius={.088} thickness={.02} position={[x,.21,.04]}/>)}<MiniAttachment/></group>;}
function ImportedBag({style}:{style:'tote'|'shoulder'}){
  const {scene}=useGLTF(`/assets/models/atelier-${style}.glb?v=attachment-2`);
  const model=useMemo(()=>{const copy=scene.clone(true);copy.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.85;}});}});return copy;},[scene]);
  return <primitive object={model}/>;
}
export function BagModel({style}:{style:BagStyle}){return <group>{style==='mini'?<Mini/>:<ImportedBag style={style}/>}</group>;}
