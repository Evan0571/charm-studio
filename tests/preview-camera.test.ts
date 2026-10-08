import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { constrainPan, previewTarget } from '../src/three/previewCamera';

test('large repeated pans remain bounded without changing view direction or distance',()=>{
  for(const bag of [false,true]){
    const origin=new Vector3(...previewTarget(bag)),target=origin.clone(),camera=new Vector3(2,1,6);
    const view=camera.clone().sub(target);
    for(let i=0;i<100;i++){
      const drag=new Vector3(2,3,-1);
      target.add(drag);camera.add(drag);
      constrainPan(target,camera,origin,bag);
      assert.ok(target.distanceTo(origin)<=(bag?1.85:1.35)+1e-10);
      assert.ok(camera.clone().sub(target).distanceTo(view)<1e-10);
    }
  }
});

test('small pans retain their exact position',()=>{
  const origin=new Vector3(...previewTarget(false)),target=origin.clone().add(new Vector3(.2,.3,.1)),camera=new Vector3(2,1,6);
  const before=target.clone(),cameraBefore=camera.clone();
  constrainPan(target,camera,origin,false);
  assert.deepEqual(target,before);assert.deepEqual(camera,cameraBefore);
});
