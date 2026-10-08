import { Suspense, useEffect, useMemo, useRef, useState, type RefObject, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useAfterPhysicsStep, useRevoluteJoint, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { Catalog, DesignConfig, Part } from '../shared/types';
import { BagModel } from './three/bags';
import { bagAttachmentPose, type BagStyle } from './three/bagAttachment';
import { BAG_CHARM_SCALE, BAG_OFFSET, MOUNT_LINK, getMountedAssembly, getStrands, pendantOffset, type StrandSpec } from './three/assemblyLayout';
import { BAG_FLOOR_Y, STRAND_SWING_LIMIT, beginGentleSway, consumeSignatureChange } from './three/physics';
import { Leather, Metal } from './three/materials';
import { PartModel, Ring, Tube } from './three/parts';

type XYZ=[number,number,number];
export interface CharmSceneProps {config:DesignConfig;catalog:Catalog;bag:boolean;bagStyle:BagStyle;selectedSlot?:string;onSelectSlot?:(id:string)=>void;zoom?:number;autoRotate?:boolean;motion?:boolean;resetKey?:number;onReady?:()=>void;onError?:(message:string)=>void;onCapture?:(url:string)=>void;}
function Cord({length,color,radius=.015}:{length:number;color:string;radius?:number}){
  const strands=useMemo(()=>Array.from({length:3},(_,j)=>Array.from({length:Math.ceil(length*65)+1},(_,i)=>{const t=i/Math.ceil(length*65);const a=t*length*66+j*Math.PI*2/3;return [Math.cos(a)*radius*.55,-t*length,Math.sin(a)*radius*.55] as XYZ;})),[length,radius]);
  return <group>{strands.map((points,i)=><Tube key={i} points={points} radius={radius*.62} color={i===1?new THREE.Color(color).multiplyScalar(1.09).getStyle():color} segments={Math.ceil(length*65)}/>)}</group>;
}
function Chain({length,tone}:{length:number;tone:string}){return <group>{Array.from({length:Math.ceil(length/.065)},(_,i)=><group key={i} position={[0,-i*.065,0]} rotation={[0,i%2?0:Math.PI/2,0]} scale={[.74,1,1]}><Ring radius={.043} thickness={.01} tone={tone}/></group>)}</group>;}
function Knot({color}:{color:string}){
  const lines=useMemo(()=>Array.from({length:3},(_,strand)=>Array.from({length:126},(_,i)=>{const t=i/125,a=t*Math.PI*2*7+strand*Math.PI*2/3;return [Math.cos(a)*.085,.96-t*.4,Math.sin(a)*.064] as XYZ;})),[]);
  return <group>{lines.map((points,i)=><Tube key={i} points={points} radius={.022} color={i===1?new THREE.Color(color).multiplyScalar(1.12).getStyle():color} segments={180}/>)}<Tube points={[[0,1.1,0],[-.065,1.01,0],[0,.89,0],[.065,1.01,0],[0,1.1,0]]} radius={.025} color={color}/></group>;
}
function Connector({leather,tone}:{leather:boolean;tone:string}){
  if(!leather)return <group><Ring position={[0,1.46,0]} radius={.32} thickness={.039} tone={tone}/><Ring position={[0,1.455,.021]} radius={.313} thickness={.012} tone={tone}/><mesh position={[.286,1.565,.006]} rotation={[0,0,-.39]} castShadow><capsuleGeometry args={[.043,.12,5,12]}/><Metal tone={tone} roughness={.18}/></mesh><Ring radius={.087} thickness={.019} position={[0,1.09,0]} tone={tone}/></group>;
  return <group><RoundedBox position={[0,1.4,-.068]} args={[.21,.59,.03]} radius={.065} smoothness={4} castShadow><Leather color="#916c4b"/></RoundedBox><RoundedBox position={[0,1.4,.068]} args={[.21,.59,.03]} radius={.065} smoothness={4} castShadow><Leather color="#916c4b"/></RoundedBox><mesh position={[0,1.689,0]} rotation={[0,Math.PI/2,0]} castShadow><torusGeometry args={[.068,.018,10,32,Math.PI]}/><Leather color="#916c4b"/></mesh>{[-.078,.078].map(x=><Tube key={x} points={[[x,1.64,.086],[x,1.42,.086],[x,1.18,.086]]} radius={.003} color="#cfb390"/>)}<mesh position={[0,1.24,.085]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.029,.029,.008,20]}/><Metal tone={tone}/></mesh><Ring position={[0,1.08,0]} radius={.095} thickness={.023} tone={tone}/></group>;
}
function SlotPart({part,tone,slot,selected,onSelect,scale,position}:{part?:Part;tone:string;slot:string;selected?:string;onSelect?:(id:string)=>void;scale:number;position:XYZ}) {
  const [hovered,setHovered]=useState(false);
  return <group position={position} scale={scale} onClick={(event:ThreeEvent<MouseEvent>)=>{if(event.delta>4)return;event.stopPropagation();onSelect?.(slot);}} onPointerOver={(event)=>{event.stopPropagation();setHovered(true);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHovered(false);document.body.style.cursor='';}}>
    {part?<PartModel part={part} tone={tone}/>:<mesh><torusGeometry args={[.23,.012,6,28]}/><meshStandardMaterial color="#b6a38a" transparent opacity={.5}/></mesh>}
    {(selected===slot||hovered)&&<group name="capture-exclude"><Ring radius={.48} thickness={hovered?.009:.006} tone="silver" position={[0,0,-.1]}/></group>}
  </group>;
}
function HangingStrand({spec,config,catalog,color,selectedSlot,onSelectSlot,motion}:{spec:StrandSpec;config:DesignConfig;catalog:Catalog;color:string;selectedSlot?:string;onSelectSlot?:(id:string)=>void;motion:boolean}){
  const anchor=useRef<RapierRigidBody>(null),body=useRef<RapierRigidBody>(null);
  useRevoluteJoint(anchor as RefObject<RapierRigidBody>,body as RefObject<RapierRigidBody>,[[0,0,0],[0,0,0],[0,0,1],[-STRAND_SWING_LIMIT,STRAND_SWING_LIMIT]]);
  const signature=[config.slots[spec.charmSlot],spec.beadSlot?config.slots[spec.beadSlot]:'',config.metalTone,config.cordColor].join(':');
  const previous=useRef(signature),pendingNudge=useRef(2);
  useEffect(()=>{if(consumeSignatureChange(previous,signature)&&motion)pendingNudge.current=2;},[signature,motion]);
  useAfterPhysicsStep(()=>{if(!motion||!body.current||pendingNudge.current<=0)return;if(--pendingNudge.current===0)beginGentleSway(body.current,spec.anchor[0]<0?-1:1);});
  const part=catalog.parts.find(p=>p.id===config.slots[spec.charmSlot]); const bead=catalog.parts.find(p=>spec.beadSlot&&p.id===config.slots[spec.beadSlot]);
  const y=pendantOffset(part,spec);
  return <><RigidBody ref={anchor} type="fixed" position={spec.anchor} colliders={false}/><RigidBody ref={body} type={motion?'dynamic':'fixed'} position={spec.anchor} colliders={false} linearDamping={1.7} angularDamping={3.8} canSleep ccd>
    <BallCollider args={[.01]} position={[0,-spec.length*.5,0]} mass={.006} friction={.6}/>{part&&<BallCollider args={[.13*spec.scale]} position={[0,y,0]} mass={.07} friction={.65} restitution={.13}/>}
    {spec.beadSlot&&bead&&<BallCollider args={[.11]} position={[0,-spec.length*.66,0]} mass={.018} friction={.6}/>}
    {spec.chain?<Chain length={spec.length} tone={config.metalTone}/>:<Cord length={spec.length} color={color}/>}
    <Ring radius={.044} thickness={.01} tone={config.metalTone} position={[0,-spec.length,0]}/>
    {spec.beadSlot&&<SlotPart part={bead} tone={config.metalTone} slot={spec.beadSlot} selected={selectedSlot} onSelect={onSelectSlot} scale={.45} position={[0,-spec.length*.66,0]}/>}
    <SlotPart part={part} tone={config.metalTone} slot={spec.charmSlot} selected={selectedSlot} onSelect={onSelectSlot} scale={spec.scale} position={[0,y,0]}/>
  </RigidBody></>;
}
function Assembly({config,catalog,selectedSlot,onSelectSlot,motion=true}:{config:DesignConfig;catalog:Catalog;selectedSlot?:string;onSelectSlot?:(id:string)=>void;motion?:boolean}){
  const color=catalog.cordColors.find(c=>c.id===config.cordColor)?.hex??'#99a98d';
  const specs=useMemo(()=>getStrands(config),[config.templateId,config.connectorId]);
  return <group><Connector leather={config.connectorId==='leather'} tone={config.metalTone}/>{config.templateId==='cord'&&<><Knot color={color}/>{[-.225,.225].map(x=><Tube key={x} points={[[0,.63,0],[x*.7,.6,0],[x,.56,0]]} radius={.015} color={color}/>)}</>}{specs.map(spec=><HangingStrand key={`${config.templateId}-${config.connectorId}-${spec.id}-${motion}`} spec={spec} config={config} catalog={catalog} color={color} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} motion={motion}/>)}</group>;
}
function CameraRig({bag,zoom=1,autoRotate,resetKey}:{bag:boolean;zoom?:number;autoRotate?:boolean;resetKey?:number}){
  const ref=useRef<ComponentRef<typeof OrbitControls>>(null);const{camera,size}=useThree();
  useEffect(()=>{const aspect=size.width/size.height; const expand=bag?Math.max(1,1.04/aspect):1;camera.position.set((bag?4.3:2.15)*expand,(bag?2.1:1.2)*expand,(bag?7.4:5.7)*expand);ref.current?.target.set(bag?.1:0,bag?.3:.05,0);ref.current?.update();},[bag,resetKey,camera,size.width,size.height]);
  useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera){camera.zoom=zoom;camera.updateProjectionMatrix();}},[zoom,camera]);
  return <OrbitControls ref={ref} makeDefault enablePan={false} enableDamping dampingFactor={.07} minDistance={bag?4.8:2.8} maxDistance={bag?11:8} minPolarAngle={.25} maxPolarAngle={Math.PI*.78} autoRotate={autoRotate} autoRotateSpeed={.65} target={[0,.05,0]}/>;
}
function Capture({signature,onCapture,onReady}:{signature:string;onCapture?:CharmSceneProps['onCapture'];onReady?:()=>void}){
  const{gl,scene,camera,invalidate}=useThree();const due=useRef(0);const tick=useRef(0);const ready=useRef(false);const callback=useRef(onCapture);callback.current=onCapture;
  useEffect(()=>{due.current=performance.now()+1250;ready.current=false;tick.current=0;invalidate();const timer=window.setTimeout(()=>invalidate(),1300);return()=>window.clearTimeout(timer);},[signature,invalidate]);
  useFrame(()=>{tick.current++;if(tick.current<5)invalidate();if(!ready.current&&tick.current>3){ready.current=true;onReady?.();}if(callback.current&&due.current&&performance.now()>due.current){due.current=0;try{const hidden:THREE.Object3D[]=[];scene.traverse(o=>{if(o.name==='capture-exclude'&&o.visible){o.visible=false;hidden.push(o);}});gl.render(scene,camera);const image=document.createElement('canvas');const ratio=Math.min(1,600/gl.domElement.width);image.width=gl.domElement.width*ratio;image.height=gl.domElement.height*ratio;image.getContext('2d')?.drawImage(gl.domElement,0,0,image.width,image.height);hidden.forEach(o=>o.visible=true);callback.current(image.toDataURL('image/jpeg',.8));}catch{/* Capturing never affects the interactive viewport. */}}});
  return null;
}
function SceneContents(props:CharmSceneProps){
  const{config,catalog,bag,bagStyle,motion=true}=props;
  const attachment=bagAttachmentPose(bagStyle),mount=getMountedAssembly(attachment.innerContact,config.connectorId);
  const scale=bag?BAG_CHARM_SCALE:1;
  const position:XYZ=bag?mount.position:[0,.08,0];
  const floorY=bag?BAG_FLOOR_Y:-1.81;
  return <><color attach="background" args={['#eeece8']}/><ambientLight intensity={.24}/><directionalLight position={[-3,6,5]} intensity={1.6} castShadow shadow-mapSize={[2048,2048]} shadow-normalBias={.035} shadow-bias={-.0002} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}/><directionalLight position={[5,2,-4]} intensity={.65} color="#dbe8ff"/><Environment files="/assets/environment/studio-small-09-1k.hdr" environmentIntensity={.8} background={false}><Lightformer form="rect" intensity={1.6} color="white" scale={[8,8]} position={[0,0,5]}/><Lightformer form="rect" intensity={1.4} color="#fff3dc" scale={[2,5]} position={[-4,1,1]} rotation={[0,Math.PI/2,0]}/></Environment>
  <CameraRig bag={bag} zoom={props.zoom} autoRotate={props.autoRotate} resetKey={props.resetKey}/>
  <Physics gravity={[0,-9.81,0]} timeStep={1/60} numSolverIterations={8} paused={!motion}>
    {bag&&<><group position={BAG_OFFSET}><BagModel style={bagStyle}/>{config.connectorId==='ring'&&<Ring position={mount.linkCenter} rotation={[0,Math.PI/2,0]} radius={MOUNT_LINK.radius} thickness={MOUNT_LINK.wire} tone={config.metalTone}/>}</group><RigidBody type="fixed" colliders={false} position={[-.35,-.65,-.36]}><CuboidCollider args={bagStyle==='tote'?[1.56,1.06,.53]:bagStyle==='shoulder'?[1.42,.77,.51]:[.97,.68,.39]} friction={.5} restitution={.08}/></RigidBody></>}
    <group position={position} scale={scale}><Assembly key={`${bag}-${bagStyle}`} config={config} catalog={catalog} selectedSlot={props.selectedSlot} onSelectSlot={props.onSelectSlot} motion={motion}/></group>
    <RigidBody type="fixed" colliders={false} position={[0,floorY-.1,0]}><CuboidCollider args={[8,.1,8]}/></RigidBody>
  </Physics>
  <mesh receiveShadow position={[0,floorY,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[200,200]}/><shadowMaterial transparent opacity={.18}/></mesh>
  <Capture signature={JSON.stringify([config,bag,bagStyle])} onCapture={props.onCapture} onReady={props.onReady}/>
  </>;
}
export default function CharmScene(props:CharmSceneProps){
  return <Canvas className="scene-viewer" frameloop={props.motion!==false||props.autoRotate?'always':'demand'} shadows={{type:THREE.PCFShadowMap}} dpr={[1,1.65]} camera={{fov:38,near:.1,far:60,position:[2.15,1.2,5.7]}} gl={{antialias:true,alpha:false,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1}} onCreated={({gl})=>{gl.domElement.setAttribute('aria-label','三维包挂预览，可拖动旋转、滚轮缩放，点击挂件选择配件');gl.domElement.addEventListener('webglcontextlost',()=>props.onError?.('3D 画布暂时不可用，请重新加载预览。'),{once:true});}}><Suspense fallback={null}><SceneContents {...props}/></Suspense></Canvas>;
}
