import { RoundedBox, useGLTF } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Leather, Metal } from './materials';
import { Ring, Tube } from './parts';
export type BagStyle='tote'|'shoulder'|'mini';
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
function Mini(){return <group><RoundedBox args={[2.3,1.63,.82]} radius={.25} smoothness={7} position={[0,-.56,0]} castShadow receiveShadow><Leather color="#b7a793"/></RoundedBox><QuiltStitches/><RoundedBox args={[2.19,.86,.11]} radius={.2} smoothness={6} position={[0,-.17,.46]} castShadow><Leather color="#c3b39f"/></RoundedBox><mesh position={[0,-.49,.54]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.13,.13,.04,28]}/><Metal/></mesh><LeatherStrap points={[[-.92,.21,0],[-.7,1.05,0],[0,1.38,0],[.7,1.05,0],[.92,.21,0]]} width={.14} color="#b3a18a"/>{[-.92,.92].map(x=><Ring key={x} radius={.088} thickness={.02} position={[x,.21,.04]}/>)}</group>;}
function ImportedBag({style}:{style:'tote'|'shoulder'}){
  const {scene}=useGLTF(`/assets/models/atelier-${style}.glb`);
  const model=useMemo(()=>{const copy=scene.clone(true);copy.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.85;}});}});return copy;},[scene]);
  return <primitive object={model}/>;
}
export function BagModel({style}:{style:BagStyle}){return <group>{style==='mini'?<Mini/>:<ImportedBag style={style}/>}</group>;}
export function bagAnchor(style:BagStyle):XYZ{return style==='tote'?[1.77,.68,.7]:style==='shoulder'?[1.62,.69,.6]:[.87,.28,.56];}
