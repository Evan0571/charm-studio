import { Environment, Lightformer } from '@react-three/drei';

/** A side-lit product setup: broad leather highlights and narrow hardware reflections. */
export function ProductLighting() {
  return <>
    <ambientLight intensity={.12}/>
    <directionalLight position={[-3.5, 5, 4]} intensity={2.5} color="#fff2df" castShadow
      shadow-mapSize={[2048, 2048]} shadow-normalBias={.007} shadow-bias={-.00015}
      shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}/>
    <directionalLight position={[4, 1, -3]} intensity={.35} color="#e0e8f2"/>
    <Environment files="/assets/environment/studio-small-09-1k.hdr" environmentIntensity={.55} background={false} resolution={256}>
      <Lightformer form="rect" intensity={3} color="#fff5e6" scale={[3, 5]} position={[-3, 3, 4]} rotation={[0, -.45, 0]}/>
      <Lightformer form="rect" intensity={1.8} color="white" scale={[.8, 4]} position={[4, 1, 2]} rotation={[0, .8, 0]}/>
    </Environment>
  </>;
}
