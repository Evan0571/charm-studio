import { useLanguage } from './Language';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CapsuleCollider, CuboidCollider, Physics, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier, useSphericalJoint, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { Catalog, DesignConfig, Part } from '../shared/types';
import { BagCollision, BagModel } from './three/bags';
import { bagAttachmentPose, type BagStyle } from './three/bagAttachment';
import { BAG_CHARM_SCALE, BAG_OFFSET, MOUNT_LINK, getMountedAssembly, getStrands, pendantOffset, partAttachmentPoint, cordLeadPoints, TRANSFER_RING, type StrandSpec } from './three/assemblyLayout';
import { BAG_FLOOR_Y, beginGentleSway, limitStrandSpeed } from './three/physics';
import { assemblyPhysicsKey, placeHangingAssembly, type HangingBody } from './three/assemblyPlacement';
import { Metal } from './three/materials';
import { PartModel, Ring, Tube } from './three/parts';
import { constrainPan, previewTarget } from './three/previewCamera';
import { ProductLighting } from './three/ProductLighting';
import { LeatherStrap } from './three/LeatherStrap';
import { PartColliders } from './three/PartColliders';

type XYZ=[number,number,number];
export interface CharmSceneProps {config:DesignConfig;catalog:Catalog;bag:boolean;bagStyle:BagStyle;bagColor?:string;selectedSlot?:string;onSelectSlot?:(id:string)=>void;showMarkers?:boolean;zoom?:number;panMode?:boolean;autoRotate?:boolean;motion?:boolean;resetKey?:number;onReady?:()=>void;onError?:(message:string)=>void;onCapture?:(url:string)=>void;}
function Cord({length,color,radius=.015}:{length:number;color:string;radius?:number}){
  const strands=useMemo(()=>Array.from({length:3},(_,j)=>Array.from({length:Math.ceil(length*65)+1},(_,i)=>{const t=i/Math.ceil(length*65);const a=t*length*66+j*Math.PI*2/3;return [Math.cos(a)*radius*.55,-t*length,Math.sin(a)*radius*.55] as XYZ;})),[length,radius]);
  return <group>{strands.map((points,i)=><Tube key={i} points={points} radius={radius*.62} color={i===1?new THREE.Color(color).multiplyScalar(1.09).getStyle():color} segments={Math.ceil(length*65)}/>)}</group>;
}
function Chain({length,tone,rotation=Math.PI/2,supportTilt=0}:{length:number;tone:string;rotation?:number;supportTilt?:number}){
  return <group>{Array.from({length:Math.ceil(length/.065)},(_,i)=><group key={i} position={[0,-i*.065,0]} rotation={[0,0,i===0?supportTilt:0]}>
    <group rotation={[0,rotation+(i%2?Math.PI/2:0),0]} scale={[i===0&&length>1?1:.74,1,1]}><Ring radius={i===0&&length>1?.06:.043} thickness={.01} tone={tone}/></group>
  </group>)}</group>;
}
function Knot({color,leather}:{color:string;leather:boolean}){
  const lines=useMemo(()=>Array.from({length:3},(_,strand)=>Array.from({length:126},(_,i)=>{const t=i/125,a=t*Math.PI*2*7+strand*Math.PI*2/3;return [Math.cos(a)*.085,.96-t*.4,Math.sin(a)*.064] as XYZ;})),[]);
  return <group>{lines.map((points,i)=><Tube key={i} points={points} radius={.022} color={i===1?new THREE.Color(color).multiplyScalar(1.12).getStyle():color} segments={180}/>)}<group rotation={[0,leather?Math.PI/2:0,0]}><Tube points={[[0,1.1,0],[-.065,1.01,0],[0,.89,0],[.065,1.01,0],[0,1.1,0]]} radius={.025} color={color}/></group></group>;
}
function Connector({leather,tone,transfer=true}:{leather:boolean;tone:string;transfer?:boolean}){
  if(leather)return <LeatherStrap tone={tone}/>;
  return <group>
    <Ring position={[0,1.46,0]} radius={.32} thickness={.039} tone={tone}/>
    <mesh position={[.299,1.56,0]} rotation={[0,0,-.33]} castShadow><capsuleGeometry args={[.043,.10,5,16]}/><Metal tone={tone} roughness={.18}/></mesh>
    {transfer&&<Ring radius={TRANSFER_RING.radius} thickness={TRANSFER_RING.wire} position={[0,TRANSFER_RING.centerY,0]} rotation={[0,Math.PI/2,0]} tone={tone}/>}
  </group>;
}
function PartMarker({label,position,scale}:{label:string;position:XYZ;scale:number}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=72;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#fffdf5';ctx.strokeStyle='#b8ae98';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(3,3,186,66,22);ctx.fill();ctx.stroke();
    ctx.fillStyle='#665c48';ctx.font='30px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,96,37);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
  },[label]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <sprite name="capture-exclude" position={position} scale={[.055/scale,.021/scale,1]} renderOrder={10}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} sizeAttenuation={false}/></sprite>;
}
function SlotPart({part,tone,slot,selected,onSelect,showMarkers=true,scale,position}:{part?:Part;tone:string;slot:string;selected?:string;onSelect?:(id:string)=>void;showMarkers?:boolean;scale:number;position:XYZ}) {
 const { tr } = useLanguage();
  const [hovered,setHovered]=useState(false);
  return <group position={position} scale={scale} onClick={(event:ThreeEvent<MouseEvent>)=>{if(event.delta>4||!onSelect)return;event.stopPropagation();onSelect(slot);}} onPointerOver={(event)=>{if(!onSelect)return;event.stopPropagation();setHovered(true);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHovered(false);if(onSelect)document.body.style.cursor='';}}>
    {part?<PartModel part={part} tone={tone}/>:showMarkers&&<PartMarker label="+" position={[0,0,0]} scale={scale}/>}
    {showMarkers&&(selected===slot||hovered)&&onSelect&&<PartMarker label={selected===slot?tr("已选中"):tr("选择")} position={[.38,.29,0]} scale={scale}/>}
  </group>;
}
function HangingStrand({spec,config,catalog,color,selectedSlot,onSelectSlot,showMarkers,bodies,physicalScale}:{spec:StrandSpec;config:DesignConfig;catalog:Catalog;color:string;selectedSlot?:string;onSelectSlot?:(id:string)=>void;showMarkers?:boolean;bodies:RefObject<Map<string,HangingBody>>;physicalScale:number}){
  const anchor=useRef<RapierRigidBody>(null),body=useRef<RapierRigidBody>(null),pendant=useRef<RapierRigidBody>(null);
  const part=catalog.parts.find(p=>p.id===config.slots[spec.charmSlot]);
  const bead=catalog.parts.find(p=>spec.beadSlot&&p.id===config.slots[spec.beadSlot]);
  useSphericalJoint(anchor as RefObject<RapierRigidBody>,body as RefObject<RapierRigidBody>,[[0,0,0],[0,0,0]]);
  const pendantJoint=useSphericalJoint(body as RefObject<RapierRigidBody>,pendant as RefObject<RapierRigidBody>,[[0,-spec.length*physicalScale,0],[0,0,0]]);
  useEffect(()=>{pendantJoint.current?.setContactsEnabled(false);},[pendantJoint]);
  useEffect(()=>{
    if(body.current&&anchor.current)bodies.current.set(spec.id,{
      body:body.current,anchor:anchor.current,side:spec.anchor[0]<0?-1:1,
      pendant:part&&pendant.current?{body:pendant.current,offset:[0,-spec.length*physicalScale,0]}:undefined,
    });
    return()=>{bodies.current.delete(spec.id);};
  },[bodies,spec,part,physicalScale]);
  useAfterPhysicsStep(()=>{for(const ref of [body,pendant])if(ref.current)limitStrandSpeed(ref.current);});
  const [x,,z]=partAttachmentPoint(part), y=pendantOffset(part,spec)+spec.length;
  const physicalProps={colliders:false as const,enabled:false,linearDamping:1.7,angularDamping:4.5,friction:.45,restitution:0,additionalSolverIterations:8,canSleep:true,ccd:true};
  return <><RigidBody ref={anchor} type="fixed" position={spec.anchor} colliders={false}/>
    <RigidBody ref={body} name={`strand-${spec.id}`} {...physicalProps} position={spec.anchor}>
      <CapsuleCollider args={[Math.max(.01,(spec.length-.09)/2),spec.chain?.024:.017]} position={[0,-spec.length/2,0]} mass={.006} friction={.4}/>
      {spec.chain?<Chain length={spec.length} tone={config.metalTone} rotation={spec.linkRotation} supportTilt={spec.supportTilt}/>:<group position={[0,.018,0]}><Cord length={spec.length+.018} color={color}/></group>}
      <Ring radius={.044} thickness={.01} tone={config.metalTone} position={[0,-spec.length,0]}/>
      {spec.beadSlot&&<PartColliders id={bead?.id}><SlotPart part={bead} tone={config.metalTone} slot={spec.beadSlot} selected={selectedSlot} onSelect={onSelectSlot} showMarkers={showMarkers} scale={.45} position={[0,-spec.length*.66,0]}/></PartColliders>}
      {!part&&<SlotPart tone={config.metalTone} slot={spec.charmSlot} selected={selectedSlot} onSelect={onSelectSlot} showMarkers={showMarkers} scale={spec.scale} position={[0,y-spec.length,0]}/>}
    </RigidBody>
    {part&&<RigidBody ref={pendant} name={`pendant-${spec.id}`} {...physicalProps} position={[spec.anchor[0],spec.anchor[1]-spec.length,spec.anchor[2]]}>
      <PartColliders id={part.id}><SlotPart part={part} tone={config.metalTone} slot={spec.charmSlot} selected={selectedSlot} onSelect={onSelectSlot} showMarkers={showMarkers} scale={spec.scale} position={[-x*spec.scale,y,-z*spec.scale]}/></PartColliders>
    </RigidBody>}
  </>;
}
function Assembly({config,catalog,selectedSlot,onSelectSlot,showMarkers=true,physicalScale=1,motion=true}:{config:DesignConfig;catalog:Catalog;selectedSlot?:string;onSelectSlot?:(id:string)=>void;showMarkers?:boolean;physicalScale?:number;motion?:boolean}){
  const color=catalog.cordColors.find(c=>c.id===config.cordColor)?.hex??'#99a98d';
  const specs=useMemo(()=>getStrands(config),[config.templateId,config.connectorId]);
  const bodies=useRef(new Map<string,HangingBody>()),placed=useRef(false),root=useRef<THREE.Group>(null),visibleSteps=useRef(0);
  const {rigidBodyStates}=useRapier();
  const previousMotion=useRef(motion);
  useEffect(()=>{
    if(motion&&!previousMotion.current&&placed.current){
      for(const {body,pendant,side} of bodies.current.values()){
        beginGentleSway(body,side);
        if(pendant){
          const w=body.angvel(),center=pendant.body.worldCom(),pivot=body.translation();
          pendant.body.setAngvel(w,true);
          pendant.body.setLinvel({x:-w.z*(center.y-pivot.y),y:w.z*(center.x-pivot.x),z:0},true);
        }
      }
    }
    previousMotion.current=motion;
  },[motion]);
  useBeforePhysicsStep(world=>{
    if(placed.current||bodies.current.size!==specs.length)return;
    const strands=specs.map(spec=>bodies.current.get(spec.id)!);
    if(strands.some(({body,pendant})=>body.numColliders()===0||(pendant&&pendant.body.numColliders()===0)))return;
    placeHangingAssembly(world,strands);
    // Rapier skips visual updates for sleeping bodies. Publish their settled
    // transforms once without waking them and restarting contact-driven motion.
    for(const body of strands.flatMap(s=>s.pendant?[s.body,s.pendant.body]:[s.body])){
      const state=rigidBodyStates.get(body.handle);
      if(state){
        const p=body.translation(),q=body.rotation();
        new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion(q.x,q.y,q.z,q.w),state.scale)
          .premultiply(state.invertedWorldMatrix).decompose(state.object.position,state.object.quaternion,state.object.scale);
      }
    }
    placed.current=true;
  });
  useAfterPhysicsStep(()=>{if(placed.current&&root.current&&++visibleSteps.current>=2)root.current.visible=true;});
  return <group ref={root} visible={false}><Connector leather={config.connectorId==='leather'} tone={config.metalTone} transfer={config.templateId!=='chain'}/>{config.templateId==='cord'&&<><Knot color={color} leather={config.connectorId==='leather'}/>{specs.map(spec=><group key={spec.id}><Tube points={cordLeadPoints(spec.anchor)} radius={.017} color={color}/><mesh position={spec.anchor}><sphereGeometry args={[.017,12,8]}/><meshStandardMaterial color={color} roughness={.85}/></mesh></group>)}</>}{specs.map(spec=><HangingStrand key={`${config.templateId}-${config.connectorId}-${spec.id}`} spec={spec} config={config} catalog={catalog} color={color} bodies={bodies} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} showMarkers={showMarkers} physicalScale={physicalScale}/>)}</group>;
}
function CameraRig({bag,zoom=1,panMode=false,autoRotate,resetKey}:{bag:boolean;zoom?:number;panMode?:boolean;autoRotate?:boolean;resetKey?:number}){
  const ref=useRef<ComponentRef<typeof OrbitControls>>(null);
  const{camera,size}=useThree();
  const target=useMemo(()=>previewTarget(bag),[bag]);
  const origin=useMemo(()=>new THREE.Vector3(...target),[target]);
  useEffect(()=>{
    const aspect=size.width/size.height,expand=bag?Math.max(1,1.04/aspect):1;
    camera.position.set((bag?4.3:2.15)*expand,(bag?2.1:1.2)*expand,(bag?7.4:5.7)*expand);
    ref.current?.target.copy(origin);ref.current?.update();
  },[bag,resetKey,camera,size.width,size.height,origin]);
  useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera){camera.zoom=zoom;camera.updateProjectionMatrix();}},[zoom,camera]);
  return <OrbitControls key={`${bag}-${resetKey}`} ref={ref} makeDefault enablePan screenSpacePanning panSpeed={.65} enableDamping dampingFactor={.07}
    mouseButtons={{LEFT:panMode?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}}
    touches={{ONE:panMode?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN}}
    onChange={()=>{if(ref.current)constrainPan(ref.current.target,camera.position,origin,bag);}}
    minDistance={bag?4.8:2.8} maxDistance={bag?11:8} minPolarAngle={.25} maxPolarAngle={Math.PI*.78} autoRotate={autoRotate} autoRotateSpeed={.65} target={target}/>;
}
function Capture({signature,onCapture,onReady}:{signature:string;onCapture?:CharmSceneProps['onCapture'];onReady?:()=>void}){
  const{gl,scene,camera,invalidate}=useThree();const due=useRef(0);const tick=useRef(0);const ready=useRef(false);const callback=useRef(onCapture);callback.current=onCapture;
  useEffect(()=>{due.current=performance.now()+1250;ready.current=false;tick.current=0;invalidate();const timer=window.setTimeout(()=>invalidate(),1300);return()=>window.clearTimeout(timer);},[signature,invalidate]);
  useFrame(()=>{
    tick.current++;
    if(tick.current<5)invalidate();
    if(!ready.current&&tick.current>3){ready.current=true;onReady?.();}
    if(callback.current&&due.current&&performance.now()>due.current){
      due.current=0;
      const hidden:THREE.Object3D[]=[];
      try{
        scene.traverse(o=>{if(o.name==='capture-exclude'&&o.visible){o.visible=false;hidden.push(o);}});
        gl.render(scene,camera);
        const image=document.createElement('canvas');
        const ratio=Math.min(1,1000/gl.domElement.width);
        image.width=Math.round(gl.domElement.width*ratio);image.height=Math.round(gl.domElement.height*ratio);
        image.getContext('2d')?.drawImage(gl.domElement,0,0,image.width,image.height);
        callback.current(image.toDataURL('image/jpeg',.9));
      }catch{/* Capturing never affects the interactive viewport. */}
      finally{hidden.forEach(o=>o.visible=true);}
    }
  });
  return null;
}
function SceneContents(props:CharmSceneProps){
  const { tr } = useLanguage();
  const { gl } = useThree();
  const errorCallback=useRef(props.onError);errorCallback.current=props.onError;
  useEffect(()=>{gl.domElement.setAttribute('aria-label',tr('三维包挂预览，可拖动旋转、右键或双指平移、滚轮缩放，点击挂件选择配件'));},[gl,tr]);
  useEffect(()=>{
    const lost=()=>errorCallback.current?.(tr('3D 画布暂时不可用，请重新加载预览。'));
    gl.domElement.addEventListener('webglcontextlost',lost,{once:true});
    return()=>gl.domElement.removeEventListener('webglcontextlost',lost);
  },[gl,tr]);
  const{config,catalog,bag,bagStyle,motion=true}=props;
  const attachment=bagAttachmentPose(bagStyle),mount=getMountedAssembly(attachment.innerContact,config.connectorId);
  const scale=bag?BAG_CHARM_SCALE:1;
  const position:XYZ=bag?mount.position:[0,.08,0];
  const floorY=bag?BAG_FLOOR_Y:-1.95;
  return <><color attach="background" args={['#eeece8']}/><ProductLighting/>
  <CameraRig bag={bag} zoom={props.zoom} panMode={props.panMode} autoRotate={props.autoRotate} resetKey={props.resetKey}/>
  <Physics gravity={[0,-9.81,0]} timeStep={1/60} numSolverIterations={12} maxCcdSubsteps={4}>
    {bag&&<><group position={BAG_OFFSET}><BagModel style={bagStyle} color={props.bagColor}/>{config.connectorId==='ring'&&<Ring position={mount.linkCenter} rotation={[0,Math.PI/2,0]} radius={MOUNT_LINK.radius} thickness={MOUNT_LINK.wire} tone={config.metalTone}/>}</group><RigidBody type="fixed" colliders={false} position={BAG_OFFSET}><BagCollision style={bagStyle}/></RigidBody></>}
    <group position={position} scale={scale}><Assembly key={`${bag}-${bagStyle}-${assemblyPhysicsKey(config)}`} config={config} catalog={catalog} selectedSlot={props.selectedSlot} onSelectSlot={props.panMode?undefined:props.onSelectSlot} showMarkers={props.showMarkers} physicalScale={scale} motion={motion}/></group>
    <RigidBody type="fixed" colliders={false} position={[0,floorY-.1,0]}><CuboidCollider args={[8,.1,8]}/></RigidBody>
  </Physics>
  <mesh receiveShadow position={[0,floorY,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[200,200]}/><shadowMaterial transparent opacity={.08}/></mesh>
  <Capture signature={JSON.stringify([config,bag,bagStyle,props.bagColor])} onCapture={props.onCapture} onReady={props.onReady}/>
  </>;
}
export default function CharmScene(props:CharmSceneProps){
 const { tr } = useLanguage();
  return <Canvas className="scene-viewer" frameloop={props.motion!==false||props.autoRotate?'always':'demand'} shadows={{type:THREE.PCFShadowMap}} dpr={[1,1.65]} camera={{fov:38,near:.1,far:60,position:[2.15,1.2,5.7]}} gl={{antialias:true,alpha:false,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1}} onCreated={({gl})=>{gl.domElement.setAttribute('aria-label',tr("三维包挂预览，可拖动旋转、右键或双指平移、滚轮缩放，点击挂件选择配件"));}}><Suspense fallback={null}><SceneContents {...props}/></Suspense></Canvas>;
}
